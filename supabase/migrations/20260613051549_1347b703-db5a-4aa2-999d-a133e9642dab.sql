-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================
-- weekly_product_stats: precomputed popularity for fast reads
-- =========================================================
CREATE TABLE IF NOT EXISTS public.weekly_product_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  year int NOT NULL,
  week_number int NOT NULL,
  views int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  favorites int NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, year, week_number)
);

CREATE INDEX IF NOT EXISTS idx_wps_year_week_score
  ON public.weekly_product_stats (year, week_number, score DESC);

GRANT SELECT ON public.weekly_product_stats TO authenticated;
GRANT ALL ON public.weekly_product_stats TO service_role;

ALTER TABLE public.weekly_product_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_stats readable by authenticated"
  ON public.weekly_product_stats FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- cache_metrics: cache analytics buckets
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cache_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_date date NOT NULL DEFAULT CURRENT_DATE,
  key_prefix text NOT NULL,
  hits bigint NOT NULL DEFAULT 0,
  misses bigint NOT NULL DEFAULT 0,
  refreshes bigint NOT NULL DEFAULT 0,
  invalidations bigint NOT NULL DEFAULT 0,
  total_response_ms bigint NOT NULL DEFAULT 0,
  sample_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_date, key_prefix)
);

CREATE INDEX IF NOT EXISTS idx_cache_metrics_date
  ON public.cache_metrics (bucket_date DESC);

GRANT SELECT ON public.cache_metrics TO authenticated;
GRANT ALL ON public.cache_metrics TO service_role;

ALTER TABLE public.cache_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cache_metrics admin read"
  ON public.cache_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- Trigger: invalidate Redis on product mutations
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_product_cache_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/product-cache-manager';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8';
  v_slug text;
  v_category text;
  v_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_slug := OLD.slug;
    v_category := OLD.category;
    v_action := 'invalidate_product';
  ELSE
    v_slug := NEW.slug;
    v_category := NEW.category;
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'refresh_product' ELSE 'refresh_product' END;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon,
      'Authorization', 'Bearer ' || v_anon,
      'x-internal-trigger', 'pg'
    ),
    body := jsonb_build_object(
      'action', v_action,
      'slug', v_slug,
      'category', v_category,
      'op', TG_OP
    )
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- never block writes on cache failures
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_products_cache_invalidate ON public.products;
CREATE TRIGGER trg_products_cache_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_product_cache_change();

-- =========================================================
-- Cron: hourly weekly popularity + 6-hourly warm
-- =========================================================
DO $cron$
BEGIN
  PERFORM cron.unschedule('compute-weekly-popular-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;

DO $cron$
BEGIN
  PERFORM cron.unschedule('product-cache-warm-6h');
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;

SELECT cron.schedule(
  'compute-weekly-popular-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/compute-weekly-popular',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'product-cache-warm-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/product-cache-manager',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
    body := '{"action":"warm_all"}'::jsonb
  );
  $$
);