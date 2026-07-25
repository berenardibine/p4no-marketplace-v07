
-- Service categories
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read service_categories" ON public.service_categories
  FOR SELECT USING (true);

CREATE POLICY "Admin full access service_categories" ON public.service_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Services
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  slug text UNIQUE,
  category text,
  short_description text,
  description text NOT NULL,
  pricing_type text NOT NULL DEFAULT 'fixed', -- fixed | negotiable | starting_from
  price numeric DEFAULT 0,
  currency_symbol text,
  currency_code text,
  location text,
  country text,
  lat numeric,
  lng numeric,
  whatsapp_number text,
  phone_number text,
  images text[] NOT NULL DEFAULT '{}',
  video_url text,
  video_thumbnail text,
  years_experience integer DEFAULT 0,
  availability text,
  portfolio_links text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active', -- active | paused | pending | rejected | suspended
  is_featured boolean NOT NULL DEFAULT false,
  admin_notes text,
  views integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_status_created ON public.services(status, created_at DESC);
CREATE INDEX idx_services_category ON public.services(category);
CREATE INDEX idx_services_seller ON public.services(seller_id);
CREATE INDEX idx_services_featured ON public.services(is_featured) WHERE is_featured = true;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active services" ON public.services
  FOR SELECT USING (status = 'active' OR auth.uid() = seller_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers insert own services" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers update own services" ON public.services
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers delete own services" ON public.services
  FOR DELETE TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Admin full access services" ON public.services
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto slug + updated_at trigger
CREATE OR REPLACE FUNCTION public.services_set_slug_and_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  NEW.updated_at := now();
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(coalesce(NEW.title, 'service'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN base_slug := 'service'; END IF;
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.services WHERE slug = final_slug AND id <> NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter::text;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER services_before_insert_update
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.services_set_slug_and_timestamp();

-- Service requests
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  buyer_id uuid,
  buyer_name text NOT NULL,
  buyer_phone text,
  buyer_location text,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | contacted | completed | cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_requests_seller ON public.service_requests(seller_id, status);
CREATE INDEX idx_service_requests_service ON public.service_requests(service_id);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create service requests" ON public.service_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Sellers read own service requests" ON public.service_requests
  FOR SELECT USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Sellers update own service requests" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Admin full access service_requests" ON public.service_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service views
CREATE TABLE public.service_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  user_id uuid,
  session_id text NOT NULL,
  ref_source text DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_views_service ON public.service_views(service_id, created_at DESC);

ALTER TABLE public.service_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon insert service_views" ON public.service_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read service_views" ON public.service_views
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Service likes
CREATE TABLE public.service_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, user_id)
);

ALTER TABLE public.service_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read service_likes" ON public.service_likes
  FOR SELECT USING (true);

CREATE POLICY "Users insert own service_likes" ON public.service_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own service_likes" ON public.service_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Admin setting for verification gating
INSERT INTO public.admin_settings (key, value)
VALUES ('services_require_verification', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed common service categories
INSERT INTO public.service_categories (name, slug, icon, sort_order) VALUES
  ('Home Services', 'home-services', '🏠', 1),
  ('Beauty & Wellness', 'beauty-wellness', '💅', 2),
  ('Tutoring & Education', 'tutoring-education', '📚', 3),
  ('Tech & IT', 'tech-it', '💻', 4),
  ('Design & Creative', 'design-creative', '🎨', 5),
  ('Events & Photography', 'events-photography', '📸', 6),
  ('Repairs', 'repairs', '🔧', 7),
  ('Transport & Delivery', 'transport-delivery', '🚚', 8),
  ('Health', 'health', '🩺', 9),
  ('Business Services', 'business-services', '💼', 10),
  ('Other', 'other', '✨', 99)
ON CONFLICT (slug) DO NOTHING;
