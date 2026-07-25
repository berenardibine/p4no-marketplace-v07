
-- Article view tracking
CREATE TABLE public.insight_article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.insight_articles(id) ON DELETE CASCADE,
  user_id uuid NULL,
  session_id text NULL,
  dwell_ms integer NOT NULL DEFAULT 0,
  referrer text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insight_views_article ON public.insight_article_views(article_id);
CREATE INDEX idx_insight_views_created ON public.insight_article_views(created_at DESC);
CREATE INDEX idx_insight_views_user ON public.insight_article_views(user_id);

GRANT SELECT, INSERT, UPDATE ON public.insight_article_views TO anon;
GRANT SELECT, INSERT, UPDATE ON public.insight_article_views TO authenticated;
GRANT ALL ON public.insight_article_views TO service_role;

ALTER TABLE public.insight_article_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert view"
  ON public.insight_article_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update own view dwell"
  ON public.insight_article_views FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins read all views"
  ON public.insight_article_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Comment moderation flag
ALTER TABLE public.insight_article_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
