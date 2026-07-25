
-- Fix follows-related triggers that reference the non-existent column following_id.
-- The follows table uses (follower_id, target_type, target_id).

-- 1) Drop the duplicate/broken follow-notify trigger. The correct ones
--    (follows_notify -> trg_new_follower, tg_follow_notify -> tg_notify_follow,
--     trg_notify_on_new_follow -> notify_on_new_follow) remain in place.
DROP TRIGGER IF EXISTS notify_follow ON public.follows;
DROP FUNCTION IF EXISTS public.trg_notify_follow();

-- 2) Drop the duplicate/broken product-notify trigger. Correct ones remain:
--    trg_notify_followers_new_product (uses target_type='shop')
--    trg_notify_on_price_drop (uses saved_items)
DROP TRIGGER IF EXISTS notify_product_change ON public.products;
DROP FUNCTION IF EXISTS public.trg_notify_product_change();

-- 3) Rewrite article-published follower notification to use target_id/target_type.
CREATE OR REPLACE FUNCTION public.trg_notify_article_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author text;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, 'P4NO') INTO v_author FROM public.profiles WHERE id = NEW.author_id;

  INSERT INTO public.notification_queue(
    user_id, notification_type, title, body, url, status, scheduled_for, next_attempt_at,
    entity_type, entity_id, actor_id, metadata, data, dedup_key, priority
  )
  SELECT f.follower_id, 'article', 'New article from ' || v_author, COALESCE(NEW.title, 'Read it now'),
         '/insights/article/' || NEW.slug,
         'pending', now(), now(),
         'insight_article', NEW.id, NEW.author_id,
         jsonb_build_object('slug', NEW.slug),
         jsonb_build_object('type','article','entity_type','insight_article','entity_id',NEW.id),
         'article:' || NEW.id::text || ':' || f.follower_id::text,
         'low'
  FROM public.follows f
  WHERE f.target_id = NEW.author_id
    AND f.target_type IN ('user','profile','seller')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- 4) Extend trigger_static_regen to forward the DB op (INSERT/UPDATE/DELETE)
--    so the edge function can delete the detail blob on deletion.
CREATE OR REPLACE FUNCTION public.trigger_static_regen(
  p_entity text,
  p_slug text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_id text DEFAULT NULL,
  p_op text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'id', p_id,
      'op', p_op
    )
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.static_gen_log(entity, slug, category, paths, ok, error)
  VALUES (p_entity, p_slug, p_category, '[]'::jsonb, FALSE, SQLERRM);
END $$;

-- 5) Update the per-entity regen triggers to forward TG_OP.
CREATE OR REPLACE FUNCTION public.tg_regen_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.trigger_static_regen(
    CASE WHEN r.video_url IS NOT NULL AND r.video_url <> '' THEN 'reel' ELSE 'product' END,
    r.slug, r.category, r.id::text, TG_OP
  );
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_regen_article()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.trigger_static_regen('article', r.slug, NULL, r.id::text, TG_OP);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_regen_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  PERFORM public.trigger_static_regen('service', r.slug, NULL, r.id::text, TG_OP);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.tg_regen_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.trigger_static_regen('category', NULL, NULL, NULL, TG_OP);
  RETURN NULL;
END $$;
