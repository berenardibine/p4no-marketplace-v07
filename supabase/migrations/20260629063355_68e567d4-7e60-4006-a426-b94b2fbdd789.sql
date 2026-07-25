
-- ============ Schema additions ============
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notif_queue_status_next
  ON public.notification_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notif_queue_group ON public.notification_queue(group_key);
CREATE INDEX IF NOT EXISTS idx_notif_queue_user_status
  ON public.notification_queue(user_id, status);

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS services_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS seller_updates_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS promotions_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS security_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS lifecycle_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS trending_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS abandoned_enabled boolean DEFAULT true;

-- ============ Dedup table ============
CREATE TABLE IF NOT EXISTS public.notification_dedup (
  user_id uuid NOT NULL,
  dedup_key text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dedup_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_dedup TO authenticated;
GRANT ALL ON public.notification_dedup TO service_role;
ALTER TABLE public.notification_dedup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_dedup" ON public.notification_dedup
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_notif_dedup_expires ON public.notification_dedup(expires_at);

-- ============ Engagement cron state ============
CREATE TABLE IF NOT EXISTS public.engagement_cron_state (
  job_name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb
);
GRANT ALL ON public.engagement_cron_state TO service_role;
ALTER TABLE public.engagement_cron_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_cron_state" ON public.engagement_cron_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ enqueue_notification (upgraded) ============
-- Drop old one (different signature).
DROP FUNCTION IF EXISTS public.enqueue_notification(uuid,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text,
  _url text DEFAULT '/',
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _image text DEFAULT NULL,
  _priority text DEFAULT 'normal',
  _group_key text DEFAULT NULL,
  _dedup_key text DEFAULT NULL,
  _dedup_ttl_hours int DEFAULT 24
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
  pref_col text;
  pref_value boolean;
  pref_query text;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN RETURN NULL; END IF;

  -- Preference gate
  pref_col := CASE _type
    WHEN 'qa_reply' THEN 'qa_enabled'
    WHEN 'qa_question' THEN 'qa_enabled'
    WHEN 'qa_answer_helpful' THEN 'qa_enabled'
    WHEN 'comment' THEN 'comments_enabled'
    WHEN 'comment_reply' THEN 'comments_enabled'
    WHEN 'follow' THEN 'follows_enabled'
    WHEN 'badge' THEN 'badges_enabled'
    WHEN 'message' THEN 'messages_enabled'
    WHEN 'article' THEN 'articles_enabled'
    WHEN 'service' THEN 'services_enabled'
    WHEN 'seller_new_product' THEN 'seller_updates_enabled'
    WHEN 'seller_updated_product' THEN 'seller_updates_enabled'
    WHEN 'seller_trending' THEN 'trending_enabled'
    WHEN 'trending_product' THEN 'trending_enabled'
    WHEN 'price_drop' THEN 'price_drops_enabled'
    WHEN 'back_in_stock' THEN 'back_in_stock_enabled'
    WHEN 'recommendation' THEN 'recommendations_enabled'
    WHEN 'abandoned_favorite' THEN 'abandoned_enabled'
    WHEN 'promotion' THEN 'promotions_enabled'
    WHEN 'flash_sale' THEN 'promotions_enabled'
    WHEN 'marketplace' THEN 'marketplace_enabled'
    WHEN 'security' THEN 'security_enabled'
    WHEN 'lifecycle' THEN 'lifecycle_enabled'
    WHEN 'review_like' THEN 'comments_enabled'
    ELSE NULL
  END;

  IF pref_col IS NOT NULL THEN
    pref_query := format('SELECT %I FROM public.notification_preferences WHERE user_id = $1', pref_col);
    BEGIN
      EXECUTE pref_query INTO pref_value USING _user_id;
      IF pref_value = false THEN RETURN NULL; END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Dedup gate
  IF _dedup_key IS NOT NULL THEN
    DELETE FROM public.notification_dedup WHERE expires_at < now();
    BEGIN
      INSERT INTO public.notification_dedup(user_id, dedup_key, expires_at)
      VALUES (_user_id, _dedup_key, now() + make_interval(hours => _dedup_ttl_hours));
    EXCEPTION WHEN unique_violation THEN
      RETURN NULL;
    END;
  END IF;

  INSERT INTO public.notification_queue(
    user_id, notification_type, title, body, url, image_url, priority,
    status, scheduled_for, next_attempt_at, dedup_key, group_key,
    entity_type, entity_id, actor_id, metadata, data
  ) VALUES (
    _user_id, _type, _title, _body, COALESCE(_url,'/'), _image, _priority,
    'pending', now(), now(), _dedup_key, _group_key,
    _entity_type, _entity_id, _actor_id, COALESCE(_metadata,'{}'::jsonb),
    jsonb_build_object('type', _type, 'entity_type', _entity_type, 'entity_id', _entity_id, 'actor_id', _actor_id)
       || COALESCE(_metadata,'{}'::jsonb)
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid,text,text,text,text,text,uuid,uuid,jsonb,text,text,text,text,int) TO authenticated, service_role;

-- ============ Helper: product slug resolver ============
CREATE OR REPLACE FUNCTION public._product_slug(_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT slug FROM public.products WHERE id = _id
$$;
CREATE OR REPLACE FUNCTION public._service_slug(_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT slug FROM public.services WHERE id = _id
$$;
CREATE OR REPLACE FUNCTION public._article_slug(_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT slug FROM public.insight_articles WHERE id = _id
$$;

-- ============ TRIGGERS ============

-- product_comments: notify product owner OR parent comment author
CREATE OR REPLACE FUNCTION public.trg_notify_product_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_product_owner uuid;
  v_slug text;
  v_parent_author uuid;
  v_actor_name text;
BEGIN
  SELECT user_id, slug INTO v_product_owner, v_slug FROM public.products WHERE id = NEW.product_id;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM public.product_comments WHERE id = NEW.parent_id;
    IF v_parent_author IS NOT NULL AND v_parent_author <> NEW.user_id THEN
      PERFORM public.enqueue_notification(
        v_parent_author, 'comment_reply', 'New reply',
        v_actor_name || ' replied to your comment',
        '/product/' || v_slug || '?comment=' || NEW.parent_id || '&reply=' || NEW.id,
        'product_comment', NEW.id, NEW.user_id,
        jsonb_build_object('product_id', NEW.product_id, 'parent_id', NEW.parent_id),
        NULL, 'high', NULL,
        'comment_reply:' || NEW.id::text, 24
      );
    END IF;
  ELSE
    IF v_product_owner IS NOT NULL AND v_product_owner <> NEW.user_id THEN
      PERFORM public.enqueue_notification(
        v_product_owner, 'comment', 'New comment',
        v_actor_name || ' commented on your product',
        '/product/' || v_slug || '?comment=' || NEW.id,
        'product_comment', NEW.id, NEW.user_id,
        jsonb_build_object('product_id', NEW.product_id),
        NULL, 'normal', NULL,
        'product_comment:' || NEW.id::text, 24
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_product_comment ON public.product_comments;
CREATE TRIGGER notify_product_comment AFTER INSERT ON public.product_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_product_comment();

-- product_questions: notify product owner
CREATE OR REPLACE FUNCTION public.trg_notify_product_question() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_slug text; v_actor text;
BEGIN
  SELECT user_id, slug INTO v_owner, v_slug FROM public.products WHERE id = NEW.product_id;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.user_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
    PERFORM public.enqueue_notification(
      v_owner, 'qa_question', 'New question',
      v_actor || ' asked a question on your product',
      '/product/' || v_slug || '?question=' || NEW.id,
      'product_question', NEW.id, NEW.user_id,
      jsonb_build_object('product_id', NEW.product_id),
      NULL, 'high', NULL,
      'qa_question:' || NEW.id::text, 24
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_product_question ON public.product_questions;
CREATE TRIGGER notify_product_question AFTER INSERT ON public.product_questions
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_product_question();

-- product_answers: notify question author
CREATE OR REPLACE FUNCTION public.trg_notify_product_answer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_q_author uuid; v_product_id uuid; v_slug text; v_actor text;
BEGIN
  SELECT user_id, product_id INTO v_q_author, v_product_id FROM public.product_questions WHERE id = NEW.question_id;
  SELECT slug INTO v_slug FROM public.products WHERE id = v_product_id;
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.user_id;
  IF v_q_author IS NOT NULL AND v_q_author <> NEW.user_id THEN
    PERFORM public.enqueue_notification(
      v_q_author, 'qa_reply', 'New answer',
      v_actor || ' answered your question',
      '/product/' || v_slug || '?question=' || NEW.question_id || '&answer=' || NEW.id,
      'product_answer', NEW.id, NEW.user_id,
      jsonb_build_object('product_id', v_product_id, 'question_id', NEW.question_id),
      NULL, 'high', NULL,
      'qa_reply:' || NEW.id::text, 24
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_product_answer ON public.product_answers;
CREATE TRIGGER notify_product_answer AFTER INSERT ON public.product_answers
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_product_answer();

-- product_qa_likes: helpful answer
CREATE OR REPLACE FUNCTION public.trg_notify_qa_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_author uuid; v_q_id uuid; v_p_id uuid; v_slug text;
BEGIN
  IF NEW.answer_id IS NULL THEN RETURN NEW; END IF;
  SELECT a.user_id, a.question_id, q.product_id
    INTO v_author, v_q_id, v_p_id
    FROM public.product_answers a JOIN public.product_questions q ON q.id=a.question_id
    WHERE a.id = NEW.answer_id;
  SELECT slug INTO v_slug FROM public.products WHERE id = v_p_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    PERFORM public.enqueue_notification(
      v_author, 'qa_answer_helpful', 'Answer marked helpful',
      'Someone found your answer helpful',
      '/product/' || v_slug || '?question=' || v_q_id || '&answer=' || NEW.answer_id,
      'product_answer', NEW.answer_id, NEW.user_id,
      jsonb_build_object('product_id', v_p_id, 'question_id', v_q_id),
      NULL, 'low', NULL,
      'qa_helpful:' || NEW.answer_id::text || ':' || NEW.user_id::text, 24
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_qa_like ON public.product_qa_likes;
CREATE TRIGGER notify_qa_like AFTER INSERT ON public.product_qa_likes
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_qa_like();

-- follows: new follower
CREATE OR REPLACE FUNCTION public.trg_notify_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text;
BEGIN
  SELECT COALESCE(display_name, full_name, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.enqueue_notification(
    NEW.following_id, 'follow', 'New follower',
    v_actor || ' started following you',
    '/seller/' || NEW.follower_id::text,
    'profile', NEW.follower_id, NEW.follower_id,
    '{}'::jsonb, NULL, 'normal', NULL,
    'follow:' || NEW.follower_id::text || ':' || NEW.following_id::text, 24
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_follow ON public.follows;
CREATE TRIGGER notify_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_follow();

-- user_badges: new badge
CREATE OR REPLACE FUNCTION public.trg_notify_badge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_name text;
BEGIN
  SELECT name INTO v_name FROM public.badge_definitions WHERE id = NEW.badge_id;
  PERFORM public.enqueue_notification(
    NEW.user_id, 'badge', 'Achievement unlocked',
    'You earned: ' || COALESCE(v_name,'a new badge'),
    '/account?tab=badges',
    'badge', NEW.badge_id, NULL,
    jsonb_build_object('badge_name', v_name), NULL, 'normal', NULL,
    'badge:' || NEW.badge_id::text || ':' || NEW.user_id::text, 24*30
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_badge ON public.user_badges;
CREATE TRIGGER notify_badge AFTER INSERT ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_badge();

-- seller_reviews: notify seller
CREATE OR REPLACE FUNCTION public.trg_notify_seller_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text;
BEGIN
  SELECT COALESCE(display_name, full_name, 'A buyer') INTO v_actor FROM public.profiles WHERE id = NEW.reviewer_id;
  IF NEW.seller_id IS NOT NULL AND NEW.seller_id <> NEW.reviewer_id THEN
    PERFORM public.enqueue_notification(
      NEW.seller_id, 'review', 'New review',
      v_actor || ' left you a ' || COALESCE(NEW.rating::text,'?') || '-star review',
      '/seller/' || NEW.seller_id::text || '?tab=reviews',
      'seller_review', NEW.id, NEW.reviewer_id,
      jsonb_build_object('rating', NEW.rating), NULL, 'normal', NULL,
      'review:' || NEW.id::text, 24
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_seller_review ON public.seller_reviews;
CREATE TRIGGER notify_seller_review AFTER INSERT ON public.seller_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_seller_review();

-- insight articles: notify followers of author when published
CREATE OR REPLACE FUNCTION public.trg_notify_article_published() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_author text;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, full_name, 'P4NO') INTO v_author FROM public.profiles WHERE id = NEW.author_id;

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
  WHERE f.following_id = NEW.author_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_article_published ON public.insight_articles;
CREATE TRIGGER notify_article_published AFTER INSERT OR UPDATE OF status ON public.insight_articles
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_article_published();

-- products: seller-follow fanout on insert + price-drop on update
CREATE OR REPLACE FUNCTION public.trg_notify_product_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_seller text;
BEGIN
  SELECT COALESCE(display_name, full_name, 'A seller') INTO v_seller FROM public.profiles WHERE id = NEW.user_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    INSERT INTO public.notification_queue(
      user_id, notification_type, title, body, url, image_url, status,
      scheduled_for, next_attempt_at, entity_type, entity_id, actor_id, metadata, data, dedup_key, priority
    )
    SELECT f.follower_id, 'seller_new_product', v_seller || ' posted a new product', COALESCE(NEW.title,''),
           '/product/' || NEW.slug, NEW.thumbnail_url,
           'pending', now(), now(),
           'product', NEW.id, NEW.user_id,
           jsonb_build_object('slug', NEW.slug),
           jsonb_build_object('type','seller_new_product','entity_type','product','entity_id',NEW.id),
           'seller_new:' || NEW.id::text || ':' || f.follower_id::text,
           'normal'
    FROM public.follows f
    WHERE f.following_id = NEW.user_id
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.price IS NOT NULL AND OLD.price IS NOT NULL
        AND NEW.price < OLD.price AND (NEW.price / NULLIF(OLD.price,0)) <= 0.9 THEN
    -- 10%+ price drop: notify users who viewed or saved in last 14d
    INSERT INTO public.notification_queue(
      user_id, notification_type, title, body, url, image_url, status,
      scheduled_for, next_attempt_at, entity_type, entity_id, actor_id, metadata, data, dedup_key, priority
    )
    SELECT DISTINCT u.user_id, 'price_drop', 'Price dropped',
           NEW.title || ' is now cheaper',
           '/product/' || NEW.slug, NEW.thumbnail_url,
           'pending', now(), now(),
           'product', NEW.id, NEW.user_id,
           jsonb_build_object('old_price', OLD.price, 'new_price', NEW.price),
           jsonb_build_object('type','price_drop','entity_type','product','entity_id',NEW.id),
           'price_drop:' || NEW.id::text || ':' || u.user_id::text || ':' || to_char(now(),'IYYY-IW'),
           'normal'
    FROM (
      SELECT user_id FROM public.saved_items WHERE item_id = NEW.id AND item_type='product'
      UNION
      SELECT user_id FROM public.browsing_history WHERE product_id = NEW.id AND visited_at > now() - interval '14 days'
    ) u
    WHERE u.user_id IS NOT NULL AND u.user_id <> NEW.user_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_product_change ON public.products;
CREATE TRIGGER notify_product_change AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_product_change();

-- Unique index on (user_id, dedup_key) inside notification_queue to enforce dedup on direct INSERTs too
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_queue_user_dedup
  ON public.notification_queue(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
