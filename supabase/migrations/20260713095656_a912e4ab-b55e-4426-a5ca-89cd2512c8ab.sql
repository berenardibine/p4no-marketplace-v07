
CREATE TABLE IF NOT EXISTS public.cdn_metrics (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('browser','cdn','blob','supabase')),
  ms INTEGER,
  status INTEGER,
  violation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cdn_metrics_created_at_idx ON public.cdn_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS cdn_metrics_source_idx ON public.cdn_metrics (source);
CREATE INDEX IF NOT EXISTS cdn_metrics_violation_idx ON public.cdn_metrics (violation) WHERE violation = true;

GRANT INSERT ON public.cdn_metrics TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cdn_metrics_id_seq TO anon, authenticated;
GRANT SELECT ON public.cdn_metrics TO authenticated;
GRANT ALL ON public.cdn_metrics TO service_role;

ALTER TABLE public.cdn_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert cdn metrics"
  ON public.cdn_metrics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read cdn metrics"
  ON public.cdn_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
