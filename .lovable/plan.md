# Static Generation Engine V2 — Zero-Loop Architecture

Replaces the current polling/registry-driven generator with a strictly event-driven pipeline. Nothing regenerates on a timer; only real business-data changes (products, services, articles, reels, categories, shops) enqueue work. A single locked worker drains the queue in batches, does dirty-checking, writes only changed files, bumps one manifest version, and invalidates only affected CDN paths.

## 1. New database objects

- `generation_queue` — id, entity_type, entity_id, action (insert/update/delete), priority, status (pending/running/done/error/skipped), created_at, started_at, completed_at, retries, error, dedupe_key (unique on `entity_type|entity_id|action` while status='pending').
- `static_manifest` — path PK, version bigint, hash text, size int, generated_at. Replaces heavy writes to `static_file_registry`.
- `generation_locks` — name PK, holder, acquired_at, expires_at. Distributed lock via `INSERT ... ON CONFLICT DO NOTHING` + TTL.
- `generation_metrics_daily` — date PK, files_generated, files_skipped, db_reads, bytes_written, bytes_saved, errors, loops_detected. One row/day; replaces per-file logging in `static_gen_log`.
- `loop_guard` — entity_type, entity_id, minute_bucket, count. UPSERT counter; trigger raises alert at >2/min.

Triggers on business tables ONLY (`products`, `services`, `insight_articles`, `reels`/product-reels, `categories`, `shops`): AFTER INSERT/UPDATE/DELETE → insert one `generation_queue` row, deduped on pending key. No triggers on registry, manifest, logs, or metrics.

## 2. Edge functions

- `static-enqueue` — internal helper; called by trigger via `pg_net` for out-of-tx enqueues where needed.
- `static-worker` (replaces continuous behavior of `static-generate`):
  1. Acquire lock `worker:main` (skip if held & not expired).
  2. Sleep-collect window: pull all `pending` rows created in last 15–30s (batch coalesce).
  3. Resolve dependency map per entity type (product → `product/{id}`, `products/latest`, `products/popular`, matching `products/category/{slug}`, `homepage`, `search-index`).
  4. For each target path: read only the changed entity rows from DB, compute content hash, compare to `static_manifest.hash`; skip if identical (increment `files_skipped`).
  5. Write changed files with new global `manifest_version = now_ms`, update `static_manifest` rows, write single manifest.json.
  6. Invalidate only the changed CDN paths (Vercel `revalidateTag` / path purge).
  7. Mark queue rows `done`; on error → `error` + retries++ (max 3, exponential backoff).
  8. Release lock. Update `generation_metrics_daily` (one UPSERT).
- `static-full-rebuild` — admin-only, manual, requires admin role; ignores dirty-check.
- Delete: `static-cleanup` reduced to removing files whose manifest entry was deleted this run.

Worker invocation: `pg_net` from the enqueue trigger fires a single fire-and-forget request; function short-circuits if lock held. No cron. Optional 60s safety cron limited to "process queue if any pending > 60s old" — off by default.

## 3. Removals / replacements

- Delete cron jobs that call `static-generate`, `static-consistency`, `static-warm`, `static-integrity` on schedule.
- `static_file_registry` writes → removed; table kept read-only for migration; new writes go to `static_manifest`.
- `static_gen_log` per-file inserts → removed; only errors/warnings + one batch summary row.
- Any code path that regenerates on registry/log/manifest updates → deleted. Enforced by DB rule: triggers only exist on business tables.

## 4. Client changes

- `staticCDN.ts`: unchanged read path (manifest → IDB → CDN). Add: when manifest version bumps, only refetch entities whose per-path version in manifest changed (already partially implemented; harden pruning).
- `idbCache.ts`: extend prune to also drop entries whose `hash` differs from manifest.
- Service worker: immutable cache for versioned `/static/*.json?v=`, network-first for `manifest.json`. No polling.

## 5. Admin monitor

`AdminCacheMonitor` additions: queue depth, running job, avg gen time, files generated/skipped today, DB reads, bytes written/saved, loop detections, duplicate enqueues prevented, last error. All from `generation_metrics_daily` + `generation_queue` counts (2 cheap queries).

## 6. Safety

- Lock TTL 120s; stale lock auto-expires.
- Loop guard trigger: if same (entity_type, entity_id) enqueued >2 times in a rolling minute → mark critical, skip generation, log to `generation_metrics_daily.loops_detected`, notify admin.
- Traffic Guard on worker: if `status='running'` row exists → return 409 "Generation already active".
- Unique partial index guarantees one pending row per (entity, action).

## 7. Rollout

1. Migration: create new tables, triggers, lock, metrics, loop guard. GRANTs + RLS.
2. Ship `static-worker` + `static-full-rebuild`; keep old `static-generate` in place but behind flag `LEGACY_GEN=off`.
3. Cut triggers over to enqueue-only. Disable all schedule crons for generation.
4. Observe 24h: queue drains, no loops, `db_reads` low.
5. Delete legacy functions and registry writes.

## Success gates

- Zero scheduled generation invocations in 24h.
- `loops_detected = 0`.
- `files_skipped / (files_skipped + files_generated) > 0.7` on steady state.
- PostgREST public reads ≈ 0 (already gated by strict static mode).
- Deleted entity gone from CDN within one worker cycle (<60s).

---

### Confirm before I build

1. OK to create the 5 new tables (`generation_queue`, `static_manifest`, `generation_locks`, `generation_metrics_daily`, `loop_guard`) and add enqueue triggers on `products`, `services`, `insight_articles`, `categories`, `shops`? (Reels use `products` with `is_reel`, so no separate trigger unless you have a dedicated table.)
2. OK to disable ALL existing cron jobs that call `static-generate` / `static-consistency` / `static-warm` / `static-integrity`, and delete `static-consistency` + `static-warm`?
3. OK to keep `static-generate` for one deploy as legacy fallback, then remove — or delete immediately in the same migration?
4. Worker trigger: use `pg_net` from the enqueue trigger (fire-and-forget HTTP to `static-worker`), or keep a single 60s safety cron that only runs when pending rows exist? I recommend `pg_net` + no cron.
