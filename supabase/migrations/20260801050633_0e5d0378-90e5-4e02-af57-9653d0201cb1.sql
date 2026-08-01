ALTER TABLE public.static_manifest
  ADD COLUMN IF NOT EXISTS entity text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS shard text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.static_gen_log
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE INDEX IF NOT EXISTS static_manifest_entity_shard_idx
  ON public.static_manifest (entity, shard);

CREATE INDEX IF NOT EXISTS static_manifest_entity_id_idx
  ON public.static_manifest (entity_id);