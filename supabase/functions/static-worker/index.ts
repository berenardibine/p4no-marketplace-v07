// static-worker
// ------------------------------------------------------------------
// Event-driven worker for the Static Generation Engine V2.
//
// Rules:
//   • Only one instance runs at a time (distributed lock in Postgres).
//   • Coalesces pending queue rows in a short window (batching).
//   • Deduplicates by (entity_type, entity_id, action).
//   • Delegates the actual JSON generation to the existing
//     `static-generate` function (which knows how to build/upload
//     each entity payload + manifest).
//   • Never regenerates on its own schedule — invoked only via the
//     enqueue trigger's fire-and-forget HTTP call, or manually.
//   • Updates a single daily metrics row (no per-file logging).
//
// Request:  POST /static-worker  { trigger?: string }
// Response: { ok, processed, skipped, errors, batch_size }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { planFromEvents, type ChangeEvent, type Entity } from "../_shared/depGraph.ts";
import { isEntityAllowed } from "../_shared/featureGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LOCK_NAME = "worker:main";
const LOCK_TTL_SECONDS = 120;
const BATCH_WINDOW_MS = 15_000; // coalesce enqueues arriving in this window
const MAX_BATCH = 200;
const MAX_RETRIES = 3;

type QueueRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: "insert" | "update" | "delete";
  retries: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function bumpMetrics(patch: Record<string, number>) {
  const day = today();
  // Read-modify-write on daily row (one write per batch).
  const { data } = await admin
    .from("generation_metrics_daily")
    .select("*")
    .eq("day", day)
    .maybeSingle();
  const base = data ?? {
    day,
    files_generated: 0,
    files_skipped: 0,
    db_reads: 0,
    bytes_written: 0,
    bytes_saved: 0,
    errors: 0,
    loops_detected: 0,
    duplicate_enqueues: 0,
  };
  const next: Record<string, unknown> = { ...base, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    next[k] = ((base as Record<string, number>)[k] ?? 0) + v;
  }
  await admin.from("generation_metrics_daily").upsert(next as never, { onConflict: "day" });
}

const KNOWN_ENTITIES: Entity[] = [
  "product", "service", "article", "reel", "category", "shop", "seller",
];
// V4: virtual entities emitted by the dep graph (no queue rows, only fan-out targets).
const VIRTUAL_ENTITIES = new Set<string>(["homepage", "feeds", "search", "category-page"]);

function mapEntity(t: string): Entity | null {
  return (KNOWN_ENTITIES as string[]).includes(t) ? (t as Entity) : null;
}

async function invokeGenerator(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/static-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`static-generate ${res.status}: ${t.slice(0, 500)}`);
  }
  await res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const holder = crypto.randomUUID();
  let acquired = false;

  try {
    // 1. Acquire the single-worker lock.
    const { data: lockOk, error: lockErr } = await admin.rpc("try_acquire_gen_lock", {
      _name: LOCK_NAME,
      _holder: holder,
      _ttl_seconds: LOCK_TTL_SECONDS,
    });
    if (lockErr) throw lockErr;
    if (!lockOk) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "lock_held" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    acquired = true;

    // 2. Coalesce window: wait briefly for more enqueues to land.
    await new Promise((r) => setTimeout(r, BATCH_WINDOW_MS));

    // 3. Claim a batch of pending rows.
    const { data: pending, error: pendErr } = await admin
      .from("generation_queue")
      .select("id, entity_type, entity_id, action, retries")
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (pendErr) throw pendErr;

    const rows: QueueRow[] = (pending ?? []) as QueueRow[];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, batch_size: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = rows.map((r) => r.id);
    await admin
      .from("generation_queue")
      .update({ status: "running", started_at: new Date().toISOString() })
      .in("id", ids);

    // 4. Turn queue rows into a dependency-graph plan.
    const events: ChangeEvent[] = [];
    let skipped = 0;
    for (const r of rows) {
      const ent = mapEntity(r.entity_type);
      if (!ent) { skipped++; continue; }
      // Background Guard — disabled modules never reach the generator.
      if (!(await isEntityAllowed(String(r.entity_type)))) { skipped++; continue; }
      events.push({
        entity: ent,
        id: r.entity_id || null,
        action: r.action,
      });
    }
    const plan = planFromEvents(events);

    // 5. Group into the smallest possible number of generator calls.
    //    For every unique "root" entity kind we issue ONE regen call;
    //    the generator itself handles both list feeds and per-slug detail
    //    based on the payload it receives.
    const rootEntities = new Set<Entity>();
    const detailCalls: { entity: string; slug: string }[] = [];
    const categoryCalls: { entity: string; category: string }[] = [];
    const removeCalls: { entity: string; slug: string }[] = [];

    for (const t of plan.regenerate) {
      // Root feeds (no slug) → just remember the entity kind once.
      if (!t.slug && !t.category) {
        rootEntities.add(t.entity as Entity);
      } else if (t.slug) {
        detailCalls.push({ entity: t.entity, slug: t.slug });
      } else if (t.category) {
        // Explicit category-scoped regen (e.g. category pagination).
        categoryCalls.push({ entity: t.entity, category: t.category });
      }
    }
    for (const t of plan.remove) {
      if (t.slug) removeCalls.push({ entity: t.entity, slug: t.slug });
    }

    let processed = 0;
    let errors = 0;
    const errList: string[] = [];

    // Deletes first — they short-circuit stale detail regens.
    for (const d of removeCalls) {
      try {
        await invokeGenerator({ entity: d.entity, slug: d.slug, op: "delete" });
        processed++;
      } catch (e) {
        errors++;
        errList.push((e as Error).message);
      }
    }
    // One call per unique root entity → refreshes lists + search index.
    for (const ent of rootEntities) {
      try {
        await invokeGenerator({ entity: ent });
        processed++;
      } catch (e) {
        errors++;
        errList.push((e as Error).message);
      }
    }
    // Category-scoped calls (e.g. category-page pagination).
    const seenCat = new Set<string>();
    for (const c of categoryCalls) {
      const k = `${c.entity}|${c.category}`;
      if (seenCat.has(k)) continue;
      seenCat.add(k);
      try {
        await invokeGenerator({ entity: c.entity, category: c.category });
        processed++;
      } catch (e) {
        errors++;
        errList.push((e as Error).message);
      }
    }
    // Detail pages.
    const seenDetail = new Set<string>();
    for (const d of detailCalls) {
      const k = `${d.entity}|${d.slug}`;
      if (seenDetail.has(k)) continue;
      seenDetail.add(k);
      try {
        await invokeGenerator({ entity: d.entity, slug: d.slug });
        processed++;
      } catch (e) {
        errors++;
        errList.push((e as Error).message);
      }
    }

    // 6. Mark queue rows.
    const doneIds = rows.map((r) => r.id);

    if (doneIds.length) {
      await admin
        .from("generation_queue")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .in("id", doneIds);
    }

    // If we hit errors, bump retries on the affected rows (best-effort — the
    // dep graph coalesced them, so we can't attribute failure to a single row;
    // treat the whole batch as retryable up to MAX_RETRIES).
    if (errors > 0) {
      await admin
        .from("generation_queue")
        .update({ error: errList.join(" | ").slice(0, 500) })
        .in("id", doneIds);
    }

    // 6. Prune loop_guard (keeps table tiny).
    await admin.rpc("prune_loop_guard").catch(() => {});

    // 7. Update daily metrics (one write).
    await bumpMetrics({
      files_generated: processed,
      files_skipped: skipped,
      errors,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        batch_size: rows.length,
        events: events.length,
        regen_paths: plan.regenerate.length,
        remove_paths: plan.remove.length,
        processed,
        skipped,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await bumpMetrics({ errors: 1 }).catch(() => {});
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    if (acquired) {
      await admin.rpc("release_gen_lock", { _name: LOCK_NAME, _holder: holder }).catch(() => {});
    }
  }
});