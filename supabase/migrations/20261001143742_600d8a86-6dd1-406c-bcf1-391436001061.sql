CREATE OR REPLACE FUNCTION public.tg_check_seller_referral()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _j jsonb := to_jsonb(NEW); _uid uuid;
BEGIN
  _uid := COALESCE((_j->>'user_id')::uuid, (_j->>'seller_id')::uuid, (_j->>'owner_id')::uuid,
                   CASE WHEN TG_TABLE_NAME IN ('profiles') THEN (_j->>'id')::uuid END);
  IF _uid IS NOT NULL THEN PERFORM public._qualify_seller_referral(_uid); END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_seller_qual_product()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _j jsonb := to_jsonb(NEW); _uid uuid;
BEGIN
  _uid := COALESCE((_j->>'user_id')::uuid, (_j->>'seller_id')::uuid);
  IF _uid IS NOT NULL AND _j->>'status'='approved' THEN
    PERFORM public._qualify_seller_referral(_uid);
  END IF;
  RETURN NEW;
END $function$;