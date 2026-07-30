CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'module',
  enabled BOOLEAN NOT NULL DEFAULT true,
  dependencies TEXT[] NOT NULL DEFAULT '{}',
  est_db_savings TEXT NOT NULL DEFAULT '',
  est_egress_savings TEXT NOT NULL DEFAULT '',
  jobs TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags public read" ON public.feature_flags;
CREATE POLICY "feature_flags public read"
  ON public.feature_flags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "feature_flags admin write" ON public.feature_flags;
CREATE POLICY "feature_flags admin write"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_feature_flags()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_feature_flags ON public.feature_flags;
CREATE TRIGGER trg_touch_feature_flags
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_feature_flags();

INSERT INTO public.feature_flags (key, label, description, category, dependencies, est_db_savings, est_egress_savings, jobs, sort_order) VALUES
  ('categories_section', 'Categories Section', 'Homepage category grid/carousel. Product category logic keeps working.', 'homepage', '{}', '~3 reads / visit', '~40 KB / visit', '{}', 10),
  ('reels_module',       'Reels Module',       'Entire reels ecosystem: pages, homepage strip, uploads, APIs, static generation, notifications.', 'module', '{"products"}', '~12 reads / visit', '~400 KB / visit', '{"static-worker:reel","generate-recommendations"}', 20),
  ('articles_module',    'Articles Module',    'Insights/articles: pages, search indexing, generation, recommendations, notifications.', 'module', '{}', '~8 reads / visit', '~250 KB / visit', '{"static-worker:article","weekly-digest"}', 30),
  ('new_arrivals',       'New Arrivals',       'Homepage "New Arrivals" section, its generation and analytics.', 'homepage', '{"products"}', '~2 reads / visit', '~60 KB / visit', '{}', 40),
  ('recently_viewed',    'Recently Viewed',    'Browsing-history tracking, IndexedDB writes and view-based recommendations.', 'tracking', '{}', '~4 writes / visit', '~30 KB / visit', '{"track-interest"}', 50),
  ('best_deals',         'Best Deals',         'Today Best Deals calculations, snapshots and homepage rendering.', 'homepage', '{"products"}', '~2 reads / visit', '~50 KB / visit', '{}', 60),
  ('popular_this_week',  'Popular This Week',  'Weekly popularity calculations, snapshots, cron worker and homepage widgets.', 'homepage', '{"products","services"}', '~6 reads / visit', '~80 KB / visit', '{"compute-weekly-popular"}', 70),
  ('mark_order_system',  'Mark & Order System','Order/checkout workflow, order APIs, background processing and notifications.', 'commerce', '{"products"}', '~5 reads / order', '~20 KB / visit', '{"dispatch-queue:order"}', 80),
  ('homepage_shop_section','Homepage Shop Section','"Shop Near Me" homepage block only. Seller shop pages are unaffected.', 'homepage', '{"shops"}', '~2 reads / visit', '~45 KB / visit', '{}', 90)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.feature_enabled(_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.feature_flags WHERE key = _key), true);
$$;

GRANT EXECUTE ON FUNCTION public.feature_enabled(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.entity_feature_enabled(_entity_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _entity_type
    WHEN 'reel' THEN public.feature_enabled('reels_module')
    WHEN 'article' THEN public.feature_enabled('articles_module')
    ELSE true
  END;
$$;

GRANT EXECUTE ON FUNCTION public.entity_feature_enabled(TEXT) TO anon, authenticated, service_role;

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
  -- Feature guard: disabled modules never generate static content.
  IF NOT public.entity_feature_enabled(_entity_type) THEN
    RETURN;
  END IF;

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

  PERFORM net.http_post(
    url := 'https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/static-worker',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
    body := '{"trigger":"enqueue"}'::jsonb
  );
END;
$$;