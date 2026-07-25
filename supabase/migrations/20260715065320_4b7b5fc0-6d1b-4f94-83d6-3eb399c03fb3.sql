
-- Fix notification triggers that reference non-existent columns
-- profiles has no display_name (only full_name)
-- products has seller_id (not user_id) and no thumbnail_url

CREATE OR REPLACE FUNCTION public.trg_notify_product_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_product_owner uuid;
  v_slug text;
  v_parent_author uuid;
  v_actor_name text;
BEGIN
  SELECT seller_id, slug INTO v_product_owner, v_slug FROM public.products WHERE id = NEW.product_id;
  SELECT COALESCE(full_name, 'Someone') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;

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

CREATE OR REPLACE FUNCTION public.trg_notify_product_question() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_slug text; v_actor text;
BEGIN
  SELECT seller_id, slug INTO v_owner, v_slug FROM public.products WHERE id = NEW.product_id;
  SELECT COALESCE(full_name, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.user_id;
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

CREATE OR REPLACE FUNCTION public.trg_notify_product_answer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_q_author uuid; v_product_id uuid; v_slug text; v_actor text;
BEGIN
  SELECT user_id, product_id INTO v_q_author, v_product_id FROM public.product_questions WHERE id = NEW.question_id;
  SELECT slug INTO v_slug FROM public.products WHERE id = v_product_id;
  SELECT COALESCE(full_name, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.user_id;
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

CREATE OR REPLACE FUNCTION public.trg_notify_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text;
BEGIN
  SELECT COALESCE(full_name, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.follower_id;
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

CREATE OR REPLACE FUNCTION public.trg_notify_seller_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text;
BEGIN
  SELECT COALESCE(full_name, 'A buyer') INTO v_actor FROM public.profiles WHERE id = NEW.reviewer_id;
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

CREATE OR REPLACE FUNCTION public.trg_notify_article_published() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  WHERE f.following_id = NEW.author_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_notify_product_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_seller text; v_image text;
BEGIN
  SELECT COALESCE(full_name, 'A seller') INTO v_seller FROM public.profiles WHERE id = NEW.seller_id;
  v_image := CASE WHEN NEW.images IS NOT NULL AND array_length(NEW.images,1) > 0 THEN NEW.images[1] ELSE NULL END;

  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    INSERT INTO public.notification_queue(
      user_id, notification_type, title, body, url, image_url, status,
      scheduled_for, next_attempt_at, entity_type, entity_id, actor_id, metadata, data, dedup_key, priority
    )
    SELECT f.follower_id, 'seller_new_product', v_seller || ' posted a new product', COALESCE(NEW.title,''),
           '/product/' || NEW.slug, v_image,
           'pending', now(), now(),
           'product', NEW.id, NEW.seller_id,
           jsonb_build_object('slug', NEW.slug),
           jsonb_build_object('type','seller_new_product','entity_type','product','entity_id',NEW.id),
           'seller_new:' || NEW.id::text || ':' || f.follower_id::text,
           'normal'
    FROM public.follows f
    WHERE f.following_id = NEW.seller_id
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.price IS NOT NULL AND OLD.price IS NOT NULL
        AND NEW.price < OLD.price AND (NEW.price / NULLIF(OLD.price,0)) <= 0.9 THEN
    INSERT INTO public.notification_queue(
      user_id, notification_type, title, body, url, image_url, status,
      scheduled_for, next_attempt_at, entity_type, entity_id, actor_id, metadata, data, dedup_key, priority
    )
    SELECT DISTINCT u.user_id, 'price_drop', 'Price dropped',
           NEW.title || ' is now cheaper',
           '/product/' || NEW.slug, v_image,
           'pending', now(), now(),
           'product', NEW.id, NEW.seller_id,
           jsonb_build_object('old_price', OLD.price, 'new_price', NEW.price),
           jsonb_build_object('type','price_drop','entity_type','product','entity_id',NEW.id),
           'price_drop:' || NEW.id::text || ':' || u.user_id::text,
           'normal'
    FROM (
      SELECT user_id FROM public.product_views WHERE product_id = NEW.id AND created_at > now() - interval '14 days'
      UNION
      SELECT user_id FROM public.saved_items WHERE product_id = NEW.id
    ) u
    WHERE u.user_id IS NOT NULL AND u.user_id <> NEW.seller_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
