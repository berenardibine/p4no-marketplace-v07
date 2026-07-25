
-- Bootstrap wallet + level + referral_code on new profile
DROP TRIGGER IF EXISTS trg_profile_growth_bootstrap ON public.profiles;
CREATE TRIGGER trg_profile_growth_bootstrap
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profile_growth_bootstrap();

-- Seller qualification: fire when profile fields update, when identity verified, and when products change
CREATE OR REPLACE FUNCTION public.tg_seller_qual_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public._qualify_seller_referral(NEW.id); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_seller_qual_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN PERFORM public._qualify_seller_referral(NEW.user_id); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_seller_qual_product() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.status='approved' THEN
    PERFORM public._qualify_seller_referral(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seller_qual_profile ON public.profiles;
CREATE TRIGGER trg_seller_qual_profile
AFTER UPDATE OF identity_verified, phone_number, email, full_name, status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_seller_qual_profile();

DROP TRIGGER IF EXISTS trg_seller_qual_identity ON public.identity_verifications;
CREATE TRIGGER trg_seller_qual_identity
AFTER INSERT OR UPDATE ON public.identity_verifications
FOR EACH ROW EXECUTE FUNCTION public.tg_seller_qual_identity();

DROP TRIGGER IF EXISTS trg_seller_qual_product ON public.products;
CREATE TRIGGER trg_seller_qual_product
AFTER INSERT OR UPDATE OF status ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_seller_qual_product();

-- Server-side growth events from user actions (buyers)
CREATE OR REPLACE FUNCTION public.tg_growth_event_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _weights JSONB; _w INT; _new_score INT; _ref RECORD; _thr INT;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  _weights := public.gcfg('growth.event_weights');
  _w := COALESCE((_weights->>'like')::int,0);
  IF _w<=0 THEN RETURN NEW; END IF;
  INSERT INTO public.growth_events(user_id,event_type,weight,entity_id,entity_type)
    VALUES(NEW.user_id,'like',_w,NEW.product_id,'product') ON CONFLICT DO NOTHING;
  SELECT * INTO _ref FROM public.referrals WHERE referred_user_id=NEW.user_id AND type='buyer' AND status IN ('pending','qualifying') LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(sum(weight),0) INTO _new_score FROM public.growth_events WHERE user_id=NEW.user_id;
    UPDATE public.referrals SET growth_score=_new_score, status=CASE WHEN status='pending' THEN 'qualifying' ELSE status END WHERE id=_ref.id;
    _thr := (public.gcfg('growth.buyer_threshold')::text)::int;
    IF _new_score >= _thr THEN PERFORM public._qualify_buyer_referral(_ref.id); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_growth_event_like ON public.product_likes;
CREATE TRIGGER trg_growth_event_like AFTER INSERT ON public.product_likes
FOR EACH ROW EXECUTE FUNCTION public.tg_growth_event_like();

CREATE OR REPLACE FUNCTION public.tg_growth_event_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _weights JSONB; _w INT; _new_score INT; _ref RECORD; _thr INT;
BEGIN
  IF NEW.follower_id IS NULL THEN RETURN NEW; END IF;
  _weights := public.gcfg('growth.event_weights');
  _w := COALESCE((_weights->>'follow')::int,0);
  IF _w<=0 THEN RETURN NEW; END IF;
  INSERT INTO public.growth_events(user_id,event_type,weight,entity_id,entity_type)
    VALUES(NEW.follower_id,'follow',_w,NEW.target_id,'user') ON CONFLICT DO NOTHING;
  SELECT * INTO _ref FROM public.referrals WHERE referred_user_id=NEW.follower_id AND type='buyer' AND status IN ('pending','qualifying') LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(sum(weight),0) INTO _new_score FROM public.growth_events WHERE user_id=NEW.follower_id;
    UPDATE public.referrals SET growth_score=_new_score, status=CASE WHEN status='pending' THEN 'qualifying' ELSE status END WHERE id=_ref.id;
    _thr := (public.gcfg('growth.buyer_threshold')::text)::int;
    IF _new_score >= _thr THEN PERFORM public._qualify_buyer_referral(_ref.id); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_growth_event_follow ON public.follows;
CREATE TRIGGER trg_growth_event_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.tg_growth_event_follow();

CREATE OR REPLACE FUNCTION public.tg_growth_event_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _weights JSONB; _w INT; _new_score INT; _ref RECORD; _thr INT;
BEGIN
  IF NEW.buyer_id IS NULL THEN RETURN NEW; END IF;
  _weights := public.gcfg('growth.event_weights');
  _w := COALESCE((_weights->>'order')::int,0);
  IF _w<=0 THEN RETURN NEW; END IF;
  INSERT INTO public.growth_events(user_id,event_type,weight,entity_id,entity_type)
    VALUES(NEW.buyer_id,'order',_w,NEW.id,'order') ON CONFLICT DO NOTHING;
  SELECT * INTO _ref FROM public.referrals WHERE referred_user_id=NEW.buyer_id AND type='buyer' AND status IN ('pending','qualifying') LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(sum(weight),0) INTO _new_score FROM public.growth_events WHERE user_id=NEW.buyer_id;
    UPDATE public.referrals SET growth_score=_new_score, status=CASE WHEN status='pending' THEN 'qualifying' ELSE status END WHERE id=_ref.id;
    _thr := (public.gcfg('growth.buyer_threshold')::text)::int;
    IF _new_score >= _thr THEN PERFORM public._qualify_buyer_referral(_ref.id); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_growth_event_order ON public.orders;
CREATE TRIGGER trg_growth_event_order AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_growth_event_order();

-- Backfill: bootstrap existing profiles that never got wallets/level/referral_code
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.ensure_growth_bootstrap(r.id);
  END LOOP;
END $$;
