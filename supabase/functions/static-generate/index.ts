// Static content generator — Single Event Architecture (V5).
//
//   One database change
//     ↓ one event_id (deduplicated)
//     ↓ one lock (optimistic, event-aware)
//     ↓ one generator run (each task executes at most ONCE per event)
//     ↓ one registry write (batched upsert)
//     ↓ one manifest write (batched upsert + single manifest.json)
//     ↓ one log row
//     ↓ unlock
//
// Guarantees:
//   • Identical event already running   → skipped (duplicate_generations)
//   • Identical event just completed    → skipped (duplicate_requests)
//   • Same task requested twice in one event → executed once
//   • Same DB query needed by several generators → fetched once (memo)
//   • Unchanged content → no upload, no registry row, no manifest row
//
// Accepts either a single job `{ entity, slug, id, category, op }`
// or a batch `{ jobs: [ {...}, {...} ] }` (used by static-worker).

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
const CDN_BASE = "https://dashboard-eight-khaki-55.vercel.app";

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
    throw new Error(`vercel upload failed ${res.status}: ${await res.text()}`);
  }
  return { sha, size };
}

// =====================================================================
// Per-event run context — everything below is scoped to ONE event.
// =====================================================================

interface StageMeta { entity?: string; entityId?: string | null; shard?: string | null }
interface Staged { path: string; data: unknown; meta?: StageMeta }

class RunContext {
  readonly generationId = crypto.randomUUID();
  eventId = "";
  /** Memoised DB reads — the same query never runs twice within one event. */
  private readonly queries = new Map<string, Promise<unknown>>();
  /** Task keys already executed within this event. */
  private readonly tasks = new Map<string, Promise<string[]>>();
  /** Staged payloads, keyed by path — a path can only be staged once. */
  private readonly staged = new Map<string, Staged>();
  readonly removed = new Set<string>();
  stats = {
    written: 0,
    skipped: 0,
    bytesWritten: 0,
    bytesSaved: 0,
    dbReads: 0,
    dedupedQueries: 0,
    dedupedTasks: 0,
    dedupedStages: 0,
  };

  /** Memoised query: identical key ⇒ one PostgREST request per event. */
  query<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.queries.get(key);
    if (hit) {
      this.stats.dedupedQueries += 1;
      return hit as Promise<T>;
    }
    this.stats.dbReads += 1;
    const p = fn();
    this.queries.set(key, p as Promise<unknown>);
    return p;
  }

  /** Memoised generator task: identical key ⇒ one execution per event. */
  task(key: string, fn: () => Promise<string[]>): Promise<string[]> {
    const hit = this.tasks.get(key);
    if (hit) {
      this.stats.dedupedTasks += 1;
      return hit;
    }
    const p = fn();
    this.tasks.set(key, p);
    return p;
  }

  /** Buffer a payload. No DB / network work happens here. */
  stage(path: string, data: unknown, meta?: StageMeta): string {
    if (this.staged.has(path)) {
      this.stats.dedupedStages += 1;
    } else {
      this.staged.set(path, { path, data, meta });
    }
    return path.replace(/\.json$/, "");
  }

  stagedList(): Staged[] {
    return Array.from(this.staged.values());
  }
}

// --------------- Batched flush: registry + manifest in ONE write each -----

async function flush(ctx: RunContext): Promise<string[]> {
  const items: Staged[] = [];
  for (const s of ctx.stagedList()) {
    // Feature guard — never publish JSON belonging to a disabled module.
    if (!(await isStaticPathAllowed(s.path))) { ctx.stats.skipped += 1; continue; }
    items.push(s);
  }
  if (items.length === 0) return [];

  const keys = items.map((s) => s.path.replace(/\.json$/, ""));
  // ONE manifest read for the whole event (was: one per file).
  const { data: prevRows } = await admin
    .from("static_manifest")
    .select("path,hash,size")
    .in("path", keys);
  ctx.stats.dbReads += 1;
  const prev = new Map<string, { hash: string | null; size: number | null }>(
    (prevRows ?? []).map((r: any) => [r.path, { hash: r.hash, size: r.size }]),
  );

  const version = Date.now();
  const registryRows: Record<string, unknown>[] = [];
  const manifestRows: Record<string, unknown>[] = [];
  const changed: string[] = [];

  for (const s of items) {
    const startedAt = Date.now();
    const key = s.path.replace(/\.json$/, "");
    const dataJson = JSON.stringify(s.data);
    const contentHash = await sha256(dataJson);
    const before = prev.get(key);
    if (before?.hash === contentHash) {
      // Unchanged → zero writes, zero uploads.
      ctx.stats.skipped += 1;
      ctx.stats.bytesSaved += before.size ?? dataJson.length;
      continue;
    }
    const envelope = JSON.stringify({
      v: version,
      generated_at: new Date().toISOString(),
      hash: contentHash,
      data: s.data,
    });
    const { sha, size } = await uploadFile(new TextEncoder().encode(envelope));
    registryRows.push({
      path: s.path, sha, size,
      content_type: "application/json",
      updated_at: new Date().toISOString(),
    });
    manifestRows.push({
      path: key, version, hash: contentHash, size,
      generated_at: new Date().toISOString(),
      entity: s.meta?.entity ?? null,
      entity_id: s.meta?.entityId ?? null,
      shard: s.meta?.shard ?? null,
      status: "ok",
      duration_ms: Date.now() - startedAt,
    });
    changed.push(key);
    ctx.stats.written += 1;
    ctx.stats.bytesWritten += size;
  }

  if (registryRows.length > 0) {
    await admin.from("static_file_registry").upsert(registryRows as never, { onConflict: "path" });
    await admin.from("static_manifest").upsert(manifestRows as never, { onConflict: "path" });
  }
  return changed;
}

async function unstage(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await admin.from("static_file_registry").delete().in("path", paths);
  await admin.from("static_manifest").delete().in("path", paths.map((p) => p.replace(/\.json$/, "")));
}

async function deploy(reason: string): Promise<{ id: string; url: string }> {
  const { data: rows, error } = await admin
    .from("static_file_registry")
    .select("path,sha,size")
    .limit(50000);
  if (error) throw error;
  const files = (rows ?? []).map((r: any) => ({ file: r.path, sha: r.sha, size: r.size }));
  const res = await fetch(`https://api.vercel.com/v13/deployments${teamQS}&forceNew=1`, {
    method: "POST",
    headers: vercelHeaders(),
    body: JSON.stringify({
      name: VERCEL_PROJECT_NAME,
      project: VERCEL_STATIC_PROJECT_ID,
      target: "production",
      files,
      projectSettings: { framework: null, outputDirectory: null },
      meta: { reason },
    }),
  });
  if (!res.ok) throw new Error(`vercel deploy failed ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { id: j.id, url: j.url };
}

/**
 * ONE manifest.json publication per event. Skipped entirely when nothing
 * changed and nothing was removed (never regenerate an unchanged manifest).
 */
async function publishManifest(changed: string[], removed: string[]): Promise<number | null> {
  if (changed.length === 0 && removed.length === 0) return null;
  const version = Date.now();
  let entities: Record<string, number> = {};
  try {
    const r = await fetch(`${CDN_BASE}/manifest.json`, { cache: "no-store" });
    if (r.ok) entities = (await r.json())?.entities ?? {};
  } catch { /* first run */ }
  for (const p of changed) entities[p] = version;
  for (const p of removed) delete entities[p];

  const manifest = {
    version,
    generated_at: new Date().toISOString(),
    entities,
    tombstones: removed.map((p) => p.replace(/\.json$/, "")),
    changed: Array.from(new Set([...changed, ...removed.map((p) => `-${p}`)])),
    hash: await sha256(JSON.stringify(entities)),
  };
  const raw = new TextEncoder().encode(JSON.stringify(manifest));
  const { sha, size } = await uploadFile(raw);
  await admin.from("static_file_registry").upsert(
    {
      path: "manifest.json", sha, size,
      content_type: "application/json",
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "path" },
  );
  await admin.from("static_manifest").upsert(
    {
      path: "manifest", version, hash: manifest.hash, size,
      generated_at: new Date().toISOString(), status: "ok",
    } as never,
    { onConflict: "path" },
  );
  return version;
}

// --------------- Queries (all memoised through ctx.query) ---------------

const PRODUCT_COLS = `
  id,slug,title,description,price,currency_symbol,images,video_url,video_thumbnail,
  category,status,views,created_at,updated_at,seller_id,shop_id,
  minimum_quantity,unlimited_quantity,quantity,contact_call,contact_whatsapp,
  admin_posted,admin_shop_name,
  seller:profiles!products_seller_id_fkey(id,full_name,profile_image,whatsapp_number,call_number),
  shop:shops(id,name,logo_url,slug)
`;

type Sort = "created" | "views";

function productsQuery(sort: Sort, limit: number, sponsored = false) {
  let q = admin.from("products").select(PRODUCT_COLS).eq("status", "active");
  if (sponsored) q = q.eq("sponsored", true);
  if (sort === "created") q = q.order("created_at", { ascending: false });
  if (sort === "views") q = q.order("views", { ascending: false, nullsFirst: false });
  return q.limit(limit);
}

/**
 * Products are fetched ONCE per (sort, sponsored) pair per event, at the
 * largest limit any generator needs, then sliced. This removes the repeated
 * `GET /products` calls that previously came from lists + feeds + homepage.
 */
function products(ctx: RunContext, sort: Sort, limit: number, sponsored = false): Promise<any[]> {
  const cap = sort === "created" && !sponsored ? 1000 : 100;
  const key = `products:${sort}:${sponsored}:${cap}`;
  return ctx.query(key, async () => {
    const { data, error } = await productsQuery(sort, cap, sponsored);
    if (error) throw error;
    return data ?? [];
  }).then((rows: any[]) => rows.slice(0, limit));
}

function categoriesAll(ctx: RunContext): Promise<any[]> {
  return ctx.query("categories:all", async () => {
    const { data } = await admin.from("categories").select("*").order("name");
    return data ?? [];
  });
}

function servicesBy(ctx: RunContext, sort: "created" | "views"): Promise<any[]> {
  return ctx.query(`services:${sort}`, async () => {
    const cols = `*, provider:profiles!services_provider_id_fkey(id,full_name,profile_image)`;
    let q = admin.from("services").select(cols).eq("status", "active");
    q = sort === "created"
      ? q.order("created_at", { ascending: false })
      : q.order("views", { ascending: false, nullsFirst: false });
    const { data } = await q.limit(100);
    return data ?? [];
  });
}

function articlesBy(ctx: RunContext, sort: "published" | "views"): Promise<any[]> {
  return ctx.query(`articles:${sort}`, async () => {
    let q = admin.from("insight_articles").select("*").eq("status", "published");
    q = sort === "published"
      ? q.order("published_at", { ascending: false })
      : q.order("views", { ascending: false, nullsFirst: false });
    const { data } = await q.limit(100);
    return data ?? [];
  });
}

function categoryProducts(ctx: RunContext, category: string): Promise<any[]> {
  return ctx.query(`products:category:${category}`, async () => {
    const { data, error } = await admin
      .from("products").select(PRODUCT_COLS)
      .eq("status", "active").eq("category", category)
      .order("created_at", { ascending: false }).limit(2000);
    if (error) throw error;
    return data ?? [];
  });
}

// --------------- Generators (each wrapped in ctx.task) ---------------

const card = (p: any) => ({
  id: p.id, slug: p.slug, title: p.title, price: p.price,
  currency_symbol: p.currency_symbol, category: p.category,
  images: Array.isArray(p.images) ? p.images.slice(0, 1) : [],
  views: p.views, created_at: p.created_at,
});

/**
 * Listing projection: only the fields the listing UI (ProductCard, home
 * sections, category grid) actually reads. Drops long `description`,
 * `updated_at` and extra gallery images — those live in the detail files.
 */
const listCard = (p: any) => ({
  id: p.id, slug: p.slug, title: p.title, price: p.price,
  currency_symbol: p.currency_symbol, category: p.category,
  images: Array.isArray(p.images) ? p.images.slice(0, 2) : [],
  video_url: p.video_url ?? null, video_thumbnail: p.video_thumbnail ?? null,
  views: p.views, created_at: p.created_at,
  seller_id: p.seller_id, shop_id: p.shop_id,
  quantity: p.quantity, minimum_quantity: p.minimum_quantity,
  unlimited_quantity: p.unlimited_quantity,
  contact_call: p.contact_call, contact_whatsapp: p.contact_whatsapp,
  admin_posted: p.admin_posted, admin_shop_name: p.admin_shop_name,
  seller: p.seller ?? null, shop: p.shop ?? null,
});

/** Rows kept in the public listing feeds (UI shows at most ~24 per section). */
const LIST_LIMIT = 60;

function genProductLists(ctx: RunContext) {
  return ctx.task("product-lists", async () => {
    const [all, latest, featured, popular, trending] = await Promise.all([
      products(ctx, "created", 1000),
      products(ctx, "created", LIST_LIMIT),
      products(ctx, "created", 100, true),
      products(ctx, "views", LIST_LIMIT),
      products(ctx, "views", 100),
    ]);
    const searchIndex = latest.concat(featured, popular, trending).reduce((acc: any[], p: any) => {
      if (acc.find((x) => x.id === p.id)) return acc;
      acc.push({
        id: p.id, slug: p.slug, title: p.title, price: p.price,
        category: p.category, image: Array.isArray(p.images) ? p.images[0] : null,
      });
      return acc;
    }, []);
    return [
      ctx.stage("products/all.json", all.map(card)),
      ctx.stage("products/latest.json", latest.map(listCard)),
      ctx.stage("products/featured.json", featured),
      ctx.stage("products/popular.json", popular.map(listCard)),
      ctx.stage("products/trending.json", trending),
      ctx.stage("products/search-index.json", searchIndex),
    ];
  });
}

function genFeeds(ctx: RunContext) {
  return ctx.task("feeds", async () => {
    const [latest, popular, trending, featured] = await Promise.all([
      products(ctx, "created", 100),
      products(ctx, "views", 100),
      products(ctx, "views", 100),
      products(ctx, "created", 100, true),
    ]);
    return [
      ctx.stage("feeds/latest.json", latest),
      ctx.stage("feeds/popular.json", popular),
      ctx.stage("feeds/trending.json", trending),
      ctx.stage("feeds/featured.json", featured),
    ];
  });
}

function genSearchIndex(ctx: RunContext) {
  return ctx.task("search", async () => {
    const [prods, svcs, arts] = await Promise.all([
      products(ctx, "created", 1000),
      servicesBy(ctx, "created"),
      articlesBy(ctx, "published"),
    ]);
    const index = [
      ...prods.map((p: any) => ({
        kind: "product", id: p.id, slug: p.slug, title: p.title,
        category: p.category, price: p.price,
        thumb: Array.isArray(p.images) ? p.images[0] : null,
      })),
      ...svcs.map((s: any) => ({ kind: "service", id: s.id, slug: s.slug, title: s.title, category: s.category })),
      ...arts.map((a: any) => ({ kind: "article", id: a.id, slug: a.slug, title: a.title, category: a.category })),
    ];
    return [ctx.stage("search/search-index.json", index)];
  });
}

function genHomepage(ctx: RunContext) {
  return ctx.task("homepage", async () => {
    const [latest, popular, featured, cats] = await Promise.all([
      products(ctx, "created", 24),
      products(ctx, "views", 24),
      products(ctx, "created", 12, true),
      categoriesAll(ctx),
    ]);
    return [ctx.stage("homepage.json", { latest, popular, featured, categories: cats.slice(0, 24) })];
  });
}

function genServices(ctx: RunContext) {
  return ctx.task("services", async () => {
    const [latest, trending] = await Promise.all([
      servicesBy(ctx, "created"),
      servicesBy(ctx, "views"),
    ]);
    return [
      ctx.stage("services/latest.json", latest),
      ctx.stage("services/featured.json", latest),
      ctx.stage("services/trending.json", trending),
    ];
  });
}

function genReels(ctx: RunContext) {
  return ctx.task("reels", async () => {
    const cols = `
      id,title,description,price,currency_symbol,video_url,video_thumbnail,images,slug,
      seller_id,shop_id,contact_call,contact_whatsapp,minimum_quantity,unlimited_quantity,
      quantity,views,admin_posted,admin_shop_name,created_at,
      seller:profiles!products_seller_id_fkey(id,full_name,profile_image,whatsapp_number,call_number),
      shop:shops(id,name,logo_url,slug)
    `;
    const [latest, trending] = await Promise.all([
      ctx.query("reels:created", async () => {
        const { data } = await admin.from("products").select(cols)
          .not("video_url", "is", null).neq("video_url", "").eq("status", "active")
          .order("created_at", { ascending: false }).limit(100);
        return data ?? [];
      }),
      ctx.query("reels:views", async () => {
        const { data } = await admin.from("products").select(cols)
          .not("video_url", "is", null).neq("video_url", "").eq("status", "active")
          .order("views", { ascending: false, nullsFirst: false }).limit(100);
        return data ?? [];
      }),
    ]);
    return [
      ctx.stage("reels/latest.json", latest),
      ctx.stage("reels/trending.json", trending),
    ];
  });
}

/** Listing projection for article lists — drops the full `content` body. */
const articleCard = (a: any) => ({
  id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt,
  thumbnail_url: a.thumbnail_url, category_id: a.category_id,
  author_id: a.author_id, published_at: a.published_at,
  views: a.views, reading_time_minutes: a.reading_time_minutes,
  is_featured: a.is_featured ?? null, status: a.status,
});

const ARTICLE_LIST_LIMIT = 48;

function genArticles(ctx: RunContext) {
  return ctx.task("articles", async () => {
    const [latest, trending] = await Promise.all([
      articlesBy(ctx, "published"),
      articlesBy(ctx, "views"),
    ]);
    return [
      ctx.stage("articles/latest.json", latest.slice(0, ARTICLE_LIST_LIMIT).map(articleCard)),
      ctx.stage("articles/trending.json", trending),
    ];
  });
}

function genCategories(ctx: RunContext) {
  return ctx.task("categories", async () => {
    const [all, serviceCats, insightCats] = await Promise.all([
      categoriesAll(ctx),
      ctx.query("categories:services", async () => {
        const { data } = await admin.from("service_categories").select("*").order("name");
        return data ?? [];
      }),
      ctx.query("categories:insights", async () => {
        const { data } = await admin.from("insight_categories").select("*").order("name");
        return data ?? [];
      }),
    ]);
    return [
      ctx.stage("categories/all.json", all),
      ctx.stage("categories/menu.json", all.filter((c: any) => c.show_in_menu ?? true)),
      ctx.stage("categories/home.json", all.slice(0, 12)),
      ctx.stage("categories/services.json", serviceCats),
      ctx.stage("categories/insights.json", insightCats),
    ];
  });
}

function genShops(ctx: RunContext) {
  return ctx.task("shops", async () => {
    const rows = await ctx.query("shops:all", async () => {
      const { data } = await admin.from("shops").select("*")
        .order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    });
    return [ctx.stage("shops/all.json", rows)];
  });
}

const PAGE_SIZE = 40;

function genCategoryBundle(ctx: RunContext, category: string) {
  if (!category) return Promise.resolve([]);
  return ctx.task(`category:${category}`, async () => {
    const rows = await categoryProducts(ctx, category);
    const out = [ctx.stage(`products/category/${category}.json`, rows.slice(0, 200))];
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    for (let i = 0; i < pageCount; i++) {
      out.push(ctx.stage(
        `categories/${category}/page-${i + 1}.json`,
        rows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE),
      ));
    }
    out.push(ctx.stage(`categories/${category}/index.json`, {
      total: rows.length, pageCount, pageSize: PAGE_SIZE,
    }));
    return out;
  });
}

function genProductDetail(ctx: RunContext, slugOrId: string) {
  if (!slugOrId) return Promise.resolve([]);
  return ctx.task(`product-detail:${slugOrId}`, async () => {
    const data = await ctx.query(`product:${slugOrId}`, async () => {
      const { data } = await admin.from("products").select(PRODUCT_COLS)
        .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
      return data;
    });
    if (!data) return [];
    const key = (data as any).slug ?? (data as any).id;
    const path = await productStaticPath(key);
    ctx.removed.add(`product/${key}`); // retire the pre-shard flat path
    return [ctx.stage(`${path}.json`, data, {
      entity: "product", entityId: (data as any).id, shard: await shardOf(key),
    })];
  });
}

function genServiceDetail(ctx: RunContext, slugOrId: string) {
  if (!slugOrId) return Promise.resolve([]);
  return ctx.task(`service-detail:${slugOrId}`, async () => {
    const data = await ctx.query(`service:${slugOrId}`, async () => {
      const { data } = await admin.from("services")
        .select(`*, provider:profiles!services_provider_id_fkey(id,full_name,profile_image)`)
        .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
      return data;
    });
    if (!data) return [];
    return [ctx.stage(`service/${(data as any).slug ?? (data as any).id}.json`, data)];
  });
}

function genArticleDetail(ctx: RunContext, slug: string) {
  if (!slug) return Promise.resolve([]);
  return ctx.task(`article-detail:${slug}`, async () => {
    const data = await ctx.query(`article:${slug}`, async () => {
      const { data } = await admin.from("insight_articles").select("*").eq("slug", slug).maybeSingle();
      return data;
    });
    if (!data) return [];
    return [ctx.stage(`article/${(data as any).slug}.json`, data)];
  });
}

function genShopDetail(ctx: RunContext, slugOrId: string) {
  if (!slugOrId) return Promise.resolve([]);
  return ctx.task(`shop-detail:${slugOrId}`, async () => {
    const data = await ctx.query(`shop:${slugOrId}`, async () => {
      const { data } = await admin.from("shops").select("*")
        .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).maybeSingle();
      return data;
    });
    if (!data) return [];
    return [ctx.stage(`shops/${(data as any).slug ?? (data as any).id}.json`, data)];
  });
}

function genSellerDetail(ctx: RunContext, id: string) {
  if (!id) return Promise.resolve([]);
  return ctx.task(`seller-detail:${id}`, async () => {
    const data = await ctx.query(`seller:${id}`, async () => {
      const { data } = await admin.from("profiles")
        .select("id,full_name,profile_image,bio,whatsapp_number,call_number,created_at")
        .eq("id", id).maybeSingle();
      return data;
    });
    if (!data) return [];
    return [ctx.stage(`sellers/${(data as any).id}.json`, data)];
  });
}

// --------------- Job planning ---------------

interface Job {
  entity: string;
  slug?: string | null;
  id?: string | null;
  category?: string | null;
  op?: string | null;
}

function normalizeJobs(body: any): Job[] {
  const raw: any[] = Array.isArray(body?.jobs) && body.jobs.length > 0 ? body.jobs : [body ?? {}];
  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const j of raw) {
    const job: Job = {
      entity: String(j?.entity ?? ""),
      slug: j?.slug ?? null,
      id: j?.id ?? null,
      category: j?.category ?? null,
      op: j?.op ? String(j.op).toUpperCase() : null,
    };
    if (!job.entity) continue;
    const k = `${job.entity}|${job.slug ?? job.id ?? ""}|${job.category ?? ""}|${job.op ?? ""}`;
    if (seen.has(k)) continue; // duplicate job inside the same event
    seen.add(k);
    jobs.push(job);
  }
  return jobs;
}

async function eventIdFor(jobs: Job[]): Promise<string> {
  const sig = jobs
    .map((j) => `${j.entity}|${j.slug ?? j.id ?? ""}|${j.category ?? ""}|${j.op ?? ""}`)
    .sort()
    .join(";");
  return (await sha256(sig)).slice(0, 32);
}

async function runJobs(ctx: RunContext, jobs: Job[]): Promise<void> {
  const reelsOn = await isFeatureEnabled("reels_module");
  const articlesOn = await isFeatureEnabled("articles_module");

  for (const job of jobs) {
    const { entity, slug, id, category } = job;
    const isDelete = job.op === "DELETE";
    if (!(await isEntityAllowed(entity))) continue;
    const key = slug ?? id ?? null;

    if (isDelete && key) {
      switch (entity) {
        case "product":
        case "reel":
          ctx.removed.add(await productStaticPath(key));
          ctx.removed.add(`product/${key}`);
          break;
        case "service": ctx.removed.add(`service/${key}`); break;
        case "article": ctx.removed.add(`article/${key}`); break;
        case "shop": ctx.removed.add(`shops/${key}`); break;
        case "seller": ctx.removed.add(`sellers/${key}`); break;
      }
    }

    switch (entity) {
      case "product":
        await genProductLists(ctx); await genFeeds(ctx);
        await genSearchIndex(ctx); await genHomepage(ctx);
        if (!isDelete && key) await genProductDetail(ctx, key);
        if (category) await genCategoryBundle(ctx, category);
        break;
      case "service":
        await genServices(ctx); await genSearchIndex(ctx); await genHomepage(ctx);
        if (!isDelete && key) await genServiceDetail(ctx, key);
        break;
      case "reel":
        if (reelsOn) await genReels(ctx);
        await genProductLists(ctx); await genHomepage(ctx);
        if (!isDelete && key) await genProductDetail(ctx, key);
        break;
      case "article":
        if (articlesOn) await genArticles(ctx);
        await genSearchIndex(ctx); await genHomepage(ctx);
        if (!isDelete && slug) await genArticleDetail(ctx, slug);
        break;
      case "category":
        await genCategories(ctx); await genHomepage(ctx);
        if (category) await genCategoryBundle(ctx, category);
        break;
      case "category-page":
        if (category) await genCategoryBundle(ctx, category);
        break;
      case "shop":
        await genShops(ctx); await genHomepage(ctx);
        if (!isDelete && key) await genShopDetail(ctx, key);
        break;
      case "seller":
        await genHomepage(ctx);
        if (!isDelete && key) await genSellerDetail(ctx, key);
        break;
      case "homepage": await genHomepage(ctx); break;
      case "feeds": await genFeeds(ctx); break;
      case "search": await genSearchIndex(ctx); break;
      case "all":
        await genProductLists(ctx); await genServices(ctx);
        if (reelsOn) await genReels(ctx);
        if (articlesOn) await genArticles(ctx);
        await genCategories(ctx); await genFeeds(ctx);
        await genSearchIndex(ctx); await genHomepage(ctx); await genShops(ctx);
        break;
      default:
        throw new Error(`unknown entity: ${entity}`);
    }
  }
}

// --------------- Metrics (one write per event) ---------------

async function bumpMetrics(patch: Record<string, number>) {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("generation_metrics_daily").select("*").eq("day", day).maybeSingle();
  const base: Record<string, any> = data ?? { day };
  const next: Record<string, unknown> = { ...base, day, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) next[k] = ((base[k] as number) ?? 0) + v;
  await admin.from("generation_metrics_daily").upsert(next as never, { onConflict: "day" });
}

// --------------- Event-aware optimistic lock ---------------

const LOCK_NAME = "static-generate";
const LOCK_TTL_MS = 120_000;
/** Identical events completed within this window are treated as duplicates. */
const RECENT_EVENT_WINDOW_MS = 60_000;

type LockResult =
  | { ok: true }
  | { ok: false; reason: "duplicate_event" | "generator_busy" };

async function acquireLock(ctx: RunContext, holder: string): Promise<LockResult> {
  const now = new Date();
  // Read the current lock (optimistic check before racing an insert).
  const { data: current } = await admin
    .from("generation_locks").select("name,event_id,expires_at").eq("name", LOCK_NAME).maybeSingle();

  if (current && new Date(current.expires_at as string) > now) {
    // An identical event is already generating → skip, do not queue.
    if (current.event_id === ctx.eventId) return { ok: false, reason: "duplicate_event" };
    return { ok: false, reason: "generator_busy" };
  }
  if (current) {
    // Expired lock from a crashed run — reclaim it atomically.
    await admin.from("generation_locks").delete().eq("name", LOCK_NAME).lt("expires_at", now.toISOString());
  }
  const { error } = await admin.from("generation_locks").insert({
    name: LOCK_NAME,
    holder,
    event_id: ctx.eventId,
    generation_id: ctx.generationId,
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
  });
  // Insert conflict = another instance won the race (optimistic locking).
  if (error) return { ok: false, reason: "generator_busy" };
  return { ok: true };
}

async function releaseLock(ctx: RunContext): Promise<void> {
  await admin.from("generation_locks").delete()
    .eq("name", LOCK_NAME).eq("generation_id", ctx.generationId);
}

/** Was this exact event already generated moments ago? */
async function recentlyGenerated(eventId: string): Promise<boolean> {
  const since = new Date(Date.now() - RECENT_EVENT_WINDOW_MS).toISOString();
  const { data } = await admin
    .from("static_gen_log").select("id")
    .eq("event_id", eventId).eq("ok", true).gte("created_at", since).limit(1);
  return (data ?? []).length > 0;
}

// --------------- Handler ---------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ctx = new RunContext();
  let locked = false;
  const startedAt = Date.now();
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const jobs = normalizeJobs(body);
    if (jobs.length === 0) return json({ ok: false, error: "no jobs" }, 400);

    ctx.eventId = String(body?.event_id ?? await eventIdFor(jobs));

    // 1 — Deduplicate against an identical event that just finished.
    if (body?.force !== true && await recentlyGenerated(ctx.eventId)) {
      await bumpMetrics({ duplicate_requests: 1 }).catch(() => {});
      return json({ ok: true, skipped: true, reason: "duplicate_event_recent", event_id: ctx.eventId });
    }

    // 2 — One lock. Identical concurrent event ⇒ skip (never queue a clone).
    const lock = await acquireLock(ctx, jobs.map((j) => j.entity).join(","));
    if (!lock.ok) {
      if (lock.reason === "duplicate_event") {
        await bumpMetrics({ duplicate_generations: 1 }).catch(() => {});
        return json({ ok: true, skipped: true, reason: "duplicate_event_running", event_id: ctx.eventId });
      }
      // Different event, generator busy → queue once.
      try {
        await admin.rpc("enqueue_generation", {
          _entity_type: jobs[0].entity,
          _entity_id: String(jobs[0].slug ?? jobs[0].id ?? ""),
          _action: String(jobs[0].op ?? "upsert").toLowerCase(),
        });
      } catch { /* ignore */ }
      return json({ ok: true, skipped: true, reason: "generator_busy", queued: true, event_id: ctx.eventId });
    }
    locked = true;

    // 3 — One generator run (tasks + queries deduplicated internally).
    await runJobs(ctx, jobs);

    // 4 — Deletions, then 5 — one registry + one manifest batch write.
    const removed = Array.from(ctx.removed);
    if (removed.length > 0) await unstage(removed.map((p) => `${p}.json`));
    const changed = await flush(ctx);

    // 6 — One manifest.json publication (skipped when nothing changed).
    const version = await publishManifest(changed, removed);
    const deployment = version !== null ? await deploy(`event:${ctx.eventId}`) : null;

    // 7 — One log row.
    await admin.from("static_gen_log").insert({
      entity: jobs.map((j) => j.entity).join(","),
      slug: jobs[0].slug ?? jobs[0].id ?? null,
      category: jobs[0].category ?? null,
      paths: [...changed, ...removed.map((p) => `-${p}`)],
      version,
      ok: true,
      event_id: ctx.eventId,
      generation_id: ctx.generationId,
      duration_ms: Date.now() - startedAt,
    });

    await bumpMetrics({
      events_processed: 1,
      generations_run: 1,
      files_generated: ctx.stats.written,
      files_skipped: ctx.stats.skipped,
      db_reads: ctx.stats.dbReads,
      bytes_written: ctx.stats.bytesWritten,
      bytes_saved: ctx.stats.bytesSaved,
    }).catch(() => {});

    return json({
      ok: true,
      event_id: ctx.eventId,
      generation_id: ctx.generationId,
      jobs: jobs.length,
      paths: changed,
      removed,
      unchanged: ctx.stats.skipped,
      deployment,
      stats: ctx.stats,
    });
  } catch (e) {
    const msg = (e as Error).message;
    try {
      await admin.from("static_gen_log").insert({
        entity: "error", paths: [], ok: false, error: msg,
        event_id: ctx.eventId || null, generation_id: ctx.generationId,
      });
    } catch { /* ignore */ }
    await bumpMetrics({ errors: 1 }).catch(() => {});
    return json({ ok: false, error: msg }, 500);
  } finally {
    // 8 — Unlock exactly once, only if we own it.
    if (locked) await releaseLock(ctx);
  }
});
