
-- ── Rate-limit helper ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_notify(_user_id uuid, _type text, _max_per_day int DEFAULT 5)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT count(*) < _max_per_day
    FROM public.notifications
    WHERE user_id = _user_id
      AND type = _type
      AND created_at > now() - interval '24 hours'
  ), true);
$$;

-- ── notify_user helper ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _type text,
  _title text,
  _message text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _image_url text DEFAULT NULL,
  _action_url text DEFAULT NULL,
  _priority text DEFAULT 'medium',
  _max_per_day int DEFAULT 20
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN
    RETURN NULL;
  END IF;
  IF NOT public.can_notify(_user_id, _type, _max_per_day) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.notifications (
    user_id, type, title, message, entity_type, entity_id, actor_id,
    image_url, action_url, priority, is_read
  ) VALUES (
    _user_id, _type, _title, _message, _entity_type, _entity_id, _actor_id,
    _image_url, _action_url, _priority, false
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- ── BADGE EARNED ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_user_badge_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bdef record;
BEGIN
  SELECT name, description, icon INTO bdef
  FROM public.badge_definitions WHERE code = NEW.badge_code;
  PERFORM public.notify_user(
    NEW.user_id,
    'badge',
    COALESCE('Badge unlocked: ' || bdef.name, 'Badge unlocked'),
    COALESCE(bdef.description, 'You earned a new badge on P4NO'),
    'badge', NULL, NULL,
    bdef.icon,
    '/account/badges',
    'high', 50
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_badges_notify ON public.user_badges;
CREATE TRIGGER user_badges_notify
AFTER INSERT ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.trg_user_badge_earned();

-- ── NEW FOLLOWER ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uid uuid;
  actor_name text;
  actor_avatar text;
BEGIN
  IF NEW.target_type IN ('seller','user','profile') THEN
    target_uid := NEW.target_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT full_name, profile_image INTO actor_name, actor_avatar
  FROM public.profiles WHERE id = NEW.follower_id;

  PERFORM public.notify_user(
    target_uid,
    'follow',
    'New follower',
    COALESCE(actor_name, 'Someone') || ' started following you',
    'user', NEW.follower_id, NEW.follower_id,
    actor_avatar,
    '/seller/' || NEW.follower_id::text,
    'medium', 30
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follows_notify ON public.follows;
CREATE TRIGGER follows_notify
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.trg_new_follower();

-- ── NEW PRODUCT QUESTION ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_new_product_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT seller_id, title, images, slug INTO p
  FROM public.products WHERE id = NEW.product_id;
  IF p.seller_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.notify_user(
    p.seller_id,
    'qa_question',
    'New question on your product',
    'Someone asked a question about "' || COALESCE(p.title,'your product') || '"',
    'product', NEW.product_id, NEW.user_id,
    CASE WHEN p.images IS NOT NULL AND array_length(p.images,1) > 0 THEN p.images[1] ELSE NULL END,
    '/product/' || COALESCE(p.slug, NEW.product_id::text),
    'medium', 20
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_questions_notify ON public.product_questions;
CREATE TRIGGER product_questions_notify
AFTER INSERT ON public.product_questions
FOR EACH ROW EXECUTE FUNCTION public.trg_new_product_question();

-- ── NEW PRODUCT COMMENT ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_new_product_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT seller_id, title, images, slug INTO p
  FROM public.products WHERE id = NEW.product_id;
  IF p.seller_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.notify_user(
    p.seller_id,
    'comment',
    'New comment on your product',
    COALESCE(NEW.author_name,'Someone') || ' commented on "' || COALESCE(p.title,'your product') || '"',
    'product', NEW.product_id, NEW.user_id,
    CASE WHEN p.images IS NOT NULL AND array_length(p.images,1) > 0 THEN p.images[1] ELSE NULL END,
    '/product/' || COALESCE(p.slug, NEW.product_id::text),
    'medium', 20
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_comments_notify ON public.product_comments;
CREATE TRIGGER product_comments_notify
AFTER INSERT ON public.product_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_new_product_comment();

-- ── NEW SELLER REVIEW ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_new_seller_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
BEGIN
  IF NEW.seller_id IS NULL THEN RETURN NEW; END IF;
  SELECT full_name INTO actor_name FROM public.profiles WHERE id = NEW.buyer_id;

  PERFORM public.notify_user(
    NEW.seller_id,
    'review',
    'New ' || NEW.rating::text || '★ review',
    COALESCE(actor_name,'A buyer') || ' rated your shop ' || NEW.rating::text || '/5',
    'seller_review', NEW.id, NEW.buyer_id,
    NULL,
    '/seller/' || NEW.seller_id::text,
    'high', 20
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seller_reviews_notify ON public.seller_reviews;
CREATE TRIGGER seller_reviews_notify
AFTER INSERT ON public.seller_reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_new_seller_review();

-- ── PRODUCT SAVED ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_product_saved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  IF NEW.item_type <> 'product' THEN RETURN NEW; END IF;
  SELECT seller_id, title, images, slug INTO p
  FROM public.products WHERE id = NEW.item_id;
  IF p.seller_id IS NULL OR p.seller_id = NEW.user_id THEN RETURN NEW; END IF;

  PERFORM public.notify_user(
    p.seller_id,
    'save',
    'Someone saved your product',
    '"' || COALESCE(p.title,'Your product') || '" was just saved',
    'product', NEW.item_id, NEW.user_id,
    CASE WHEN p.images IS NOT NULL AND array_length(p.images,1) > 0 THEN p.images[1] ELSE NULL END,
    '/product/' || COALESCE(p.slug, NEW.item_id::text),
    'low', 5
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS saved_items_notify ON public.saved_items;
CREATE TRIGGER saved_items_notify
AFTER INSERT ON public.saved_items
FOR EACH ROW EXECUTE FUNCTION public.trg_product_saved();

-- ── PRODUCT VIEW MILESTONES ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_product_view_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  milestones int[] := ARRAY[100, 500, 1000, 5000, 10000];
  m int;
  reached int := NULL;
BEGIN
  IF NEW.views IS NULL OR OLD.views IS NULL OR NEW.views <= OLD.views THEN
    RETURN NEW;
  END IF;
  FOREACH m IN ARRAY milestones LOOP
    IF OLD.views < m AND NEW.views >= m THEN
      reached := m;
    END IF;
  END LOOP;
  IF reached IS NULL OR NEW.seller_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.notify_user(
    NEW.seller_id,
    'product_milestone',
    reached::text || ' views on your product 🎉',
    '"' || COALESCE(NEW.title,'Your product') || '" just passed ' || reached::text || ' views',
    'product', NEW.id, NULL,
    CASE WHEN NEW.images IS NOT NULL AND array_length(NEW.images,1) > 0 THEN NEW.images[1] ELSE NULL END,
    '/product/' || COALESCE(NEW.slug, NEW.id::text),
    'high', 10
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_view_milestone_notify ON public.products;
CREATE TRIGGER products_view_milestone_notify
AFTER UPDATE OF views ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_product_view_milestone();
