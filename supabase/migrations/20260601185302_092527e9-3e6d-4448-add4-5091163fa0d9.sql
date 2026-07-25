
-- ============================================================
-- Phase 3: Popular This Week
-- ============================================================
CREATE TABLE public.weekly_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('product','service','reel','article')),
  item_id uuid NOT NULL,
  week_start date NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id, week_start)
);
CREATE INDEX idx_weekly_views_lookup ON public.weekly_views (item_type, week_start, view_count DESC);

GRANT SELECT ON public.weekly_views TO anon, authenticated;
GRANT ALL ON public.weekly_views TO service_role;

ALTER TABLE public.weekly_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_views public read" ON public.weekly_views FOR SELECT USING (true);
CREATE POLICY "weekly_views admin manage" ON public.weekly_views FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.popular_weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  week_start date NOT NULL,
  rank integer NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, week_start, item_id)
);
CREATE INDEX idx_popular_snapshots_lookup ON public.popular_weekly_snapshots (item_type, week_start, rank);

GRANT SELECT ON public.popular_weekly_snapshots TO anon, authenticated;
GRANT ALL ON public.popular_weekly_snapshots TO service_role;

ALTER TABLE public.popular_weekly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popular_snapshots public read" ON public.popular_weekly_snapshots FOR SELECT USING (true);
CREATE POLICY "popular_snapshots admin manage" ON public.popular_weekly_snapshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Atomic increment RPC
CREATE OR REPLACE FUNCTION public.increment_weekly_view(p_item_type text, p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week date := date_trunc('week', now())::date;
BEGIN
  IF p_item_type NOT IN ('product','service','reel','article') THEN RETURN; END IF;
  INSERT INTO public.weekly_views (item_type, item_id, week_start, view_count)
  VALUES (p_item_type, p_item_id, v_week, 1)
  ON CONFLICT (item_type, item_id, week_start)
  DO UPDATE SET view_count = public.weekly_views.view_count + 1, updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.increment_weekly_view(text, uuid) TO anon, authenticated;

-- ============================================================
-- Phase 4: Achievement Badges
-- ============================================================
CREATE TABLE public.badge_definitions (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'Award',
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  category text NOT NULL DEFAULT 'general',
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.badge_definitions TO anon, authenticated;
GRANT ALL ON public.badge_definitions TO service_role;

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badge_def public read" ON public.badge_definitions FOR SELECT USING (true);
CREATE POLICY "badge_def admin manage" ON public.badge_definitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_code text NOT NULL REFERENCES public.badge_definitions(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, badge_code)
);
CREATE INDEX idx_user_badges_user ON public.user_badges (user_id, is_active);

GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges public read" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "user_badges admin manage" ON public.user_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed starter badges
INSERT INTO public.badge_definitions (code, name, description, icon, tier, category, requirements, display_order) VALUES
('verified_seller','Verified Seller','Identity verified by P4NO','BadgeCheck','silver','trust','{"type":"verified"}',1),
('top_seller','Top Seller','10+ completed orders','Crown','gold','sales','{"type":"orders","min":10}',2),
('rising_star','Rising Star','First listing published','Sparkles','bronze','milestone','{"type":"first_product"}',3),
('community_helper','Community Helper','Answered 5+ product questions','MessagesSquare','silver','community','{"type":"answers","min":5}',4),
('knowledge_contributor','Knowledge Contributor','Published an Insights article','BookOpen','silver','community','{"type":"articles","min":1}',5),
('trusted_reviewer','Trusted Reviewer','Left 10+ helpful reviews','Star','silver','community','{"type":"reviews","min":10}',6),
('streak_master','Streak Master','7-day activity streak','Flame','gold','engagement','{"type":"streak","days":7}',7),
('first_sale','First Sale','Closed your first order','ShoppingBag','bronze','sales','{"type":"orders","min":1}',8),
('power_lister','Power Lister','20+ active listings','Layers','gold','sales','{"type":"products","min":20}',9),
('engagement_star','Engagement Star','1,000+ profile views','Eye','platinum','engagement','{"type":"profile_views","min":1000}',10);
