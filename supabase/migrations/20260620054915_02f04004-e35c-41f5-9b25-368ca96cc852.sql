
-- Phase 1-5 push upgrade: queue improvements, events table, triggers

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE INDEX IF NOT EXISTS idx_nq_status_next ON public.notification_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_nq_user_type ON public.notification_queue(user_id, notification_type, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nq_dedup ON public.notification_queue(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL AND status IN ('pending','sent');

-- Events table for delivered/clicked telemetry
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id uuid REFERENCES public.notification_queue(id) ON DELETE SET NULL,
  user_id uuid,
  event text NOT NULL CHECK (event IN ('delivered','clicked','opened','failed')),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_events TO anon, authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_insert_events" ON public.notification_events;
CREATE POLICY "anyone_insert_events" ON public.notification_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admins_read_events" ON public.notification_events;
CREATE POLICY "admins_read_events" ON public.notification_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ne_queue ON public.notification_events(queue_id);
CREATE INDEX IF NOT EXISTS idx_ne_event_created ON public.notification_events(event, created_at);

-- Central enqueue function
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text,
  _url text DEFAULT '/',
  _image text DEFAULT NULL,
  _dedup_key text DEFAULT NULL,
  _priority text DEFAULT 'normal'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  BEGIN
    INSERT INTO public.notification_queue
      (user_id, notification_type, title, body, url, image_url, priority,
       status, scheduled_for, next_attempt_at, dedup_key)
    VALUES
      (_user_id, _type, _title, _body, COALESCE(_url,'/'), _image, _priority,
       'pending', now(), now(), _dedup_key)
    RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NULL;
  END;
  RETURN new_id;
END $$;

-- Generic trigger helpers ---------------------------------------------------

-- product_comments -> notify product seller
CREATE OR REPLACE FUNCTION public.tg_notify_product_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; pslug text;
BEGIN
  SELECT seller_id, slug INTO owner_id, pslug FROM public.products WHERE id = NEW.product_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  PERFORM public.enqueue_notification(
    owner_id, 'comment',
    'New comment on your product',
    LEFT(COALESCE(NEW.author_name,'Someone') || ': ' || COALESCE(NEW.content,''), 140),
    '/products/' || COALESCE(pslug, NEW.product_id::text),
    NULL,
    'pc:' || NEW.id::text
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_product_comment_notify ON public.product_comments;
CREATE TRIGGER tg_product_comment_notify AFTER INSERT ON public.product_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_product_comment();

-- service_comments -> service owner
CREATE OR REPLACE FUNCTION public.tg_notify_service_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; sslug text;
BEGIN
  SELECT seller_id, slug INTO owner_id, sslug FROM public.services WHERE id = NEW.service_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  PERFORM public.enqueue_notification(
    owner_id, 'comment',
    'New comment on your service',
    LEFT(COALESCE(NEW.author_name,'Someone') || ': ' || COALESCE(NEW.content,''), 140),
    '/services/' || COALESCE(sslug, NEW.service_id::text),
    NULL,
    'sc:' || NEW.id::text
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_service_comment_notify ON public.service_comments;
CREATE TRIGGER tg_service_comment_notify AFTER INSERT ON public.service_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_service_comment();

-- insight_article_comments -> article author
CREATE OR REPLACE FUNCTION public.tg_notify_article_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; aslug text;
BEGIN
  SELECT author_id, slug INTO owner_id, aslug FROM public.insight_articles WHERE id = NEW.article_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
  PERFORM public.enqueue_notification(
    owner_id, 'comment',
    'New comment on your article',
    LEFT(COALESCE(NEW.body,''), 140),
    '/insights/article/' || COALESCE(aslug, NEW.article_id::text),
    NULL,
    'ac:' || NEW.id::text
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_article_comment_notify ON public.insight_article_comments;
CREATE TRIGGER tg_article_comment_notify AFTER INSERT ON public.insight_article_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_article_comment();

-- product_answers -> question asker
CREATE OR REPLACE FUNCTION public.tg_notify_product_answer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE asker uuid; pid uuid; pslug text;
BEGIN
  SELECT user_id, product_id INTO asker, pid FROM public.product_questions WHERE id = NEW.question_id;
  IF asker IS NULL OR asker = NEW.user_id THEN RETURN NEW; END IF;
  SELECT slug INTO pslug FROM public.products WHERE id = pid;
  PERFORM public.enqueue_notification(
    asker, 'qa_reply',
    'New reply to your question',
    LEFT(COALESCE(NEW.author_name,'Someone') || ': ' || COALESCE(NEW.content,''), 140),
    '/products/' || COALESCE(pslug, pid::text) || '#qa',
    NULL,
    'pa:' || NEW.id::text
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_product_answer_notify ON public.product_answers;
CREATE TRIGGER tg_product_answer_notify AFTER INSERT ON public.product_answers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_product_answer();

-- follows -> followed user
CREATE OR REPLACE FUNCTION public.tg_notify_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_name text;
BEGIN
  IF NEW.target_type NOT IN ('profile','user','seller') THEN RETURN NEW; END IF;
  IF NEW.target_id = NEW.follower_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO actor_name FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.enqueue_notification(
    NEW.target_id, 'follow',
    'New follower',
    COALESCE(actor_name,'Someone') || ' started following you',
    '/profile/' || NEW.follower_id::text,
    NULL,
    'fo:' || NEW.id::text
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_follow_notify ON public.follows;
CREATE TRIGGER tg_follow_notify AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_follow();

-- user_badges -> badge holder
CREATE OR REPLACE FUNCTION public.tg_notify_badge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.enqueue_notification(
    NEW.user_id, 'badge',
    'You earned a new badge',
    'Congrats! You unlocked: ' || NEW.badge_code,
    '/account?tab=badges',
    NULL,
    'bg:' || NEW.id::text
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_badge_notify ON public.user_badges;
CREATE TRIGGER tg_badge_notify AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_badge();

-- Cron jobs ------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('dispatch-queue-1min','group-pending-5min');
    PERFORM cron.schedule(
      'dispatch-queue-1min', '* * * * *',
      $sql$
      select net.http_post(
        url:='https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/dispatch-queue',
        headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
        body:='{}'::jsonb);
      $sql$
    );
    PERFORM cron.schedule(
      'group-pending-5min', '*/5 * * * *',
      $sql$
      select net.http_post(
        url:='https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/group-pending-notifications',
        headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
        body:='{}'::jsonb);
      $sql$
    );
  END IF;
END $cron$;
