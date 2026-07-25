
-- ============ social_comments (polymorphic) ============
CREATE TABLE public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('product','service','reel')),
  target_id uuid NOT NULL,
  parent_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  content text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_comments_target ON public.social_comments(target_type, target_id) WHERE is_deleted = false;
CREATE INDEX idx_social_comments_parent ON public.social_comments(parent_id);
CREATE INDEX idx_social_comments_user ON public.social_comments(user_id);

ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read social_comments"
ON public.social_comments FOR SELECT USING (is_deleted = false);

CREATE POLICY "Auth insert own social_comments"
ON public.social_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own social_comments"
ON public.social_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own social_comments"
ON public.social_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin full access social_comments"
ON public.social_comments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ service_ratings ============
CREATE TABLE public.service_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);
CREATE INDEX idx_service_ratings_service ON public.service_ratings(service_id);

ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read service_ratings"
ON public.service_ratings FOR SELECT USING (true);

CREATE POLICY "Auth insert own service_ratings"
ON public.service_ratings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own service_ratings"
ON public.service_ratings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own service_ratings"
ON public.service_ratings FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin full access service_ratings"
ON public.service_ratings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ content_reports ============
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('product','service','reel','comment','user','shop')),
  target_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('scam','spam','inappropriate','fake_provider','abusive','other')),
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','actioned','hidden')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_reports_target ON public.content_reports(target_type, target_id);
CREATE INDEX idx_content_reports_status ON public.content_reports(status);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth insert own content_reports"
ON public.content_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users read own content_reports"
ON public.content_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

CREATE POLICY "Admin full access content_reports"
ON public.content_reports FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER update_social_comments_updated_at
BEFORE UPDATE ON public.social_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_ratings_updated_at
BEFORE UPDATE ON public.service_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_reports_updated_at
BEFORE UPDATE ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
