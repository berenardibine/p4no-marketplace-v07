-- 1. Profiles: hide private contact/identity columns from anonymous visitors
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, business_name, bio, location, user_type, profile_image, referral_code, status,
  rating, rating_count, identity_verified, created_at, updated_at, last_active, province_id, district_id, sector_id,
  country, country_code, currency_code, currency_symbol, city, region, preferred_view, is_verified, slug)
  ON public.profiles TO anon;

-- Intentional contact path: only for real sellers/providers (has product, shop or service)
CREATE OR REPLACE FUNCTION public.get_seller_contact(_seller_id uuid)
RETURNS TABLE(whatsapp_number text, call_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.whatsapp_number, p.call_number FROM public.profiles p
  WHERE p.id = _seller_id AND (
    EXISTS (SELECT 1 FROM public.products x WHERE x.seller_id = p.id)
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.seller_id = p.id)
    OR EXISTS (SELECT 1 FROM public.services v WHERE v.seller_id = p.id));
$$;
GRANT EXECUTE ON FUNCTION public.get_seller_contact(uuid) TO anon, authenticated;

-- 2. ad-image storage: remove permissive policies; admin-only writes remain via "Admin manage ad images"
DROP POLICY IF EXISTS "Admin can delete ad images op84s1_0" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete ad images op84s1_1" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update ad images op84s1_0" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update ad images op84s1_1" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload ad image op84s1_0" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view ad images op84s1_0" ON storage.objects;
DROP POLICY IF EXISTS "Admin manage ad images" ON storage.objects;
CREATE POLICY "Admin manage ad images" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'ad-image' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'ad-image' AND public.has_role(auth.uid(), 'admin'));

-- 3. Shop default delivery rules
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS delivery_rules jsonb;