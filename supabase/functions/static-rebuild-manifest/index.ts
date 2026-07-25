// Rebuild manifest.json from whatever JSON files currently live in Blob.
// Useful after manual blob edits or a partial outage.
import { list, put } from "npm:@vercel/blob@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLOB_TOKEN = Deno.env.get("BLOB_READ_WRITE_TOKEN")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  try {
    const version = Date.now();
    const entities: Record<string, number> = {};
    let cursor: string | undefined = undefined;
    while (true) {
      const page: any = await list({ token: BLOB_TOKEN, cursor, limit: 1000 });
      for (const b of page.blobs ?? []) {
        const pathname = (b.pathname as string) || "";
        if (pathname === "manifest.json") continue;
        if (!pathname.endsWith(".json")) continue;
        const key = pathname.replace(/\.json$/, "");
        entities[key] = version;
      }
      if (!page.hasMore) break;
      cursor = page.cursor;
    }
    const manifest = { version, generated_at: new Date().toISOString(), entities };
    await put("manifest.json", JSON.stringify(manifest), {
      access: "public", token: BLOB_TOKEN, addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json", cacheControlMaxAge: 30,
    });
    await admin.from("static_gen_log").insert({
      entity: "rebuild-manifest", paths: [], version, ok: true,
    });
    return new Response(JSON.stringify({
      ok: true, version, entries: Object.keys(entities).length, duration_ms: Date.now() - started,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
