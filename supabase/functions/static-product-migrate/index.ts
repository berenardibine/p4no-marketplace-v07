// One-time (and repeatable) migration: give every existing product its own
// sharded static JSON file at products/<shard>/<slug>.json.
//
// Batched and idempotent:
//   - dirty-checked by content hash → unchanged products are skipped
//   - only files that changed are uploaded to Vercel
//   - one manifest publish + one deployment per batch (never per product)
//
// POST { limit?: number, offset?: number, force?: boolean, deploy?: boolean }
// Returns a full integrity report.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { productStaticPath, shardOf } from "../_shared/shard.ts";
import { isFeatureEnabled } from "../_shared/featureGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN")!;
const VERCEL_ORG_ID = Deno.env.get("VERCEL_ORG_ID")!;
const VERCEL_STATIC_PROJECT_ID = Deno.env.get("VERCEL_STATIC_PROJECT_ID")!;
const VERCEL_PROJECT_NAME = Deno.env.get("VERCEL_STATIC_PROJECT_NAME") ?? "dashboard";
const CDN_BASE = "https://dashboard-eight-khaki-55.vercel.app";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const teamQS = VERCEL_ORG_ID ? `?teamId=${VERCEL_ORG_ID}` : "";

async function hex(alg: string, bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(alg, bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadFile(bytes: Uint8Array): Promise<{ sha: string; size: number }> {
  const sha = await hex("SHA-1", bytes);
  const res = await fetch(`https://api.vercel.com/v2/files${teamQS}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": sha,
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`vercel upload failed ${res.status}: ${await res.text()}`);
  return { sha, size: bytes.byteLength };
}

const PRODUCT_COLS = `
  id,slug,title,description,price,currency_symbol,images,video_url,video_thumbnail,
  category,status,views,created_at,updated_at,seller_id,shop_id,
  minimum_quantity,unlimited_quantity,quantity,contact_call,contact_whatsapp,
  admin_posted,admin_shop_name,
  seller:profiles!products_seller_id_fkey(id,full_name,profile_image,whatsapp_number,call_number),
  shop:shops(id,name,logo_url,slug)
`;

const LOCK_NAME = "static-product-migrate";

async function acquireLock(): Promise<boolean> {
  const now = new Date();
  await admin.from("generation_locks").delete().lt("expires_at", now.toISOString());
  const { error } = await admin.from("generation_locks").insert({
    name: LOCK_NAME,
    holder: "migration",
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
  });
  return !error;
}

async function releaseLock() {
  await admin.from("generation_locks").delete().eq("name", LOCK_NAME);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let locked = false;
  const startedAll = Date.now();
  try {
    if (!(await isFeatureEnabled("products_module"))) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "feature_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body?.limit ?? 250), 500);
    const offset = Number(body?.offset ?? 0);
    const force = Boolean(body?.force);
    const shouldDeploy = body?.deploy !== false;

    locked = await acquireLock();
    if (!locked) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "migration_busy" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: total } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const { data: rows, error } = await admin
      .from("products")
      .select(PRODUCT_COLS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const version = Date.now();
    const report = {
      total: total ?? 0,
      scanned: (rows ?? []).length,
      generated: 0,
      skipped: 0,
      failed: 0,
      failures: [] as Array<{ slug: string; error: string }>,
      shards: {} as Record<string, number>,
    };
    const staged: string[] = [];

    for (const p of rows ?? []) {
      const key = (p as any).slug ?? (p as any).id;
      try {
        const shard = await shardOf(key);
        const path = await productStaticPath(key);
        report.shards[shard] = (report.shards[shard] ?? 0) + 1;

        const dataJson = JSON.stringify(p);
        const contentHash = await hex("SHA-256", new TextEncoder().encode(dataJson));

        const { data: prev } = await admin
          .from("static_manifest").select("hash").eq("path", path).maybeSingle();
        if (!force && prev?.hash === contentHash) {
          report.skipped += 1;
          staged.push(path);
          continue;
        }

        const t0 = Date.now();
        const envelope = new TextEncoder().encode(
          JSON.stringify({ v: version, generated_at: new Date().toISOString(), hash: contentHash, data: p }),
        );
        const { sha, size } = await uploadFile(envelope);

        await admin.from("static_file_registry").upsert({
          path: `${path}.json`, sha, size,
          content_type: "application/json",
          updated_at: new Date().toISOString(),
        });
        await admin.from("static_manifest").upsert({
          path, version, hash: contentHash, size,
          generated_at: new Date().toISOString(),
          entity: "product", entity_id: (p as any).id, shard,
          status: "ok", duration_ms: Date.now() - t0,
        });
        // Retire any pre-shard flat copy.
        await admin.from("static_file_registry").delete().eq("path", `product/${key}.json`);
        await admin.from("static_manifest").delete().eq("path", `product/${key}`);

        report.generated += 1;
        staged.push(path);
      } catch (e) {
        report.failed += 1;
        report.failures.push({ slug: String(key), error: (e as Error).message });
      }
    }

    let deployment: { id: string; url: string } | null = null;
    if (shouldDeploy && (report.generated > 0 || force)) {
      // Publish manifest with the new entries, then one deployment for the batch.
      let entities: Record<string, number> = {};
      try {
        const r = await fetch(`${CDN_BASE}/manifest.json`, { cache: "no-store" });
        if (r.ok) entities = (await r.json())?.entities ?? {};
      } catch { /* first run */ }
      for (const p of staged) entities[p] = version;
      const manifest = {
        version,
        generated_at: new Date().toISOString(),
        entities,
        tombstones: [],
        hash: await hex("SHA-256", new TextEncoder().encode(JSON.stringify(entities))),
      };
      const raw = new TextEncoder().encode(JSON.stringify(manifest));
      const up = await uploadFile(raw);
      await admin.from("static_file_registry").upsert({
        path: "manifest.json", sha: up.sha, size: up.size,
        content_type: "application/json", updated_at: new Date().toISOString(),
      });

      const { data: regRows } = await admin
        .from("static_file_registry").select("path,sha,size").limit(50000);
      const files = (regRows ?? []).map((r: any) => ({ file: r.path, sha: r.sha, size: r.size }));
      const res = await fetch(`https://api.vercel.com/v13/deployments${teamQS}&forceNew=1`, {
        method: "POST",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: VERCEL_PROJECT_NAME,
          project: VERCEL_STATIC_PROJECT_ID,
          target: "production",
          files,
          projectSettings: { framework: null, outputDirectory: null },
          meta: { reason: `product-migration:${offset}-${offset + report.scanned}` },
        }),
      });
      if (!res.ok) throw new Error(`vercel deploy failed ${res.status}: ${await res.text()}`);
      const j = await res.json();
      deployment = { id: j.id, url: j.url };
    }

    const durationMs = Date.now() - startedAll;
    const nextOffset = offset + report.scanned;
    const done = nextOffset >= (total ?? 0) || report.scanned === 0;

    await admin.from("static_gen_log").insert({
      entity: "product-migration",
      paths: staged,
      version,
      ok: report.failed === 0,
      duration_ms: durationMs,
      error: report.failed ? JSON.stringify(report.failures.slice(0, 5)) : null,
    });

    return new Response(
      JSON.stringify({
        ok: true, ...report, durationMs, version,
        offset, nextOffset, done, deployment,
        integrity: report.failed === 0 ? "healthy" : "degraded",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (locked) await releaseLock();
  }
});
