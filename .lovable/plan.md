# P4NO Permanent Static Content Engine (V4 — deltas on V3)

V2 (zero-loop queue + worker + locks) and V3 (dep graph, dirty hash, tombstones, traffic guard, monitor) are already live. V4 closes the remaining gaps to hit "every public page is a static JSON, zero PostgREST egress, future-proof".

## Gap analysis vs. the brief

| Requirement | Status |
|---|---|
| Queue + single worker + lock | Done (V2) |
| Dep graph + dirty hash + tombstones | Done (V3) |
| Traffic guard + monitor dashboard | Done (V3) |
| Products / services / articles / reels / categories static | Done |
| **Shops / sellers static** | Missing |
| **Homepage bundle (`homepage.json`)** | Missing |
| **Named feeds `feeds/popular|latest|trending|featured.json`** | Partially (as `products/*`) — need canonical feed paths |
| **Category pagination `categories/{slug}/page-N.json`** | Missing |
| **Search index at `search/search-index.json`** | Exists as `products/search-index.json` — needs canonical path |
| **Client waits on generation queue for missing files, else 404** | Missing (`getContent` currently just misses) |
| **Entity registry (future-proof new modules)** | Missing — generators are hard-coded in a switch |
| **Monitor extras (deleted files, top regenerated, dep graph view)** | Partially |

## Changes

### 1. Generator (`static-generate/index.ts`)
- Introduce an **entity registry** map `{ entity → { listPaths(), detail(slug), deps() } }` so adding a new module = adding one entry, no arch change.
- Add generators: `genShops`, `genShopDetail`, `genSellerDetail`, `genHomepage` (bundle of hero feeds + categories snapshot), `genFeeds` (canonical `feeds/{popular,latest,trending,featured}.json` — thin projections of existing product lists), `genCategoryPaginated` (page size 40 → `categories/{slug}/page-N.json` + `categories/{slug}/index.json` with page count).
- Wire delete handling for shops/sellers (tombstones only — no cascade regen of unrelated products).

### 2. Dep graph (`_shared/depGraph.ts`)
- Add `shop` / `seller` → `shop/{id}`, `seller/{id}`, `homepage`, `feeds/*`.
- `product` update also invalidates `homepage`, `feeds/*`, `categories/{slug}/page-*`, `search/search-index`.
- `article` update also invalidates `homepage`.
- `category` update invalidates `categories/{slug}/page-*`.

### 3. Worker (`static-worker/index.ts`)
- Route new detail entities (`shop`, `seller`) through the generator router.
- Emit per-batch `top_regenerated` counts into `generation_metrics_daily` (new columns via additive JSON in existing metadata, no migration).

### 4. Client — missing file policy (`src/lib/staticCDN.ts`)
- New `waitForPath(path, timeoutMs=8000)`: on a CDN 404, call new edge `static-queue-status?path=…` to check `generation_queue`. If queued/running → poll manifest every 800 ms until version appears or timeout → resolve. If not queued and not in manifest → surface a real 404 (caller returns empty / renders NotFound). No PostgREST fallback ever.
- Consumers: `useProductBySlug`, `useServiceBySlug`, article + reel + shop + seller detail hooks call `waitForPath` before treating a miss as 404.

### 5. New edge function `static-queue-status`
- Read-only. `GET ?path=product/abc` → `{ queued: bool, running: bool, position: n }`. Uses service role; no writes; cheap.

### 6. Monitor dashboard (`AdminStaticArchitecture.tsx`)
- Add: **Deleted files (last 24 h)** from manifest tombstones, **Top regenerated paths** (from queue completed rows grouped by entity), **Dependency graph preview** (static SVG derived from `_shared/depGraph.ts` shape — no runtime cost), **Static coverage %** already present — add per-entity breakdown.

### 7. Future-proof rule
- Add `docs/static-engine.md` with the one-line contract: "New public module = 1 entry in `entityRegistry` + 1 dep-graph rule + trigger on the table. No client changes required."

## Explicitly NOT changing
- No new tables. Reuses `generation_queue`, `static_manifest`, `generation_locks`, `generation_metrics_daily`, `loop_guard`, `cdn_metrics`.
- No cron. No polling. No timers. Worker still fires only on business-table triggers.
- Public read hooks migrated in V3 stay strict — no PostgREST fallback added.

## Rollout order
1. Generator entity registry + new generators (shops, sellers, homepage, feeds, category pagination).
2. Dep graph extensions + worker routing.
3. `static-queue-status` edge function + client `waitForPath`.
4. Dashboard extras.
5. Docs.

Ready to implement on approval.