// Static content generator: publishes JSON payloads to the dedicated Vercel
// static-content project via the Vercel Deployment API. The frontend fetches
// them from the Edge CDN (https://dashboard-eight-khaki-55.vercel.app).
//
// Flow per invocation:
//   1. Build/refresh JSON payloads for the requested entity.
//   2. Upload each changed payload to Vercel /v2/files (returns a sha1).
//   3. Upsert the (path, sha, size) into public.static_file_registry.
//   4. Read the full registry and create a new production deployment
//      (POST /v13/deployments) whose file list = every row in the registry.
//      Unchanged files are re-referenced by sha (no re-upload).
//
// This keeps Vercel Blob out of the loop entirely — public reads hit the
// Edge CDN only.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { isEntityAllowed, isFeatureEnabled, isStaticPathAllowed } from "../_shared/featureGuard.ts";
import { productStaticPath, shardOf } from "../_shared/shard.ts";

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

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --------------- Vercel helpers ---------------

const vercelHeaders = () => ({
  Authorization: `Bearer ${VERCEL_TOKEN}`,
  "Content-Type": "application/json",
});
const teamQS = VERCEL_ORG_ID ? `?teamId=${VERCEL_ORG_ID}` : "";

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Upload one file body to Vercel's file store; returns { sha, size }.
async function uploadFile(bytes: Uint8Array): Promise<{ sha: string; size: number }> {
  const sha = await sha1Hex(bytes);
  const size = bytes.byteLength;
  const res = await fetch(`https://api.vercel.com/v2/files${teamQS}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": sha,
    },
    body: bytes,
  });
  if (!res.ok && res.status !== 200) {
    const t = await res.text();
    throw new Error(`vercel upload failed ${res.status}: ${t}`);
  }
  return { sha, size };
}

// Track skip stats across a single invocation so the worker can report them.
const runStats = { written: 0, skipped: 0, bytesWritten: 0, bytesSaved: 0 };

// Prepare a JSON payload for upload and registry update. Returns the manifest path.
// V3 dirty-check: compute a stable sha256 of the DATA (not the envelope, whose
// timestamp changes every call). If the hash matches the last recorded value in
// static_manifest we skip the upload + registry write entirely — this is the
// core of "no unnecessary writes".
interface StageMeta { entity?: string; entityId?: string | null; shard?: string | null }

async function stageJson(path: string, data: unknown, version: number, meta?: StageMeta): Promise<string> {
  const startedAt = Date.now();
  // Feature guard: never write JSON that belongs to a disabled module.
  if (!(await isStaticPathAllowed(path))) {
    runStats.skipped += 1;
    return path;
  }
  const dataJson = JSON.stringify(data);
  const contentHash = await sha256(dataJson);

  const manifestKey = path.replace(/\.json$/, "");
  const { data: prev } = await admin
    .from("static_manifest")
    .select("hash,size")
    .eq("path", manifestKey)
    .maybeSingle();

  if (prev?.hash === contentHash) {
    runStats.skipped += 1;
    runStats.bytesSaved += prev.size ?? dataJson.length;
    // Content unchanged → NO writes at all (no re-upload, no manifest touch).
    return path;
  }

  const envelope = JSON.stringify({
    v: version,
    generated_at: new Date().toISOString(),
    hash: contentHash,
    data,
  });
  const bytes = new TextEncoder().encode(envelope);
  const { sha, size } = await uploadFile(bytes);

  await admin.from("static_file_registry").upsert({
    path,
    sha,
    size,
    content_type: "application/json",
    updated_at: new Date().toISOString(),
  });

  await admin.from("static_manifest").upsert({
    path: manifestKey,
    version,
    hash: contentHash,
    size,
    generated_at: new Date().toISOString(),
    entity: meta?.entity ?? null,
    entity_id: meta?.entityId ?? null,
    shard: meta?.shard ?? null,
    status: "ok",
    duration_ms: Date.now() - startedAt,
  });

  runStats.written += 1;
  runStats.bytesWritten += size;
  return path;
}

// Remove a path from the registry (so the next deployment omits it) and
// drop its manifest row so clients can prune IndexedDB.
async function unstage(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await admin.from("static_file_registry").delete().in("path", paths);
  const manifestKeys = paths.map((p) => p.replace(/\.json$/, ""));
  await admin.from("static_manifest").delete().in("path", manifestKeys);
}

// Build a full deployment from the current registry.
async function deploy(reason: string): Promise<{ id: string; url: string }> {
  const { data: rows, error } = await admin
    .from("static_file_registry")
    .select("path,sha,size")
    .limit(50000);
  if (error) throw error;
  const files = (rows ?? []).map((r: any) => ({
    file: r.path,
    sha: r.sha,
    size: r.size,
  }));
  const body = {
    name: VERCEL_PROJECT_NAME,
    project: VERCEL_STATIC_PROJECT_ID,
    target: "production",
    files,
    projectSettings: { framework: null, outputDirectory: null },
    meta: { reason },
  };
  const res = await fetch(`https://api.vercel.com/v13/deployments${teamQS}&forceNew=1`, {
    method: "POST",
    headers: vercelHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`vercel deploy failed ${res.status}: ${t}`);
  }
  const j = await res.json();
  return { id: j.id, url: j.url };
}

// Manifest is itself a file in the deployment.
async function stageManifest(paths: string[], removed: string[]): Promise<number> {
  // Read the existing manifest from CDN so we can carry forward entity versions.
  const version = Date.now();
  let entities: Record<string, number> = {};
  try {
    const r = await fetch(`https://dashboard-eight-khaki-55.vercel.app/manifest.json`, { cache: "no-store" });
    if (r.ok) {
      const prev = await r.json();
      entities = prev?.entities ?? {};
    }
  } catch { /* first run — empty */ }
  for (const p of paths) entities[p] = version;
  for (const p of removed) delete entities[p];
  const manifest = {
    version,
    generated_at: new Date().toISOString(),
    entities,
    // V3: explicit tombstone list — clients read this on manifest refresh and
    // delete matching entries from IndexedDB. No stale content survives.
    tombstones: removed.map((p) => p.replace(/\.json$/, "")),
    changed: Array.from(new Set([...paths, ...removed.map((p) => `-${p}`)])),
    hash: await sha256(JSON.stringify(entities)),
  };
  await stageJson("manifest.json", manifest, version);
  // The manifest.json envelope wraps `manifest` under `.data`; the frontend
  // reads it as raw JSON, so also stage a top-level plain copy.
  const raw = new TextEncoder().encode(JSON.stringify(manifest));
  const { sha, size } = await uploadFile(raw);
  await admin.from("static_file_registry").upsert({
    path: "manifest.json",
    sha,
    size,
    content_type: "application/json",
    updated_at: new Date().toISOString(),
  });
  return version;
}

// --------------- Queries ---------------

const PRODUCT_COLS = `
  id,slug,title,description,price,currency_symbol,images,video_url,video_thumbnail,
  category,status,views,likes,created_at,updated_at,seller_id,shop_id,
  minimum_quantity,unlimited_quantity,quantity,contact_call,contact_whatsapp,
  admin_posted,admin_shop_name,
  seller:profiles!products_seller_id_fkey(id,full_name,profile_image,whatsapp_number,call_number),
  shop:shops(id,name,logo_url,slug)
`;

async function fetchProducts(filter?: (q: any) => any, limit = 100) {
  let q = admin.from("products").select(PRODUCT_COLS).eq("status", "active");
  if (filter) q = filter(q);
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// --------------- Generators ---------------

async function genProductLists(): Promise<string[]> {
  const [latest, featured, popular, trending] = await Promise.all([
    fetchProducts((q) => q.order("created_at", { ascending: false }), 100),
    fetchProducts((q) => q.eq("sponsored", true).order("created_at", { ascending: false }), 100),
    fetchProducts((q) => q.order("likes", { ascending: false, nullsFirst: false }), 100),
    fetchProducts((q) => q.order("views", { ascending: false, nullsFirst: false }), 100),
  ]);
  const v = Date.now();
  const searchIndex = latest.concat(featured, popular, trending).reduce((acc: any[], p: any) => {
    if (acc.find((x) => x.id === p.id)) return acc;
    acc.push({
      id: p.id, slug: p.slug, title: p.title, price: p.price,
      category: p.category, image: Array.isArray(p.images) ? p.images[0] : null,
    });
    return acc;
  }, []);
  // Compact index of every active product (card-level fields only) so the
  // client can render lists/search without ever touching PostgREST.
  const all = await fetchProducts((q) => q.order("created_at", { ascending: false }), 1000);
  const paths = [
    await stageJson("products/all.json", all.map((p: any) => ({
      id: p.id, slug: p.slug, title: p.title, price: p.price,
      currency_symbol: p.currency_symbol, category: p.category,
      images: Array.isArray(p.images) ? p.images.slice(0, 1) : [],
      views: p.views, likes: p.likes, created_at: p.created_at,
    })), v),
    await stageJson("products/latest.json", latest, v),
    await stageJson("products/featured.json", featured, v),
    await stageJson("products/popular.json", popular, v),
    await stageJson("products/trending.json", trending, v),
    await stageJson("products/search-index.json", searchIndex, v),
  ];
  return paths.map((p) => p.replace(/\.json$/, ""));
}

async function genProductCategory(category: string): Promise<string[]> {
  if (!category) return [];
  const rows = await fetchProducts((q) => q.eq("category", category).order("created_at", { ascending: false }), 200);
  const path = `products/category/${category}`;
  await stageJson(`${path}.json`, rows, Date.now());
  return [path];
}

// V3: every product gets its own JSON inside a hash-sharded folder
// (products/<00..ff>/<slug>.json). The shard is derived from the same key the
// URL exposes, so clients resolve the path locally with no lookup.
async function genProductDetail(slugOrId: string): Promise<string[]> {
  if (!slugOrId) return [];
  const started = Date.now();
  const { data } = await admin
    .from("products").select(PRODUCT_COLS)
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
  if (!data) return [];
  const key = data.slug ?? data.id;
  const path = await productStaticPath(key);
  await stageJson(`${path}.json`, data, Date.now(), {
    entity: "product",
    entityId: data.id,
    shard: await shardOf(key),
  });
  // Retire the pre-shard flat path so no duplicate JSON survives.
  await unstage([`product/${key}.json`]);
  try {
    await admin.from("static_gen_log").insert({
      entity: "product-detail", slug: key, paths: [path], ok: true,
      duration_ms: Date.now() - started,
    });
  } catch { /* logging is best-effort */ }
  return [path];
}

async function genServices(): Promise<string[]> {
  const cols = `*, provider:profiles!services_provider_id_fkey(id,full_name,profile_image)`;
  const [latest, trending] = await Promise.all([
    admin.from("services").select(cols).eq("status", "active").order("created_at", { ascending: false }).limit(100),
    admin.from("services").select(cols).eq("status", "active").order("views", { ascending: false, nullsFirst: false }).limit(100),
  ]);
  const v = Date.now();
  await stageJson("services/latest.json", latest.data ?? [], v);
  await stageJson("services/featured.json", latest.data ?? [], v);
  await stageJson("services/trending.json", trending.data ?? [], v);
  return ["services/latest", "services/featured", "services/trending"];
}

async function genServiceDetail(slugOrId: string): Promise<string[]> {
  if (!slugOrId) return [];
  const { data } = await admin
    .from("services")
    .select(`*, provider:profiles!services_provider_id_fkey(id,full_name,profile_image)`)
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
  if (!data) return [];
  const path = `service/${data.slug ?? data.id}`;
  await stageJson(`${path}.json`, data, Date.now());
  return [path];
}

async function genReels(): Promise<string[]> {
  const cols = `
    id,title,description,price,currency_symbol,video_url,video_thumbnail,images,slug,
    seller_id,shop_id,contact_call,contact_whatsapp,minimum_quantity,unlimited_quantity,
    quantity,views,likes,admin_posted,admin_shop_name,created_at,
    seller:profiles!products_seller_id_fkey(id,full_name,profile_image,whatsapp_number,call_number),
    shop:shops(id,name,logo_url,slug)
  `;
  const base = admin.from("products").select(cols).not("video_url", "is", null).neq("video_url", "").eq("status", "active");
  const [latest, trending] = await Promise.all([
    base.order("created_at", { ascending: false }).limit(100),
    base.order("views", { ascending: false, nullsFirst: false }).limit(100),
  ]);
  const v = Date.now();
  await stageJson("reels/latest.json", latest.data ?? [], v);
  await stageJson("reels/trending.json", trending.data ?? [], v);
  return ["reels/latest", "reels/trending"];
}

async function genArticles(): Promise<string[]> {
  const [latest, trending] = await Promise.all([
    admin.from("insight_articles").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(100),
    admin.from("insight_articles").select("*").eq("status", "published").order("views", { ascending: false, nullsFirst: false }).limit(100),
  ]);
  const v = Date.now();
  await stageJson("articles/latest.json", latest.data ?? [], v);
  await stageJson("articles/trending.json", trending.data ?? [], v);
  return ["articles/latest", "articles/trending"];
}

async function genArticleDetail(slug: string): Promise<string[]> {
  if (!slug) return [];
  const { data } = await admin.from("insight_articles").select("*").eq("slug", slug).maybeSingle();
  if (!data) return [];
  const path = `article/${data.slug}`;
  await stageJson(`${path}.json`, data, Date.now());
  return [path];
}

async function genCategories(): Promise<string[]> {
  const [all, serviceCats, insightCats] = await Promise.all([
    admin.from("categories").select("*").order("name"),
    admin.from("service_categories").select("*").order("name"),
    admin.from("insight_categories").select("*").order("name"),
  ]);
  const v = Date.now();
  await stageJson("categories/all.json", all.data ?? [], v);
  await stageJson("categories/menu.json", (all.data ?? []).filter((c: any) => c.show_in_menu ?? true), v);
  await stageJson("categories/home.json", (all.data ?? []).slice(0, 12), v);
  await stageJson("categories/services.json", serviceCats.data ?? [], v);
  await stageJson("categories/insights.json", insightCats.data ?? [], v);
  return ["categories/all", "categories/menu", "categories/home", "categories/services", "categories/insights"];
}

// ---------- V4 additions ----------

const PAGE_SIZE = 40;

async function genCategoryPaginated(category: string): Promise<string[]> {
  if (!category) return [];
  const rows = await fetchProducts((q) => q.eq("category", category).order("created_at", { ascending: false }), 2000);
  const v = Date.now();
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paths: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    const slice = rows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
    const p = `categories/${category}/page-${i + 1}`;
    await stageJson(`${p}.json`, slice, v);
    paths.push(p);
  }
  const idx = `categories/${category}/index`;
  await stageJson(`${idx}.json`, { total, pageCount, pageSize: PAGE_SIZE }, v);
  paths.push(idx);
  return paths;
}

async function genFeeds(): Promise<string[]> {
  const [latest, popular, trending, featured] = await Promise.all([
    fetchProducts((q) => q.order("created_at", { ascending: false }), 100),
    fetchProducts((q) => q.order("likes", { ascending: false, nullsFirst: false }), 100),
    fetchProducts((q) => q.order("views", { ascending: false, nullsFirst: false }), 100),
    fetchProducts((q) => q.eq("sponsored", true).order("created_at", { ascending: false }), 100),
  ]);
  const v = Date.now();
  await stageJson("feeds/latest.json", latest, v);
  await stageJson("feeds/popular.json", popular, v);
  await stageJson("feeds/trending.json", trending, v);
  await stageJson("feeds/featured.json", featured, v);
  return ["feeds/latest", "feeds/popular", "feeds/trending", "feeds/featured"];
}

async function genSearchIndex(): Promise<string[]> {
  const [prods, svcs, arts] = await Promise.all([
    admin.from("products").select("id,slug,title,category,price,images").eq("status", "active").limit(2000),
    admin.from("services").select("id,slug,title,category").eq("status", "active").limit(1000),
    admin.from("insight_articles").select("id,slug,title,category").eq("status", "published").limit(1000),
  ]);
  const index = [
    ...(prods.data ?? []).map((p: any) => ({
      kind: "product", id: p.id, slug: p.slug, title: p.title,
      category: p.category, price: p.price,
      thumb: Array.isArray(p.images) ? p.images[0] : null,
    })),
    ...(svcs.data ?? []).map((s: any) => ({
      kind: "service", id: s.id, slug: s.slug, title: s.title, category: s.category,
    })),
    ...(arts.data ?? []).map((a: any) => ({
      kind: "article", id: a.id, slug: a.slug, title: a.title, category: a.category,
    })),
  ];
  await stageJson("search/search-index.json", index, Date.now());
  return ["search/search-index"];
}

async function genHomepage(): Promise<string[]> {
  const [latest, popular, featured, cats] = await Promise.all([
    fetchProducts((q) => q.order("created_at", { ascending: false }), 24),
    fetchProducts((q) => q.order("likes", { ascending: false, nullsFirst: false }), 24),
    fetchProducts((q) => q.eq("sponsored", true).order("created_at", { ascending: false }), 12),
    admin.from("categories").select("*").order("name").limit(24),
  ]);
  const bundle = {
    latest, popular, featured,
    categories: cats.data ?? [],
  };
  await stageJson("homepage.json", bundle, Date.now());
  return ["homepage"];
}

async function genShops(): Promise<string[]> {
  const { data } = await admin.from("shops").select("*").order("created_at", { ascending: false }).limit(500);
  await stageJson("shops/all.json", data ?? [], Date.now());
  return ["shops/all"];
}

async function genShopDetail(slugOrId: string): Promise<string[]> {
  if (!slugOrId) return [];
  const { data } = await admin.from("shops").select("*")
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
  if (!data) return [];
  const p = `shops/${data.slug ?? data.id}`;
  await stageJson(`${p}.json`, data, Date.now());
  return [p];
}

async function genSellerDetail(id: string): Promise<string[]> {
  if (!id) return [];
  const { data } = await admin.from("profiles")
    .select("id,full_name,profile_image,bio,whatsapp_number,call_number,created_at")
    .eq("id", id).maybeSingle();
  if (!data) return [];
  const p = `sellers/${data.id}`;
  await stageJson(`${p}.json`, data, Date.now());
  return [p];
}

// --------------- Router ---------------

async function handle(body: any): Promise<{ paths: string[]; removed: string[]; deployment?: { id: string; url: string } }> {
  const { entity, slug, id, category, op } = body ?? {};
  const paths: string[] = [];
  const removed: string[] = [];
  const isDelete = String(op ?? "").toUpperCase() === "DELETE";

  // Static Generator Guard — never build JSON for a disabled module.
  if (!(await isEntityAllowed(String(entity ?? "")))) {
    return { paths: [], removed: [], skipped: true, reason: "feature_disabled" } as any;
  }
  const reelsOn = await isFeatureEnabled("reels_module");
  const articlesOn = await isFeatureEnabled("articles_module");


  if (isDelete && (slug || id)) {
    const key = slug ?? id;
    switch (entity) {
      case "product":
      case "reel":
        // Sharded detail file + the legacy flat path (belt & braces).
        removed.push(await productStaticPath(key), `product/${key}`);
        break;
      case "service": removed.push(`service/${key}`); break;
      case "article": removed.push(`article/${key}`); break;
      case "shop": removed.push(`shops/${key}`); break;
      case "seller": removed.push(`sellers/${key}`); break;
    }
    if (removed.length > 0) await unstage(removed.map((p) => `${p}.json`));
  }

  switch (entity) {
    case "product":
      paths.push(...(await genProductLists()));
      paths.push(...(await genFeeds()));
      paths.push(...(await genSearchIndex()));
      paths.push(...(await genHomepage()));
      if (!isDelete && (slug || id)) paths.push(...(await genProductDetail(slug ?? id)));
      if (category) {
        paths.push(...(await genProductCategory(category)));
        paths.push(...(await genCategoryPaginated(category)));
      }
      break;
    case "service":
      paths.push(...(await genServices()));
      paths.push(...(await genSearchIndex()));
      paths.push(...(await genHomepage()));
      if (!isDelete && (slug || id)) paths.push(...(await genServiceDetail(slug ?? id)));
      break;
    case "reel":
      paths.push(...(await genReels()));
      paths.push(...(await genProductLists()));
      paths.push(...(await genHomepage()));
      if (!isDelete && (slug || id)) paths.push(...(await genProductDetail(slug ?? id)));
      break;
    case "article":
      paths.push(...(await genArticles()));
      paths.push(...(await genSearchIndex()));
      paths.push(...(await genHomepage()));
      if (!isDelete && slug) paths.push(...(await genArticleDetail(slug)));
      break;
    case "category":
      paths.push(...(await genCategories()));
      paths.push(...(await genHomepage()));
      if (category) {
        paths.push(...(await genProductCategory(category)));
        paths.push(...(await genCategoryPaginated(category)));
      }
      break;
    case "category-page":
      if (category) paths.push(...(await genCategoryPaginated(category)));
      break;
    case "shop":
      paths.push(...(await genShops()));
      paths.push(...(await genHomepage()));
      if (!isDelete && (slug || id)) paths.push(...(await genShopDetail(slug ?? id)));
      break;
    case "seller":
      paths.push(...(await genHomepage()));
      if (!isDelete && (slug || id)) paths.push(...(await genSellerDetail(slug ?? id)));
      break;
    case "homepage":
      paths.push(...(await genHomepage()));
      break;
    case "feeds":
      paths.push(...(await genFeeds()));
      break;
    case "search":
      paths.push(...(await genSearchIndex()));
      break;
    case "all":
      paths.push(
        ...(await genProductLists()),
        ...(await genServices()),
        ...(reelsOn ? await genReels() : []),
        ...(articlesOn ? await genArticles() : []),
        ...(await genCategories()),
        ...(await genFeeds()),
        ...(await genSearchIndex()),
        ...(await genHomepage()),
        ...(await genShops()),
      );

      break;
    default:
      throw new Error(`unknown entity: ${entity}`);
  }

  const version = await stageManifest(paths, removed);
  const deployment = await deploy(`${entity}${slug || id ? `:${slug ?? id}` : ""}${isDelete ? "(del)" : ""}`);

  await admin.from("static_gen_log").insert({
    entity,
    slug: slug ?? id ?? null,
    category: category ?? null,
    paths: [...paths, ...removed.map((p) => `-${p}`)],
    version,
    ok: true,
  });
  return { paths, removed, deployment, stats: { ...runStats } };
}

// --------------- Single-flight lock ---------------
// Only ONE generation process may run at a time. A second caller does not
// duplicate the work: it enqueues the request and returns immediately.
const LOCK_NAME = "static-generate";
const LOCK_TTL_MS = 120_000;

async function acquireLock(holder: string): Promise<boolean> {
  const now = new Date();
  // Clear any expired lock first (crashed run).
  await admin.from("generation_locks").delete().lt("expires_at", now.toISOString());
  const { error } = await admin.from("generation_locks").insert({
    name: LOCK_NAME,
    holder,
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
  });
  return !error;
}

async function releaseLock(): Promise<void> {
  await admin.from("generation_locks").delete().eq("name", LOCK_NAME);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let locked = false;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const holder = `${body?.entity ?? "unknown"}:${body?.slug ?? body?.id ?? "-"}`;
    locked = await acquireLock(holder);
    if (!locked) {
      // Another generator is running — queue this change instead of racing it.
      try {
        await admin.rpc("enqueue_generation", {
          _entity_type: String(body?.entity ?? "all"),
          _entity_id: String(body?.slug ?? body?.id ?? ""),
          _action: String(body?.op ?? "upsert"),
        });
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "generator_busy", queued: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const result = await handle(body);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    try {
      await admin.from("static_gen_log").insert({ entity: "error", paths: [], ok: false, error: msg });
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (locked) await releaseLock();
  }
});
