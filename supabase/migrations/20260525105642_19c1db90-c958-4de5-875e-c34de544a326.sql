ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_profile_slug(base text, pid uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  s text; candidate text; n int := 0;
BEGIN
  s := lower(regexp_replace(coalesce(NULLIF(trim(base), ''), 'user'), '[^a-z0-9]+', '-', 'g'));
  s := trim(both '-' from s);
  IF s = '' THEN s := 'user'; END IF;
  candidate := s;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = candidate AND id <> pid) LOOP
    n := n + 1; candidate := s || '-' || n::text;
  END LOOP;
  RETURN candidate;
END;
$$ SET search_path = public;

CREATE OR REPLACE FUNCTION public.profiles_set_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_profile_slug(coalesce(NEW.full_name, 'user'), NEW.id);
  END IF;
  RETURN NEW;
END;
$$ SET search_path = public;

DROP TRIGGER IF EXISTS trg_profiles_set_slug ON public.profiles;
CREATE TRIGGER trg_profiles_set_slug
BEFORE INSERT OR UPDATE OF full_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_set_slug();

UPDATE public.profiles
SET slug = public.generate_profile_slug(coalesce(full_name, 'user'), id)
WHERE slug IS NULL OR slug = '';

CREATE INDEX IF NOT EXISTS idx_profiles_slug ON public.profiles(slug);