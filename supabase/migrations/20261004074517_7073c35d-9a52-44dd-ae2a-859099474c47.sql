CREATE OR REPLACE FUNCTION public.trg_enqueue_seller_profile_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shops WHERE seller_id = NEW.id OR owner_id = NEW.id) THEN
    PERFORM public.enqueue_generation('seller', NEW.id::text, 'update');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_seller_static ON public.profiles;
CREATE TRIGGER trg_profiles_seller_static
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (OLD.full_name IS DISTINCT FROM NEW.full_name
   OR OLD.profile_image IS DISTINCT FROM NEW.profile_image
   OR OLD.bio IS DISTINCT FROM NEW.bio
   OR OLD.whatsapp_number IS DISTINCT FROM NEW.whatsapp_number
   OR OLD.call_number IS DISTINCT FROM NEW.call_number)
EXECUTE FUNCTION public.trg_enqueue_seller_profile_change();