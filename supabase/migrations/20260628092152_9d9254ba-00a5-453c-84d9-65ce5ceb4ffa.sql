
-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Per-project settings (URL + anon key are public; seeded via supabase--insert after remix)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Generic invalidation trigger function
CREATE OR REPLACE FUNCTION public.notify_cache_invalidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_key text;
  v_entity text := TG_ARGV[0];
  v_slug text;
  v_id text;
  v_category text;
  v_row jsonb;
BEGIN
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'edge_functions_url';
  SELECT value INTO v_key FROM public.app_settings WHERE key = 'anon_key';
  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_row := to_jsonb(COALESCE(NEW, OLD));
  v_slug := v_row->>'slug';
  v_id := v_row->>'id';
  v_category := v_row->>'category';

  PERFORM net.http_post(
    url := v_url || '/cache-invalidate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := jsonb_build_object(
      'entity', v_entity,
      'slug', v_slug,
      'id', v_id,
      'category', v_category,
      'op', TG_OP
    )
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never let cache invalidation break a write
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Attach triggers (drop then recreate so re-runs are clean)
DROP TRIGGER IF EXISTS trg_invalidate_cache_products ON public.products;
CREATE TRIGGER trg_invalidate_cache_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('product');

DROP TRIGGER IF EXISTS trg_invalidate_cache_services ON public.services;
CREATE TRIGGER trg_invalidate_cache_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('service');

DROP TRIGGER IF EXISTS trg_invalidate_cache_articles ON public.insight_articles;
CREATE TRIGGER trg_invalidate_cache_articles
  AFTER INSERT OR UPDATE OR DELETE ON public.insight_articles
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('article');

DROP TRIGGER IF EXISTS trg_invalidate_cache_profiles ON public.profiles;
CREATE TRIGGER trg_invalidate_cache_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.full_name IS DISTINCT FROM NEW.full_name OR
    OLD.profile_image IS DISTINCT FROM NEW.profile_image OR
    OLD.whatsapp_number IS DISTINCT FROM NEW.whatsapp_number OR
    OLD.call_number IS DISTINCT FROM NEW.call_number OR
    OLD.identity_verified IS DISTINCT FROM NEW.identity_verified
  )
  EXECUTE FUNCTION public.notify_cache_invalidate('seller');

DROP TRIGGER IF EXISTS trg_invalidate_cache_shops ON public.shops;
CREATE TRIGGER trg_invalidate_cache_shops
  AFTER INSERT OR UPDATE OR DELETE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('shop');

DROP TRIGGER IF EXISTS trg_invalidate_cache_categories ON public.categories;
CREATE TRIGGER trg_invalidate_cache_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('category');

DROP TRIGGER IF EXISTS trg_invalidate_cache_service_categories ON public.service_categories;
CREATE TRIGGER trg_invalidate_cache_service_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('category');

DROP TRIGGER IF EXISTS trg_invalidate_cache_insight_categories ON public.insight_categories;
CREATE TRIGGER trg_invalidate_cache_insight_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.insight_categories
  FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidate('category');
