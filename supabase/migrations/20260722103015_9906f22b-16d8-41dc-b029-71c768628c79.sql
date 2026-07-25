
CREATE TABLE IF NOT EXISTS public.static_file_registry (
  path text PRIMARY KEY,
  sha text NOT NULL,
  size integer NOT NULL,
  content_type text NOT NULL DEFAULT 'application/json',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.static_file_registry TO service_role;
ALTER TABLE public.static_file_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.static_file_registry FOR ALL USING (false);
