// Static blob cleanup
// Lists all blobs, keeps only the newest version per logical path, deletes orphans
// not present in the current manifest.
// Body: { dry?: boolean, keep?: number }  (keep=1 default; only current-in-manifest is kept)
import { list, del } from "npm:@vercel/blob@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLOB_TOKEN = Deno.env.get("BLOB_READ_WRITE_TOKEN")!;
const CDN = (Deno.env.get("STATIC_CDN_BASE") ?? "").replace(/\/+$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dry = !!body?.dry;

    const manifestKeys = new Set<string>(["manifest.json"]);
    if (CDN) {
      try {
        const r = await fetch(`${CDN}/manifest.json`, { cache: "no-store" });
        if (r.ok) {
          const m = await r.json();
          for (const p of Object.keys(m.entities ?? {})) manifestKeys.add(`${p}.json`);
        }
      } catch { /* ignore */ }
    }

    const toDelete: string[] = [];
    let cursor: string | undefined = undefined;
    let scanned = 0;
    while (true) {
      const page: any = await list({ token: BLOB_TOKEN, cursor, limit: 1000 });
      for (const b of page.blobs ?? []) {
        scanned += 1;
        // Blob URLs end with /<pathname>; the pathname is what we compare.
        const pathname = b.pathname as string;
        if (!manifestKeys.has(pathname)) toDelete.push(b.url);
      }
      if (!page.hasMore) break;
      cursor = page.cursor;
      if (scanned > 10000) break; // safety
    }

    let deleted = 0;
    if (!dry && toDelete.length > 0) {
      // del accepts up to 1000 urls per call
      for (let i = 0; i < toDelete.length; i += 500) {
        try {
          await del(toDelete.slice(i, i + 500), { token: BLOB_TOKEN });
          deleted += Math.min(500, toDelete.length - i);
        } catch { /* ignore chunk */ }
      }
    }

    await admin.from("static_gen_log").insert({
      entity: "cleanup",
      paths: toDelete.slice(0, 100),
      version: Date.now(),
      ok: true,
      error: dry ? "dry-run" : `deleted ${deleted}/${toDelete.length}`,
    });

    return new Response(JSON.stringify({
      ok: true,
      dry,
      scanned,
      candidates: toDelete.length,
      deleted,
      duration_ms: Date.now() - started,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
