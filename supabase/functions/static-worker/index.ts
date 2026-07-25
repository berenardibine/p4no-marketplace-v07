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

// Map queue entity_type → static-generate entity name.
function mapEntity(t: string): string | null {
  switch (t) {
    case "product":
    case "service":
    case "article":
    case "category":
    case "reel":
      return t;
    // Shops don't have their own static entity yet — treat as a homepage refresh.
    case "shop":
      return "product"; // reuse product surface (list + homepage)
    default:
      return null;
  }
}

async function invokeGenerate(entity: string, id: string, action: string): Promise<void> {
  const body: Record<string, unknown> = { entity };
  if (id) body.id = id;
  if (action === "delete") body.op = "delete";

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

    // 4. Dedupe by (entity_type, entity_id, action).
    const uniq = new Map<string, QueueRow>();
    for (const r of rows) {
      const key = `${r.entity_type}|${r.entity_id}|${r.action}`;
      if (!uniq.has(key)) uniq.set(key, r);
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const errored: { id: number; err: string; retries: number }[] = [];
    const doneIds: number[] = [];

    for (const r of uniq.values()) {
      const entity = mapEntity(r.entity_type);
      if (!entity) {
        skipped++;
        continue;
      }
      try {
        await invokeGenerate(entity, r.entity_id, r.action);
        processed++;
      } catch (e) {
        errors++;
        errored.push({ id: r.id, err: (e as Error).message, retries: r.retries + 1 });
      }
    }

    // 5. Mark all rows for this batch. Rows collapsed by dedupe share fate with their key.
    for (const r of rows) {
      const key = `${r.entity_type}|${r.entity_id}|${r.action}`;
      const leader = uniq.get(key)!;
      const failed = errored.find((e) => e.id === leader.id);
      if (failed && r.id === leader.id) continue; // handled below
      doneIds.push(r.id);
    }

    if (doneIds.length) {
      await admin
        .from("generation_queue")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .in("id", doneIds);
    }

    for (const f of errored) {
      const finalStatus = f.retries >= MAX_RETRIES ? "error" : "pending";
      await admin
        .from("generation_queue")
        .update({
          status: finalStatus,
          retries: f.retries,
          error: f.err.slice(0, 500),
          completed_at: finalStatus === "error" ? new Date().toISOString() : null,
          started_at: null,
        })
        .eq("id", f.id);
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
        unique: uniq.size,
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