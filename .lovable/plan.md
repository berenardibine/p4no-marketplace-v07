# P4NO Ultra Static Architecture V3

Builds on the V2 zero-loop engine (queue + worker + manifest + locks) already in place. V3 completes the picture: every public read is served from Static JSON → CDN → IndexedDB, and PostgREST becomes a write-only surface for public content.

## 1. Static asset catalog

Extend `static-worker` / `static-generate` to emit and version these JSON files:

```text
/static/manifest.json
/static/homepage.json
/static/feeds/popular.json
/static/feeds/latest.json
/static/feeds/trending.json
/static/feeds/featured.json
/static/search/search-index.json

/static/products/{id}.json
/static/services/{id}.json
/static/articles/{slug}.json
/static/reels/{id}.json
/static/sellers/{id}.json
/static/shops/{id}.json

/static/categories/{slug}.json
/static/categories/{slug}/page-{n}.json
```

Every payload uses the envelope already used by `getContent`:
`{ v, generated_at, hash, size, data }`. Manifest entries store
`{ version, hash, size, generated_at }` per path plus a top-level
`manifest_version`.

## 2. Dependency graph (server-side)

New file `supabase/functions/_shared/depGraph.ts` exports pure
`resolveTargets(entity, id?)` used by `static-worker`. Rules:

- product → product/{id}, homepage, feeds/latest, feeds/popular, categories/{slug}, categories/{slug}/page-*, search-index
- service → service/{id}, homepage, categories/services/{slug}, search-index
- article → article/{slug}, insights homepage, homepage, search-index
- reel → reel/{id}, reels feed, homepage
- category → category/{slug} + paginated pages, homepage
- shop / seller → shop/{id}, seller/{id}, homepage (only if featured)

Worker expands queue rows through this graph, dedupes, then generates
only the resulting paths.

## 3. Incremental generator

Enhance `static-generate` (already present) to:

- Accept a `paths[]` mode from `static-worker` (no full scans).
- Compute `sha256(JSON.stringify(data))` and skip write when hash matches
  the current `static_manifest` row (dirty check).
- On write: upload to Vercel Blob, upsert `static_manifest`, bump global
  `manifest_version` once per worker run.
- On delete: remove blob, delete manifest row, purge CDN, emit tombstone
  so clients can drop IndexedDB entry.

## 4. Delete pipeline

- DB trigger on business tables already enqueues deletes.
- Worker handles `op = 'delete'` by calling generator delete path,
  which removes blob + manifest row and appends the path to
  `manifest.tombstones[]` for the next manifest publish.
- Client `cdnGuard` reads tombstones on manifest refresh and calls
  `idbDelete(path)` for each.

## 5. Client read layer (strict static)

- Flip `isStrictStaticMode()` on for all public routes.
- Refactor these hooks to use `getContent()` exclusively (no Supabase
  fallback fn passed in):
  `useProducts`, `useProductBySlug`, `useServices`, `useServiceBySlug`,
  `useReels`, `useUnifiedReels`, `useInsights`, `useCategories`,
  `usePopularThisWeek`, `useDynamicHomeFeed`, `useHomeSections`,
  `useShops`, `useShop`, `useAllProducts`, `useFilteredProducts`,
  `useNearbyProducts`, search page.
- Search page (`SearchPage.tsx`) switches to in-memory filter over
  `search/search-index.json` (small denormalised records).
- `cdnGuard.getContent` already refuses Supabase fallback in strict
  mode — keep that as the single choke point.

Write flows (auth, orders, likes, comments, admin) keep using PostgREST
untouched.

## 6. Traffic guard

Add `src/lib/publicReadGuard.ts` that wraps the Supabase client's
`.from()` for a denylist of public tables (products, services,
insight_articles, reels, categories, shops, profiles-as-seller):

- In dev / strict mode: throw with a clear message + stack, so any
  regression is caught immediately.
- In prod: `console.warn`, increment `cdn_metrics` violation, return
  empty result.
- Hooks listed in §5 are migrated first so the guard never fires in
  normal flows.

## 7. Manifest sync & IndexedDB

`staticCDN.getManifest` already prunes stale keys. Extend to:

- Process `tombstones[]` → `idbDelete`.
- Fire a `manifest-updated` event; hooks re-read only the paths whose
  version changed.

No polling — refresh on focus + on 30s idle interval already present.

## 8. Admin dashboard — "Static Architecture" tab

New route `src/pages/admin/AdminStaticArchitecture.tsx` under existing
admin shell. Sections:

- Traffic mix (browser / CDN / blob / supabase) from `cdn_metrics`.
- Blocked PostgREST attempts (violations) + top offending paths.
- Static coverage % = manifest paths / expected paths.
- Generation metrics from `generation_metrics_daily` +
  `generation_queue` size, avg gen time, avg file size.
- Manifest version, last publish time, tombstone count.
- Top requested + top missing static paths (from `cdn_metrics`).
- Loop detector state (`loop_guard`).
- Egress saved estimate = (browser+cdn+blob hits) × avg row bytes.

Read-only — all data comes from tables already populated by V2.

## 9. Removals / hardening

- Remove any remaining `setInterval` polling of PostgREST in hooks
  touched in §5.
- Ensure no cron re-enables full rebuilds; `static-full-rebuild`
  stays admin-triggered only.
- Worker keeps its single-lock + loop-guard from V2.

## Technical notes

- No new DB tables required — reuse `static_manifest`,
  `generation_queue`, `generation_metrics_daily`, `cdn_metrics`,
  `loop_guard`, `generation_locks`.
- Manifest schema gains `manifest_version:int` and
  `tombstones: string[]` (client-side additive, no migration).
- Hash algorithm: SHA-256 hex, stored in `static_manifest.hash`.
- Search index kept < 500 KB gzipped by trimming to
  `{id, slug, title, category, price, thumb, tags}`.
- Category pagination page size = 40.
- Rollout order: (a) generator + dependency graph, (b) worker path
  expansion, (c) client hook migration behind strict flag, (d) admin
  dashboard, (e) enable traffic guard in prod.

Ready to implement on approval.
