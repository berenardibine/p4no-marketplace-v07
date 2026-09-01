---
name: Static generation trigger contract
description: Every public content table must have DB triggers calling trg_enqueue_business_change; counter columns must be excluded to avoid write storms
type: feature
---

# Static generation pipeline — trigger contract

The static engine is **trigger-driven only** (no polling, no cron). If the
triggers are missing, nothing regenerates and every page silently falls back
to the sanctioned last-resort PostgREST read. This happened once already:
the triggers were lost during a project remix, leaving the manifest stale.

## Rule: two triggers per content table

For each public content table (`products`, `services`, `insight_articles`,
`categories`, `shops`, and any new module):

1. `AFTER INSERT OR DELETE` → `trg_enqueue_business_change('<entity>')`
2. `AFTER UPDATE ... WHEN (<content columns changed>)` →
   `trg_enqueue_business_change('<entity>')`

## Critical: never trigger on counter columns

The UPDATE trigger's `WHEN` clause must **exclude** high-frequency counters:
`views`, `likes`, `impressions`, `share_count`, `view_count`, `like_count`,
`updated_at`, `last_edited_by`. Including them turns every page view into a
full regeneration + Vercel deployment — a self-inflicted traffic storm.

Low-frequency tables (`categories`, `shops`) may use `WHEN (OLD IS DISTINCT FROM NEW)`.

## Verifying the pipeline is alive

```sql
SELECT tgrelid::regclass::text, tgname FROM pg_trigger
WHERE NOT tgisinternal AND tgname LIKE 'trg_%_static%';
```

Then compare counts — these must match:
```sql
SELECT count(*) FROM products WHERE status='active';
SELECT count(*) FROM static_manifest WHERE path ~ '^products/[0-9a-f]{2}/';
```

## Queue hygiene

`generation_queue` rows can be orphaned in `status='running'` when a worker
run crashes, which blocks nothing but pollutes dashboards. Reset rows whose
`started_at` is older than 30 minutes.

## Adding a new module

Follow `docs/static-engine.md`: one `depGraph.ts` branch, one generator in
`static-generate`, plus the two triggers above.
