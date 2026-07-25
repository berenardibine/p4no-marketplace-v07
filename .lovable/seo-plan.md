# P4NO Advanced SEO — Audit + Roadmap

## TL;DR

About **70–80%** of what was requested is already implemented in this codebase. A full rebuild would be wasted work. Below is what exists, what's genuinely missing, and a prioritized roadmap.

A hard ceiling: this project is a **Vite SPA**. True SSR/ISR (item 12) and reliable JS-free social previews (item 16) require migrating to Next.js / Remix / TanStack Start, or rendering an HTML shell from an edge function on bot user-agents. Everything else can be done on the current stack.

---

## Audit vs. the 20 requested sections

| # | Section | Status | Notes |
|---|---|---|---|
| 1 | Dynamic SEO metadata | ✅ Mostly done | `PageMetaTags`, `ProductMetaTags`, `ServiceMetaTags` exist. Profiles + Reels feed pages missing. |
| 2 | SEO-friendly slugs | ✅ Done | `useProductBySlug`, `useServiceBySlug` already power `/product/:slug`, `/connect/service/:slug`. Profiles still use `:userId`. |
| 3 | Structured data (JSON-LD) | 🟡 Partial | Product, Service, Breadcrumb, Review (inside Product) done. **Missing:** Organization (sitewide), VideoObject (reels), FAQPage, ItemList for category pages. |
| 4 | Video / reels SEO | ❌ Missing | `ReelsPage` has no `<title>`, no meta, no VideoObject schema. No per-reel shareable URL (`/reels/:id`). |
| 5 | Advanced sitemap | 🟡 Partial | `generate-sitemap` edge function pulls products, services, categories, service categories, help articles, shops with image sitemap extensions. **Missing:** reels, public profiles, sitemap index splitting (single file fine until ~50k URLs). |
| 6 | robots.txt | ✅ Done | Comprehensive — blocks admin/auth/checkout, separate Googlebot/Bingbot/Twitterbot/facebookexternalhit blocks, sitemap reference. |
| 7 | Internal linking | 🟡 Partial | `RelatedProducts`, `RelatedServices` exist. **Missing:** category cross-links on product pages, reel → product/service links. |
| 8 | Breadcrumbs | 🟡 Partial | `BreadcrumbJsonLd` exists. **Missing:** visible breadcrumb UI on product/service/category pages. |
| 9 | Category landing pages | 🟡 Partial | `/category/:slug` and `/connect/category/:slug` exist. **Missing:** SEO copy block, FAQ section, intro paragraph from `categories.seo_description`. |
| 10 | Search page indexing | ❌ Missing | No `/search/:term` route. Currently search is client-only state. |
| 11 | Image SEO | 🟡 Partial | Image sitemap entries present. **Missing:** systematic `alt` audit, lazy-loading audit, WebP via Cloudinary `f_webp` (already partially in `optimizeCloudinaryUrl`). |
| 12 | SSR | ❌ Stack limit | Requires migration off Vite SPA, or edge-function bot prerender. |
| 13 | Pagination crawlability | ❌ Missing | Category & connect feeds are infinite-scroll only. Need `?page=N` indexable URLs. |
| 14 | Canonicals | ✅ Done | Set per-page by meta components. Duplicate product paths (`/p/`, `/product/`) disallowed in robots. |
| 15 | Core Web Vitals | 🟡 Ongoing | Lazy loading, Cloudinary optimization in place. Needs measurement (Lighthouse), not rebuilding. |
| 16 | Dynamic OG images | ✅ Done | `og-preview` edge function exists. Verify it's wired into product/service share flows. |
| 17 | AI-readable structure | 🟡 Partial | Schema covers most entities. Add `Organization` + `WebSite` `SearchAction` (the latter exists in index.html). |
| 18 | UGC SEO (reviews/comments) | 🟡 Partial | Review schema embedded in Product JSON-LD. Comments not rendered SEO-visibly on first paint. |
| 19 | SEO monitoring | ✅ Done | Google Search Console verification + GA4 already in `index.html`. AdminSeoPages admin route exists. |
| 20 | Global goal | 🟢 On track | Foundation is solid; gaps are specific. |

---

## Real gaps — prioritized

### P0 (biggest impact, smallest effort)
1. **Reels SEO** — add `<title>`/meta to `/reels` and `/connect/reels`. Create per-reel URL (`/reels/:id`) with `VideoObject` JSON-LD (name, description, thumbnailUrl, contentUrl, uploadDate, duration). Include reels in sitemap.
2. **Organization JSON-LD** in `index.html` (logo, sameAs social links, contactPoint).
3. **Visible breadcrumbs** component on product/service/category pages (UI + already-present JSON-LD).
4. **Public profile slugs** — add `username` slug column + route `/u/:username`, replace `/connect/provider/:userId` for sharing.

### P1 (medium effort, real SEO lift)
5. **Category landing copy** — render `categories.seo_description` + an FAQ block + `FAQPage` JSON-LD component.
6. **Indexable search pages** — `/search/:query` route that renders results server-side via edge function HTML shell for bots only.
7. **Crawlable pagination** — add `?page=N` to category/connect feeds with `<link rel="prev/next">`.
8. **Sitemap reels + profiles** — extend `generate-sitemap` edge function.
9. **Reels page meta + ItemList JSON-LD** so the feed page itself ranks.

### P2 (requires architectural decision)
10. **Bot prerender edge function** — detect Googlebot/Bingbot/social crawlers, fetch from Supabase, return server-rendered HTML with full meta+JSON-LD. This is the closest you get to SSR without leaving Vite.
11. **Image alt audit** — sweep components for `<img>` with empty/missing `alt`. Add automated lint rule.
12. **Core Web Vitals pass** — Lighthouse audit, fix LCP image preload, reduce JS bundle for product page.

---

## Suggested next step

Pick a slice and I'll build it end-to-end:

- **"Ship P0"** — reels SEO + Organization schema + visible breadcrumbs + profile slugs (~1 session)
- **"Ship P1"** — category copy + search indexing + pagination + sitemap extensions
- **"Ship P2"** — bot prerender edge function (the closest thing to SSR on this stack)

Or name a single item from the gaps list and I'll implement just that.