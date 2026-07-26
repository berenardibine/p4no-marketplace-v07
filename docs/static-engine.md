# P4NO Permanent Static Content Engine

## Contract for adding a new public module

To make a new content type (Coupons, Events, Courses, Brands, Collections, ...) automatically served as static JSON with zero PostgREST egress:

1. **Add one branch** to `supabase/functions/_shared/depGraph.ts` describing which static paths must regenerate when the entity changes (list feed, detail, homepage, search index, ...).
2. **Add one generator** in `supabase/functions/static-generate/index.ts` and route it from the `switch (entity)` in `handle()`.
3. **Add one trigger** on the source table that calls `enqueue_static_generation(...)` (mirror the pattern already used on `products`, `services`, `insight_articles`, `categories`, `shops`).

No client changes required. The worker fans out changes through the dep graph, dirty-checks each payload with SHA-256, publishes the manifest, and clients pick it up on the next manifest refresh (focus / 30s idle).

## Guarantees
- **Zero polling**: generation runs only on business-table triggers.
- **Zero loops**: single-worker lock + `loop_guard` + dirty-hash short-circuit.
- **Zero PostgREST for public reads**: `publicReadGuard` throws in strict mode; missing files call `waitForPath()` — never the DB.
- **Delete pipeline**: tombstones in the manifest evict IndexedDB entries; `unstage()` drops registry + manifest rows.
- **Future-proof**: entity registry pattern above.