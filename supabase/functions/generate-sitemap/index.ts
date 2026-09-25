import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://p4nohub.vercel.app";
const PAGE_SIZE = 5000;

const esc = (s: string | null | undefined): string =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const isHttpUrl = (s: unknown): s is string =>
  typeof s === "string" && /^https?:\/\//i.test(s);

const today = () => new Date().toISOString().split("T")[0];
const day = (d: string | null | undefined) => (d ? d.split("T")[0] : today());

function xmlResponse(body: string, cache = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400") {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": cache,
    },
  });
}

function urlsetOpen(extraNs = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNs}>\n`;
}
const URLSET_CLOSE = `</urlset>`;

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string, extra = "") {
  return `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n${extra}  </url>\n`;
}

function imageTag(loc: string, title?: string, caption?: string) {
  return `    <image:image>\n      <image:loc>${esc(loc)}</image:loc>\n${title ? `      <image:title>${esc(title)}</image:title>\n` : ""}${caption ? `      <image:caption>${esc(caption)}</image:caption>\n` : ""}    </image:image>\n`;
}

// ------- Per-type generators -------

async function genStatic() {
  const now = today();
  const pages = [
    ["/", "1.0", "daily"],
    ["/connect", "0.9", "daily"],
    ["/connect/reels", "0.7", "daily"],
    ["/reels", "0.8", "daily"],
    ["/insights", "0.9", "daily"],
    ["/help", "0.5", "monthly"],
    ["/support", "0.5", "monthly"
    ["/rewards", "0.5", "weekly"],
  ] as const;
  let xml = urlsetOpen();
  for (const [loc, prio, freq] of pages) {
    xml += urlEntry(`${SITE_URL}${loc}`, now, freq, prio);
  }
  return xml + URLSET_CLOSE;
}

async function genPages(sb: any) {
  const now = today();
  let xml = urlsetOpen();
  const seen = new Set<string>();

  const add = (
    path: string,
    lastmod: string,
    freq: string,
    prio: string,
  ) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    xml += urlEntry(`${SITE_URL}${path}`, lastmod, freq, prio);
  };

  // 1) Canonical static + SEO landing routes (always indexed)
  const STATIC_SEO_ROUTES: Array<[string, string, string]> = [
    ["/", "daily", "1.0"],
    ["/search", "daily", "0.7"],
    ["/connect", "daily", "0.9"],
    ["/connect/reels", "daily", "0.7"],
    ["/reels", "daily", "0.8"],
    ["/insights", "daily", "0.9"],
    ["/agriculture", "daily", "0.7"],
    ["/rent", "daily", "0.7"],
    ["/assets", "daily", "0.7"],
    ["/help", "monthly", "0.5"],
    ["/support", "monthly", "0.5"]
    ["/challenges", "weekly", "0.5"],
    ["/rewards", "weekly", "0.5"],
    ["/about", "monthly", "0.6"],
    ["/contact", "monthly", "0.5"],
    ["/privacy-policy", "yearly", "0.3"],
    ["/terms", "yearly", "0.3"],
    ["/sellers", "weekly", "0.7"],
    ["/categories", "weekly", "0.7"],
    ["/local-business-directory", "weekly", "0.7"],
  ];
  for (const [path, freq, prio] of STATIC_SEO_ROUTES) {
    add(path, now, freq, prio);
  }

  // 2) Admin-managed SEO landing pages (site_pages table)
  try {
    const { data: sitePages } = await sb
      .from("site_pages")
      .select("slug, updated_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .limit(PAGE_SIZE);
    for (const p of sitePages || []) {
      if (!p.slug) continue;
      // SitePage is reached either via /page/:slug or /:slug (DynamicSlugPage)
      add(`/${p.slug}`, day(p.updated_at), "weekly", "0.7");
    }
  } catch (e) {
    console.error("site_pages fetch failed", e);
  }

  // 3) Help articles (long-form support content)
  try {
    const { data: helpArticles } = await sb
      .from("help_articles")
      .select("slug, updated_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .limit(PAGE_SIZE);
    for (const p of helpArticles || []) {
      if (!p.slug) continue;
      add(`/page/${p.slug}`, day(p.updated_at), "monthly", "0.5");
    }
  } catch (e) {
    console.error("help_articles fetch failed", e);
  }

  return xml + URLSET_CLOSE;
}

async function genProducts(sb: any, page: number) {
  const from = (page - 1) * PAGE_SIZE;
  const { data } = await sb
    .from("products")
    .select("slug, updated_at, title, description, images, seo_title, seo_description, seo_image")
    .in("status", ["approved", "active"])
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  let xml = urlsetOpen(`\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`);
  const seen = new Set<string>();
  for (const p of data || []) {
    if (!p.slug || seen.has(p.slug)) continue;
    seen.add(p.slug);
    const title = p.seo_title || p.title;
    const desc = (p.seo_description || p.description || p.title || "").substring(0, 160);
    const imgs: string[] = [];
    if (isHttpUrl(p.seo_image)) imgs.push(p.seo_image);
    if (Array.isArray(p.images)) for (const i of p.images) if (isHttpUrl(i) && !imgs.includes(i)) imgs.push(i);
    let extra = "";
    for (const i of imgs.slice(0, 5)) extra += imageTag(i, title, desc);
    xml += urlEntry(`${SITE_URL}/product/${p.slug}`, day(p.updated_at), "weekly", "0.8", extra);
  }
  return xml + URLSET_CLOSE;
}

async function genCategories(sb: any) {
  const { data } = await sb
    .from("categories")
    .select("slug, created_at, name")
    .not("slug", "is", null);
  let xml = urlsetOpen();
  for (const c of data || []) {
    if (!c.slug) continue;
    xml += urlEntry(`${SITE_URL}/category/${c.slug}`, day(c.created_at), "weekly", "0.7");
  }
  return xml + URLSET_CLOSE;
}

async function genServices(sb: any, page: number) {
  const from = (page - 1) * PAGE_SIZE;
  const { data } = await sb
    .from("services")
    .select("id, slug, updated_at, title, short_description, description, images, video_thumbnail")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  let xml = urlsetOpen(`\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`);
  const seen = new Set<string>();
  for (const s of data || []) {
    const key = s.slug || s.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const title = s.title;
    const desc = (s.short_description || s.description || s.title || "").substring(0, 160);
    const imgs: string[] = [];
    if (Array.isArray(s.images)) for (const i of s.images) if (isHttpUrl(i) && !imgs.includes(i)) imgs.push(i);
    if (isHttpUrl(s.video_thumbnail) && !imgs.includes(s.video_thumbnail)) imgs.push(s.video_thumbnail);
    let extra = "";
    for (const i of imgs.slice(0, 5)) extra += imageTag(i, title, desc);
    xml += urlEntry(`${SITE_URL}/connect/service/${key}`, day(s.updated_at), "weekly", "0.8", extra);
  }
  return xml + URLSET_CLOSE;
}

async function genServiceCategories(sb: any) {
  const { data } = await sb
    .from("service_categories")
    .select("slug, created_at, name")
    .eq("is_active", true)
    .not("slug", "is", null);
  let xml = urlsetOpen();
  for (const c of data || []) {
    if (!c.slug) continue;
    xml += urlEntry(`${SITE_URL}/connect/category/${c.slug}`, day(c.created_at), "weekly", "0.6");
  }
  return xml + URLSET_CLOSE;
}

async function genProviders(sb: any) {
  const { data } = await sb
    .from("profiles")
    .select("slug, full_name, updated_at, profile_image")
    .not("slug", "is", null)
    .limit(PAGE_SIZE);
  let xml = urlsetOpen(`\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`);
  for (const p of data || []) {
    if (!p.slug) continue;
    let extra = "";
    if (isHttpUrl(p.profile_image)) extra += imageTag(p.profile_image, p.full_name || undefined);
    xml += urlEntry(`${SITE_URL}/connect/provider/slug/${p.slug}`, day(p.updated_at), "weekly", "0.6", extra);
  }
  return xml + URLSET_CLOSE;
}

async function genShops(sb: any) {
  const { data } = await sb
    .from("shops")
    .select("id, updated_at, name, logo_url, cover_image_url, description")
    .eq("is_active", true)
    .limit(PAGE_SIZE);
  let xml = urlsetOpen(`\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`);
  for (const s of data || []) {
    if (!s.id) continue;
    const imgs: string[] = [];
    if (isHttpUrl(s.cover_image_url)) imgs.push(s.cover_image_url);
    if (isHttpUrl(s.logo_url) && !imgs.includes(s.logo_url)) imgs.push(s.logo_url);
    let extra = "";
    for (const i of imgs) extra += imageTag(i, s.name || undefined, (s.description || "").substring(0, 160));
    xml += urlEntry(`${SITE_URL}/shop/${s.id}`, day(s.updated_at), "weekly", "0.6", extra);
  }
  return xml + URLSET_CLOSE;
}

async function genReels(sb: any, page: number) {
  const from = (page - 1) * PAGE_SIZE;
  const { data } = await sb
    .from("products")
    .select("id, slug, updated_at, created_at, title, description, video_url, video_thumbnail, images")
    .eq("status", "active")
    .not("video_url", "is", null)
    .neq("video_url", "")
    .order("updated_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  let xml = urlsetOpen(`\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"`);
  const seen = new Set<string>();
  for (const r of data || []) {
    const key = r.slug || r.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const title = r.title || "Reel";
    const desc = (r.description || r.title || "P4NO reel").substring(0, 1900);
    const thumb = isHttpUrl(r.video_thumbnail)
      ? r.video_thumbnail
      : (Array.isArray(r.images) && isHttpUrl(r.images[0]) ? r.images[0] : null);
    const loc = `${SITE_URL}/reels/${key}`;
    let extra = "";
    if (thumb) extra += imageTag(thumb, title, desc.substring(0, 160));
    if (isHttpUrl(r.video_url) && thumb) {
      extra += `    <video:video>\n`;
      extra += `      <video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc>\n`;
      extra += `      <video:title>${esc(title.substring(0, 100))}</video:title>\n`;
      extra += `      <video:description>${esc(desc.substring(0, 2000))}</video:description>\n`;
      extra += `      <video:content_loc>${esc(r.video_url)}</video:content_loc>\n`;
      extra += `      <video:publication_date>${(r.created_at || r.updated_at || new Date().toISOString())}</video:publication_date>\n`;
      extra += `      <video:family_friendly>yes</video:family_friendly>\n`;
      extra += `      <video:live>no</video:live>\n`;
      extra += `    </video:video>\n`;
    }
    xml += urlEntry(loc, day(r.updated_at), "weekly", "0.7", extra);
  }
  return xml + URLSET_CLOSE;
}

async function genArticles(sb: any, page: number) {
  const from = (page - 1) * PAGE_SIZE;
  const { data } = await sb
    .from("insight_articles")
    .select("slug, updated_at, published_at, title, meta_description, excerpt, thumbnail_url, og_image_url")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .not("slug", "is", null)
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  let xml = urlsetOpen(`\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`);
  const seen = new Set<string>();
  for (const a of data || []) {
    if (!a.slug || seen.has(a.slug)) continue;
    seen.add(a.slug);
    const title = a.title;
    const desc = (a.meta_description || a.excerpt || a.title || "").substring(0, 160);
    const img = isHttpUrl(a.og_image_url) ? a.og_image_url : (isHttpUrl(a.thumbnail_url) ? a.thumbnail_url : null);
    let extra = "";
    if (img) extra += imageTag(img, title, desc);
    xml += urlEntry(`${SITE_URL}/insights/article/${a.slug}`, day(a.updated_at || a.published_at), "weekly", "0.8", extra);
  }
  return xml + URLSET_CLOSE;
}

async function genArticleCategories(sb: any) {
  const { data } = await sb
    .from("insight_categories")
    .select("slug, name, created_at")
    .eq("is_active", true)
    .not("slug", "is", null);
  let xml = urlsetOpen();
  for (const c of data || []) {
    if (!c.slug) continue;
    xml += urlEntry(`${SITE_URL}/insights/category/${c.slug}`, day(c.created_at), "weekly", "0.6");
  }
  return xml + URLSET_CLOSE;
}

// ------- Index generator -------

async function genIndex(sb: any) {
  const now = today();
  const headCount = async (table: string, filter?: (q: any) => any) => {
    let q = sb.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count } = await q;
    return count || 0;
  };

  const [products, services, reels, articles] = await Promise.all([
    headCount("products", (q) => q.in("status", ["approved", "active"]).not("slug", "is", null)),
    headCount("services", (q) => q.eq("status", "active")),
    headCount("products", (q) => q.eq("status", "active").not("video_url", "is", null).neq("video_url", "")),
    headCount("insight_articles", (q) => q.eq("status", "published").not("slug", "is", null)),
  ]);

  const entries: Array<{ loc: string }> = [
    { loc: "/sitemaps/static.xml" },
    { loc: "/sitemaps/pages.xml" },
    { loc: "/sitemaps/categories.xml" },
    { loc: "/sitemaps/service-categories.xml" },
    { loc: "/sitemaps/article-categories.xml" },
    { loc: "/sitemaps/providers.xml" },
    { loc: "/sitemaps/shops.xml" },
  ];

  const paged = (base: string, count: number) => {
    const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    for (let i = 1; i <= pages; i++) {
      entries.push({ loc: i === 1 ? `/sitemaps/${base}.xml` : `/sitemaps/${base}.xml?page=${i}` });
    }
  };
  paged("products", products);
  paged("services", services);
  paged("reels", reels);
  paged("articles", articles);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const e of entries) {
    xml += `  <sitemap>\n    <loc>${SITE_URL}${e.loc}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>\n`;
  }
  xml += `</sitemapindex>`;
  return xml;
}

// ------- Dispatcher -------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "index";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const noCache = url.searchParams.get("nocache") === "1";

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body = "";
    switch (type) {
      case "index": body = await genIndex(sb); break;
      case "static": body = await genStatic(); break;
      case "pages": body = await genPages(sb); break;
      case "products": body = await genProducts(sb, page); break;
      case "categories": body = await genCategories(sb); break;
      case "services": body = await genServices(sb, page); break;
      case "service-categories": body = await genServiceCategories(sb); break;
      case "providers": body = await genProviders(sb); break;
      case "shops": body = await genShops(sb); break;
      case "reels": body = await genReels(sb, page); break;
      case "articles": body = await genArticles(sb, page); break;
      case "article-categories": body = await genArticleCategories(sb); break;
      default:
        return new Response(`Unknown sitemap type: ${type}`, { status: 404, headers: corsHeaders });
    }

    const cache = noCache
      ? "no-store"
      : "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
    return xmlResponse(body, cache);
  } catch (err) {
    console.error("Sitemap error:", err);
    return xmlResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      "public, max-age=60",
    );
  }
});
