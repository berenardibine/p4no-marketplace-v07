-- 1) Log table
CREATE TABLE IF NOT EXISTS public.static_gen_log (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  slug TEXT,
  category TEXT,
  paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  version BIGINT,
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.static_gen_log TO authenticated;
GRANT ALL ON public.static_gen_log TO service_role;

ALTER TABLE public.static_gen_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can view static gen log" ON public.static_gen_log;
CREATE POLICY "admins can view static gen log"
  ON public.static_gen_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS static_gen_log_created_at_idx ON public.static_gen_log (created_at DESC);

-- 2) Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3) Regen dispatcher
CREATE OR REPLACE FUNCTION public.trigger_static_regen(
  p_entity TEXT,
  p_slug TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_id TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url TEXT := 'https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/static-generate';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'entity', p_entity,
      'slug', p_slug,
      'category', p_category,
      'id', p_id
    )
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.static_gen_log(entity, slug, category, paths, ok, error)
  VALUES (p_entity, p_slug, p_category, '[]'::jsonb, FALSE, SQLERRM);
END;
$$;

-- 4) Trigger functions per entity type
CREATE OR REPLACE FUNCTION public.tg_regen_product() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.trigger_static_regen(
    CASE WHEN r.video_url IS NOT NULL AND r.video_url <> '' THEN 'reel' ELSE 'product' END,
    r.slug, r.category, r.id::text
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_regen_service() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.trigger_static_regen('service', r.slug, NULL, r.id::text);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_regen_article() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.trigger_static_regen('article', r.slug, NULL, r.id::text);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_regen_category() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.trigger_static_regen('category', NULL, NULL, NULL);
  RETURN NULL;
END;
$$;

-- 5) Attach triggers
DROP TRIGGER IF EXISTS trg_regen_products ON public.products;
CREATE TRIGGER trg_regen_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_regen_product();

DROP TRIGGER IF EXISTS trg_regen_services ON public.services;
CREATE TRIGGER trg_regen_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.tg_regen_service();

DROP TRIGGER IF EXISTS trg_regen_articles ON public.insight_articles;
CREATE TRIGGER trg_regen_articles
  AFTER INSERT OR UPDATE OR DELETE ON public.insight_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_regen_article();

DROP TRIGGER IF EXISTS trg_regen_categories ON public.categories;
CREATE TRIGGER trg_regen_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_regen_category();

DROP TRIGGER IF EXISTS trg_regen_service_categories ON public.service_categories;
CREATE TRIGGER trg_regen_service_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.service_categories
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_regen_category();

DROP TRIGGER IF EXISTS trg_regen_insight_categories ON public.insight_categories;
CREATE TRIGGER trg_regen_insight_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.insight_categories
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_regen_category();
