ALTER TABLE public.generation_locks
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS generation_id uuid;

ALTER TABLE public.static_gen_log
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS generation_id uuid;

CREATE INDEX IF NOT EXISTS static_gen_log_event_id_idx ON public.static_gen_log (event_id, created_at DESC);

ALTER TABLE public.generation_metrics_daily
  ADD COLUMN IF NOT EXISTS events_processed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generations_run integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_generations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_requests integer NOT NULL DEFAULT 0;