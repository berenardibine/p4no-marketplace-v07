import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_URL = (Deno.env.get("OG_SITE_URL") || "https://p4no-marketplace.vercel.app").replace(/\/$/, "");
const SITE_NAME = "p4no";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_DESCRIPTION =
  "Buy and sell products, equipment, agriculture goods and services on p4no marketplace.";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Wrap any image URL with Cloudinary OG-sized transform when applicable */
function ogImage(url: string | null | undefined): string {
  if (!url) return DEFAULT_IMAGE;
  // Cloudinary URLs → inject transformation for 1200x630 crop
  const cl = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (cl) {
    const rest = cl[2].replace(/^[^/]*\//, (seg) => /[a-z]_/.test(seg) ? "" : seg);
    return `${cl[1]}c_fill,g_auto,w_1200,h_630,f_auto,q_auto/${rest}`;
  }
  // Already absolute
  if (/^https?:\/\//i.test(url)) return url;
  return DEFAULT_IMAGE;
}

function buildOgHtml(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
  price?: string;
  currency?: string;
}) {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta property="og:type" content="${meta.type || "website"}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${t}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
  ${meta.price ? `<meta property="product:price:amount" content="${escapeHtml(meta.price)}" />` : ""}
  ${meta.currency ? `<meta property="product:price:currency" content="${escapeHtml(meta.currency)}" />` : ""}
  <link rel="canonical" href="${u}" />
</head>
<body>
  <p><a href="${u}">${t}</a></p>
  <p>${d}</p>
  <img src="${img}" alt="${t}" width="1200" height="630" />
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const htmlHeaders = {
    ...corsHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  };

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const category = url.searchParams.get("category");
    const page = url.searchParams.get("page");
    const service = url.searchParams.get("service");

    console.log("og-preview request:", { slug, category, page, service, ua: req.headers.get("user-agent") });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(buildFallbackHtml(), { headers: htmlHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Product preview ---
    if (slug) {
      const productUrl = `${SITE_URL}/p/${slug}`;
      let product = null;
      const { data: bySlug } = await supabase
        .from("products")
        .select("id, title, description, price, images, category, currency_symbol, currency_code, slug, seller_id, is_negotiable, shop_id")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      product = bySlug;

      if (!product && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
        const { data: byId } = await supabase
          .from("products")
          .select("id, title, description, price, images, category, currency_symbol, currency_code, slug, seller_id, is_negotiable, shop_id")
          .eq("id", slug).eq("status", "active").maybeSingle();
        product = byId;
      }

      if (product) {
        const image = ogImage(product.images?.[0]);
        const priceText = product.is_negotiable
          ? "Negotiable"
          : `${product.currency_symbol || ""}${Number(product.price).toLocaleString()}`;
        const desc = (product.description || DEFAULT_DESCRIPTION).substring(0, 200);

        let shopName = "";
        if (product.shop_id) {
          const { data: shop } = await supabase.from("shops").select("name").eq("id", product.shop_id).maybeSingle();
          if (shop?.name) shopName = shop.name;
        }

        const titleParts = [product.title, priceText];
        if (shopName) titleParts.push(`by ${shopName}`);
        titleParts.push(`on ${SITE_NAME}`);

        return new Response(buildOgHtml({
          title: titleParts.join(" · "),
          description: desc, image, url: productUrl,
          type: "product",
          price: String(product.price),
          currency: product.currency_code || "USD",
        }), { headers: htmlHeaders });
      }

      return new Response(buildOgHtml({
        title: `Product | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION,
        image: DEFAULT_IMAGE, url: productUrl,
      }), { headers: htmlHeaders });
    }

    // --- Service preview ---
    if (service) {
      const serviceUrl = `${SITE_URL}/connect/service/${service}`;

      let svc: any = null;
      const { data: bySlug } = await supabase
        .from("services")
        .select("id, title, description, short_description, price, images, video_thumbnail, category, currency_symbol, currency_code, slug, seller_id, pricing_type, location")
        .eq("slug", service).eq("status", "active").maybeSingle();
      svc = bySlug;

      if (!svc && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(service)) {
        const { data: byId } = await supabase
          .from("services")
          .select("id, title, description, short_description, price, images, video_thumbnail, category, currency_symbol, currency_code, slug, seller_id, pricing_type, location")
          .eq("id", service).eq("status", "active").maybeSingle();
        svc = byId;
      }

      if (svc) {
        const image = ogImage(svc.images?.[0] || svc.video_thumbnail);
        const priceText = svc.pricing_type === "negotiable"
          ? "Negotiable"
          : svc.price
            ? `${svc.pricing_type === "starting_from" ? "From " : ""}${svc.currency_symbol || ""}${Number(svc.price).toLocaleString()}`
            : "Contact for price";
        const desc = (svc.short_description || svc.description || DEFAULT_DESCRIPTION).substring(0, 200);

        let providerName = "";
        if (svc.seller_id) {
          const { data: seller } = await supabase.from("profiles").select("full_name").eq("id", svc.seller_id).maybeSingle();
          if (seller?.full_name) providerName = seller.full_name;
        }

        const titleParts = [svc.title, priceText];
        if (svc.location) titleParts.push(svc.location);
        if (providerName) titleParts.push(`by ${providerName}`);
        titleParts.push(`on ${SITE_NAME}`);

        return new Response(buildOgHtml({
          title: titleParts.join(" · "),
          description: desc, image, url: serviceUrl, type: "website",
        }), { headers: htmlHeaders });
      }

      return new Response(buildOgHtml({
        title: `Service | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION,
        image: DEFAULT_IMAGE, url: serviceUrl,
      }), { headers: htmlHeaders });
    }

    if (category) {
      const categoryUrl = `${SITE_URL}/category/${category}`;
      const { data: cat } = await supabase
        .from("categories")
        .select("name, slug, seo_title, seo_description, seo_image")
        .eq("slug", category).maybeSingle();

      if (cat) {
        return new Response(buildOgHtml({
          title: cat.seo_title || `${cat.name} | ${SITE_NAME}`,
          description: cat.seo_description || `Browse ${cat.name} products on ${SITE_NAME}.`,
          image: ogImage(cat.seo_image), url: categoryUrl,
        }), { headers: htmlHeaders });
      }

      return new Response(buildOgHtml({
        title: `Category | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION,
        image: DEFAULT_IMAGE, url: categoryUrl,
      }), { headers: htmlHeaders });
    }

    if (page) {
      const pageUrl = `${SITE_URL}/page/${page}`;
      const { data: seoPage } = await supabase
        .from("seo_pages").select("title, description, og_image, slug")
        .eq("slug", page).maybeSingle();

      if (seoPage) {
        return new Response(buildOgHtml({
          title: seoPage.title || SITE_NAME,
          description: seoPage.description || DEFAULT_DESCRIPTION,
          image: ogImage(seoPage.og_image), url: pageUrl,
        }), { headers: htmlHeaders });
      }
    }

    return new Response(buildFallbackHtml(), { headers: htmlHeaders });
  } catch (error) {
    console.error("og-preview error:", error);
    return new Response(buildFallbackHtml(), { headers: htmlHeaders });
  }
});

function buildFallbackHtml() {
  return buildOgHtml({
    title: `${SITE_NAME} – Buy & Sell Anything`,
    description: DEFAULT_DESCRIPTION,
    image: DEFAULT_IMAGE,
    url: SITE_URL,
  });
}
