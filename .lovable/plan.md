
# P4NO Enterprise Traffic Engine V2

Goal: public content served exclusively from Vercel Static Files + Edge CDN. Supabase becomes write-only for public browsing. Blob is removed from the public request path. Traffic Guard blocks any public read that would touch Supabase.

## Architecture (target)

```text
Write path:  App → Supabase → Trigger → static-generate → commit JSON to /public/static → Vercel deploy → Edge CDN
Read path:   User → Browser Cache → IndexedDB → Edge CDN (/static/*.json) → (miss) → 503 Updating + enqueue regen
                                                                                    ↑ never Supabase, never Blob
```

## Scope of change

### 1. Static origin migration (Blob → repo /public/static)
- `static-generate` writes JSON to `/public/static/**` in the repo and commits via a GitHub App (server-side), instead of `put()` to Vercel Blob.
- Deploy hook auto-triggers Vercel rebuild → Edge CDN serves `/static/*.json` immutably.
- `manifest.json` served with `no-cache`; every entity file served with `Cache-Control: public, max-age=31536000, immutable` (hashed URL param `?v=<version>`).
- Remove all Blob reads from client. Remove Blob token from client-visible surface.

### 2. Generator surfaces (complete list)
Aggregates: `homepage.json`, `products.json`, `services.json`, `articles.json`, `reels.json`, `categories.json`, `featured.json`, `latest.json`, `popular.json`, `search-index.json`.
Per-entity: `products/{id}.json`, `services/{id}.json`, `articles/{slug}.json`, `reels/{id}.json`, `categories/{slug}.json`.

### 3. Incremental regen matrix
On product write → `product/{id}` + `products` + `latest` + `popular` + `homepage` + `search-index` + `manifest`.
Analogous matrices for services, articles, reels, categories. Codified in a `REGEN_MATRIX` table in `static-generate`.

### 4. Manifest v3
Fields: `version`, `generated_at`, `entities` (path→version+hash), plus aggregate counters (products, services, reels, articles, categories, homepage_version, latest_version, popular_version, featured_version). Client only downloads entities whose version changed.

### 5. Traffic Guard (strict)
- New `src/lib/publicRead.ts` = single entry point for all public reads.
- Order: memory → IndexedDB → static CDN → 503 (enqueue regen). Never Supabase.
- All existing public hooks (`useAllProducts`, `useCategories`, `usePopularThisWeek`, `useServices`, `useReels`, `useInsights`, search, homepage) refactored to call `publicRead()`.
- `assertPublicReadOnly()` guard throws in dev if a Supabase select is issued from a public surface; logs a violation in prod (`cdn_metrics`).
- `STRICT_STATIC_MODE=on` by default in production; toggleable from admin.

### 6. Deletion pipeline
On DELETE trigger: remove per-entity JSON, prune from every list JSON in the regen matrix, bump manifest, purge Vercel cache tag (`revalidateTag`), broadcast `manifest_version` so clients evict IDB entries and hard-invalidate service worker cache. Direct visit to deleted entity → 404 (static 404 route).

### 7. Validation & self-heal
`static-integrity` extended: JSON parse check, schema check, empty check, version check. Any failure enqueues regen. Runs hourly; on client 404/503, background enqueue with exponential backoff (already partial — hardened).

### 8. Client cache stack
- Service worker: stale-while-revalidate for `/static/*.json`, network-first for `manifest.json`.
- IndexedDB: keyed by entity path + version; bulk prune on manifest version bump (already present — extended to cover new surfaces).
- Response headers set via `vercel.json` `headers` block.

### 9. Admin monitor V2
`AdminCacheMonitor` gets new panels: browser/CDN/IDB hit %, static coverage %, regen queue depth, deleted queue, guard violations, blocked requests, Supabase public reads (should be 0), egress $ estimate, top files, p50/p95/p99, 404/503 counters, health scores per subsystem.

### 10. Removal
- Delete `static-cleanup` blob-listing code; replace with repo file diff cleanup.
- Remove `@vercel/blob` from all runtime paths (kept only in a one-shot migration function to backfill /public/static from existing blobs).

## Technical notes (for reviewers)

- Repo commits from edge function require a GitHub App PAT stored as secret `GITHUB_STATIC_TOKEN` + repo/branch config. Alternative: use Vercel's `POST /v13/deployments` with inline files, but repo commits are simpler for diff + rollback.
- Vercel deploys are ~30-60s. For sub-minute freshness, keep an "override" endpoint that serves the freshly-generated JSON via an edge function for the ~60s window while the static deploy propagates, then transparently switches to `/static/*.json`. This is the only place Blob-style ephemeral storage remains — kept out of public URL space (`/api/fresh/*`).
- Search index target size: <500 KB gzip. If exceeded, shard by first-letter buckets.
- SPA fallback stays as-is for HTML routes.

## Rollout

1. Ship generator + `/public/static` writer behind flag `STATIC_ORIGIN=repo`; keep Blob in parallel for one deploy.
2. Migrate hooks to `publicRead()`. Verify `cdn_metrics.supabase=0` for public routes in staging.
3. Flip `STRICT_STATIC_MODE=on`.
4. Remove Blob origin. Delete Blob backfill function after one week.

## Out of scope (unchanged)

Auth, wallet, referral, checkout, admin — all continue to hit Supabase directly (write path). No business-logic changes.

## Success gates

- `cdn_metrics` shows `supabase_public_reads = 0` for 24h.
- Blob egress = 0.
- Deleted product invisible within one deploy cycle (<90s).
- CDN hit rate ≥ 95%, homepage TTFB < 300ms from Edge.

---

This is a multi-day migration touching ~30 files and requires a GitHub App token before implementation can start. Please confirm:

1. OK to use repo commits (`/public/static/**`) as the origin, requiring a `GITHUB_STATIC_TOKEN` secret? Or prefer Vercel deployment API with inline files?
2. OK to keep a short-lived `/api/fresh/*` edge route to cover the 60s Vercel deploy propagation window? (Alternative: accept up-to-60s staleness on writes.)
3. OK to flip `STRICT_STATIC_MODE=on` in production at the end of rollout (blocks any public Supabase read)?
