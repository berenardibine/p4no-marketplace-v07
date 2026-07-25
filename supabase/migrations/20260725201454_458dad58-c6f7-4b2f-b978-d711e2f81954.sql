
-- =========================================================================
-- Static Generation Engine V2 — event-driven, zero-loop architecture
-- =========================================================================

-- Extensions we rely on
CREATE EXTENSION IF NOT EXISTS pg_net;

-- -------------------------------------------------------------------------
-- 1. generation_queue
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_queue (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete')),
  priority SMALLINT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error','skipped')),
  retries SMALLINT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Only one PENDING row per (entity_type, entity_id, action)
CREATE UNIQUE INDEX IF NOT EXISTS generation_queue_pending_dedup
  ON public.generation_queue (entity_type, entity_id, action)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS generation_queue_status_created
  ON public.generation_queue (status, created_at);

GRANT SELECT ON public.generation_queue TO authenticated;
GRANT ALL ON public.generation_queue TO service_role;
ALTER TABLE public.generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read generation_queue"
  ON public.generation_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 2. static_manifest
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.static_manifest (
  path TEXT PRIMARY KEY,
  version BIGINT NOT NULL,
  hash TEXT NOT NULL,
  size INT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS static_manifest_version_idx
  ON public.static_manifest (version DESC);

GRANT SELECT ON public.static_manifest TO authenticated;
GRANT ALL ON public.static_manifest TO service_role;
ALTER TABLE public.static_manifest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read static_manifest"
  ON public.static_manifest FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 3. generation_locks
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_locks (
  name TEXT PRIMARY KEY,
  holder TEXT,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

GRANT SELECT ON public.generation_locks TO authenticated;
GRANT ALL ON public.generation_locks TO service_role;
ALTER TABLE public.generation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read generation_locks"
  ON public.generation_locks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper: try to acquire lock, returns true on success
CREATE OR REPLACE FUNCTION public.try_acquire_gen_lock(_name TEXT, _holder TEXT, _ttl_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Purge expired lock first
  DELETE FROM public.generation_locks WHERE name = _name AND expires_at < now();
  BEGIN
    INSERT INTO public.generation_locks(name, holder, expires_at)
      VALUES (_name, _holder, now() + make_interval(secs => _ttl_seconds));
    RETURN TRUE;
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_gen_lock(_name TEXT, _holder TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.generation_locks WHERE name = _name AND holder = _holder;
$$;

-- -------------------------------------------------------------------------
-- 4. generation_metrics_daily
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_metrics_daily (
  day DATE PRIMARY KEY,
  files_generated INT NOT NULL DEFAULT 0,
  files_skipped INT NOT NULL DEFAULT 0,
  db_reads INT NOT NULL DEFAULT 0,
  bytes_written BIGINT NOT NULL DEFAULT 0,
  bytes_saved BIGINT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  loops_detected INT NOT NULL DEFAULT 0,
  duplicate_enqueues INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.generation_metrics_daily TO authenticated;
GRANT ALL ON public.generation_metrics_daily TO service_role;
ALTER TABLE public.generation_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read metrics"
  ON public.generation_metrics_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 5. loop_guard
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loop_guard (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, entity_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS loop_guard_bucket_idx
  ON public.loop_guard (minute_bucket);

GRANT SELECT ON public.loop_guard TO authenticated;
GRANT ALL ON public.loop_guard TO service_role;
ALTER TABLE public.loop_guard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read loop_guard"
  ON public.loop_guard FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 6. Enqueue helper — used by business-table triggers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_generation(
  _entity_type TEXT,
  _entity_id TEXT,
  _action TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket TIMESTAMPTZ := date_trunc('minute', now());
  _count INT;
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  -- Loop guard: >2 enqueues per entity per minute → skip and record
  INSERT INTO public.loop_guard(entity_type, entity_id, minute_bucket, count)
    VALUES (_entity_type, _entity_id, _bucket, 1)
    ON CONFLICT (entity_type, entity_id, minute_bucket)
    DO UPDATE SET count = public.loop_guard.count + 1
    RETURNING count INTO _count;

  IF _count > 2 THEN
    INSERT INTO public.generation_metrics_daily(day, loops_detected)
      VALUES (_today, 1)
      ON CONFLICT (day) DO UPDATE
        SET loops_detected = public.generation_metrics_daily.loops_detected + 1,
            updated_at = now();
    RETURN;
  END IF;

  -- Dedup: unique partial index handles it
  BEGIN
    INSERT INTO public.generation_queue(entity_type, entity_id, action)
      VALUES (_entity_type, _entity_id, _action);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.generation_metrics_daily(day, duplicate_enqueues)
      VALUES (_today, 1)
      ON CONFLICT (day) DO UPDATE
        SET duplicate_enqueues = public.generation_metrics_daily.duplicate_enqueues + 1,
            updated_at = now();
    RETURN;
  END;

  -- Fire-and-forget notify the worker (worker is idempotent and lock-guarded).
  PERFORM net.http_post(
    url := 'https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/static-worker',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
    body := '{"trigger":"enqueue"}'::jsonb
  );
END;
$$;

-- -------------------------------------------------------------------------
-- 7. Generic trigger function on business tables
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_enqueue_business_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_type TEXT := TG_ARGV[0];
  _id TEXT;
  _action TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _id := COALESCE(OLD.id::TEXT, '');
    _action := 'delete';
  ELSIF TG_OP = 'INSERT' THEN
    _id := COALESCE(NEW.id::TEXT, '');
    _action := 'insert';
  ELSE
    _id := COALESCE(NEW.id::TEXT, '');
    _action := 'update';
  END IF;

  IF _id <> '' THEN
    PERFORM public.enqueue_generation(_entity_type, _id, _action);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------
-- 8. Attach triggers to business tables ONLY
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS static_gen_products ON public.products;
CREATE TRIGGER static_gen_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('product');

DROP TRIGGER IF EXISTS static_gen_services ON public.services;
CREATE TRIGGER static_gen_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('service');

DROP TRIGGER IF EXISTS static_gen_insight_articles ON public.insight_articles;
CREATE TRIGGER static_gen_insight_articles
  AFTER INSERT OR UPDATE OR DELETE ON public.insight_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('article');

DROP TRIGGER IF EXISTS static_gen_categories ON public.categories;
CREATE TRIGGER static_gen_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('category');

DROP TRIGGER IF EXISTS static_gen_shops ON public.shops;
CREATE TRIGGER static_gen_shops
  AFTER INSERT OR UPDATE OR DELETE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('shop');

-- -------------------------------------------------------------------------
-- 9. Retire old scheduled generation jobs
-- -------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('static-integrity-hourly','static-cleanup-daily','static-consistency-15min')
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- 10. Housekeeping: prune stale loop_guard buckets (kept small)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_loop_guard()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.loop_guard WHERE minute_bucket < now() - INTERVAL '10 minutes';
$$;
