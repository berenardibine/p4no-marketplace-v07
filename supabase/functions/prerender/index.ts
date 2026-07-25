// Bot pre-render shell.
// A reverse proxy / Vercel rewrite can forward requests to this function ONLY
// when the User-Agent matches a known bot. The function fetches the entity from
// Supabase and returns minimal HTML with full <title>, meta, OG and JSON-LD so
// crawlers see proper metadata without executing JS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://p4no-marketplace.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const BOT_RE = /bot|crawler|spider|googlebot|bingbot|yandex|duckduckgo|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|applebot|chatgpt|gptbot|claudebot|perplexitybot|ahrefsbot|semrushbot/i;

const esc = (s: string | null | undefined): string =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function shell(opts: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: string;
  jsonLd?: unknown[];
  bodyHtml?: string;
}) {
  const { title, description, url, image, type = "website", jsonLd = [], bodyHtml = "" } = opts;
  const fullUrl = url.startsWith("http") ? url : `${SITE_URL}${url}`;
  const ogImage = image && image.startsWith("http") ? image : `${SITE_URL}/og-preview.png?v=2`;
  const ldTags = jsonLd
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(fullUrl)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="${esc(type)}" />
<meta property="og:url" content="${esc(fullUrl)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta property="og:site_name" content="P4NO" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(ogImage)}" />
${ldTags}
</head>
<body>
<header><a href="${SITE_URL}">P4NO</a></header>
<main>
<h1>${esc(title)}</h1>
${bodyHtml}
</main>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ua = req.headers.get("user-agent") || "";
  const url = new URL(req.url);
  const path = (url.searchParams.get("path") || url.pathname.replace(/^\/prerender/, "") || "/").trim();

  // If not a bot and no explicit ?force=1, return a 200 redirect hint to the SPA.
  if (!BOT_RE.test(ua) && url.searchParams.get("force") !== "1") {
    return new Response(null, { status: 302, headers: { Location: `${SITE_URL}${path}` } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Route → entity
    const reelM = path.match(/^\/reels\/([^/?#]+)$/);
    const prodM = path.match(/^\/(?:product|products|p)\/([^/?#]+)$/);
    const svcM = path.match(/^\/connect\/service\/([^/?#]+)$/);
    const provSlugM = path.match(/^\/connect\/provider\/slug\/([^/?#]+)$/);
    const provIdM = path.match(/^\/connect\/provider\/([^/?#]+)$/);
    const catM = path.match(/^\/category\/([^/?#]+)/);
    const insightM = path.match(/^\/insights\/article\/([^/?#]+)$/);
    const insightCatM = path.match(/^\/insights\/category\/([^/?#]+)/);

    if (insightM) {
      const slug = insightM[1];
      const { data: a } = await supabase
        .from("insight_articles")
        .select("id,slug,title,excerpt,meta_title,meta_description,thumbnail_url,og_image_url,published_at,updated_at,body_html,author_id,category_id, category:insight_categories(name,slug)")
        .eq("slug", slug).maybeSingle();
      if (!a) return notFound(path);
      const canonical = `/insights/article/${a.slug}`;
      const image = a.og_image_url || a.thumbnail_url || null;
      const description = (a.meta_description || a.excerpt || a.title || "").slice(0, 160);
      const title = a.meta_title || `${a.title} — P4NO Insights`;
      return html(shell({
        title, description, url: canonical, image, type: "article",
        jsonLd: [{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description,
          image: image ? [image] : undefined,
          datePublished: a.published_at,
          dateModified: a.updated_at,
          articleSection: (a as any).category?.name,
          mainEntityOfPage: `${SITE_URL}${canonical}`,
          publisher: { "@type": "Organization", name: "P4NO" },
        }],
        bodyHtml: `<p>${esc(description)}</p>${image ? `<img src="${esc(image)}" alt="${esc(a.title)}" />` : ""}`,
      }));
    }

    if (insightCatM) {
      const slug = insightCatM[1];
      const { data: c } = await supabase.from("insight_categories").select("name,slug,description").eq("slug", slug).maybeSingle();
      if (!c) return notFound(path);
      return html(shell({
        title: `${c.name} — P4NO Insights`,
        description: c.description || `Read ${c.name} articles on P4NO Insights.`,
        url: `/insights/category/${c.slug}`,
        type: "website",
      }));
    }

    if (reelM || prodM) {
      const key = (reelM || prodM)![1];
      const isReel = !!reelM;
      const isUuid = /^[0-9a-f-]{36}$/i.test(key);
      const q = supabase
        .from("products")
        .select("id,slug,title,description,price,currency_symbol,images,video_url,video_thumbnail,created_at");
      const { data: p } = await (isUuid ? q.eq("id", key) : q.eq("slug", key)).maybeSingle();
      if (!p) return notFound(path);
      const canonical = isReel ? `/reels/${p.slug || p.id}` : `/product/${p.slug || p.id}`;
      const image = p.video_thumbnail || (Array.isArray(p.images) ? p.images[0] : null);
      const title = isReel ? `${p.title} – Video on P4NO` : `${p.title} | P4NO`;
      const description = (p.description || p.title || "").slice(0, 160);
      const jsonLd: unknown[] = [];
      if (isReel && p.video_url) {
        jsonLd.push({
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: p.title,
          description,
          thumbnailUrl: [image],
          contentUrl: p.video_url,
          uploadDate: p.created_at,
        });
      } else {
        jsonLd.push({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description,
          image: image ? [image] : undefined,
          offers: p.price ? { "@type": "Offer", price: p.price, priceCurrency: p.currency_symbol || "USD", availability: "https://schema.org/InStock", url: `${SITE_URL}${canonical}` } : undefined,
        });
      }
      return html(shell({ title, description, url: canonical, image, type: isReel ? "video.other" : "product", jsonLd, bodyHtml: `<p>${esc(description)}</p>${image ? `<img src="${esc(image)}" alt="${esc(p.title)}" />` : ""}` }));
    }

    if (svcM) {
      const key = svcM[1];
      const isUuid = /^[0-9a-f-]{36}$/i.test(key);
      const q = supabase.from("services").select("id,slug,title,description,short_description,images,video_thumbnail,price,currency_symbol");
      const { data: s } = await (isUuid ? q.eq("id", key) : q.eq("slug", key)).maybeSingle();
      if (!s) return notFound(path);
      const canonical = `/connect/service/${s.slug || s.id}`;
      const image = s.video_thumbnail || (Array.isArray(s.images) ? s.images[0] : null);
      const description = (s.short_description || s.description || s.title || "").slice(0, 160);
      return html(shell({
        title: `${s.title} | P4NO Connect`,
        description, url: canonical, image, type: "website",
        jsonLd: [{ "@context": "https://schema.org", "@type": "Service", name: s.title, description, image: image ? [image] : undefined }],
        bodyHtml: `<p>${esc(description)}</p>${image ? `<img src="${esc(image)}" alt="${esc(s.title)}" />` : ""}`,
      }));
    }

    if (provSlugM || provIdM) {
      const key = (provSlugM || provIdM)![1];
      const isUuid = /^[0-9a-f-]{36}$/i.test(key);
      const q = supabase.from("profiles").select("id,slug,full_name,bio,profile_image");
      const { data: p } = await (isUuid ? q.eq("id", key) : q.eq("slug", key)).maybeSingle();
      if (!p) return notFound(path);
      const canonical = p.slug ? `/connect/provider/slug/${p.slug}` : `/connect/provider/${p.id}`;
      const description = (p.bio || `Services by ${p.full_name} on P4NO.`).slice(0, 160);
      return html(shell({
        title: `${p.full_name} – Services on P4NO`,
        description, url: canonical, image: p.profile_image, type: "profile",
        jsonLd: [{ "@context": "https://schema.org", "@type": "Person", name: p.full_name, description, image: p.profile_image }],
        bodyHtml: `<p>${esc(description)}</p>`,
      }));
    }

    if (catM) {
      const slug = catM[1];
      const { data: c } = await supabase.from("categories").select("name,slug,seo_title,seo_description,seo_image").eq("slug", slug).maybeSingle();
      if (!c) return notFound(path);
      return html(shell({
        title: c.seo_title || `${c.name} | P4NO`,
        description: c.seo_description || `Browse ${c.name} on P4NO.`,
        url: `/category/${c.slug}`,
        image: c.seo_image,
        type: "website",
      }));
    }

    // Fallback home
    return html(shell({
      title: "P4NO – Smarter Shopping & Service Connector",
      description: "Upload your products and services, connect with trusted people globally, and grow your business with smarter digital experiences.",
      url: "/", type: "website",
    }));
  } catch (e) {
    console.error("prerender error", e);
    return html(shell({ title: "P4NO", description: "P4NO marketplace", url: path }));
  }
});

function html(body: string) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      "X-Robots-Tag": "all",
    },
  });
}

function notFound(path: string) {
  return new Response(shell({
    title: "Not found | P4NO",
    description: "This page was not found.",
    url: path,
  }), { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}