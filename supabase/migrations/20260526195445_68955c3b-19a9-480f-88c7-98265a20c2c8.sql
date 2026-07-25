
-- ============== CATEGORIES ==============
CREATE TABLE public.insight_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insight_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_categories TO authenticated;
GRANT ALL ON public.insight_categories TO service_role;
ALTER TABLE public.insight_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active categories public" ON public.insight_categories
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage categories" ON public.insight_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== ARTICLES ==============
CREATE TABLE public.insight_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body JSONB,
  body_html TEXT,
  thumbnail_url TEXT,
  thumbnail_blur TEXT,
  category_id UUID REFERENCES public.insight_categories(id) ON DELETE SET NULL,
  author_id UUID,
  tags TEXT[] NOT NULL DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  seo_keywords TEXT[] NOT NULL DEFAULT '{}',
  og_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled')),
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  reading_time_min INT NOT NULL DEFAULT 1,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insight_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_articles TO authenticated;
GRANT ALL ON public.insight_articles TO service_role;
ALTER TABLE public.insight_articles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_insight_articles_status_pub ON public.insight_articles(status, published_at DESC);
CREATE INDEX idx_insight_articles_category ON public.insight_articles(category_id);
CREATE INDEX idx_insight_articles_tags ON public.insight_articles USING GIN(tags);

CREATE POLICY "Published articles public" ON public.insight_articles
  FOR SELECT USING (
    (status = 'published' AND (published_at IS NULL OR published_at <= now()))
    OR auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins manage articles" ON public.insight_articles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== LIKES ==============
CREATE TABLE public.insight_article_likes (
  article_id UUID NOT NULL REFERENCES public.insight_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT ON public.insight_article_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.insight_article_likes TO authenticated;
GRANT ALL ON public.insight_article_likes TO service_role;
ALTER TABLE public.insight_article_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes public read" ON public.insight_article_likes FOR SELECT USING (true);
CREATE POLICY "Users like own" ON public.insight_article_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own" ON public.insight_article_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============== SAVES ==============
CREATE TABLE public.insight_article_saves (
  article_id UUID NOT NULL REFERENCES public.insight_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.insight_article_saves TO authenticated;
GRANT ALL ON public.insight_article_saves TO service_role;
ALTER TABLE public.insight_article_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own saves" ON public.insight_article_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save own" ON public.insight_article_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unsave own" ON public.insight_article_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============== COMMENTS ==============
CREATE TABLE public.insight_article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.insight_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.insight_article_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insight_article_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_article_comments TO authenticated;
GRANT ALL ON public.insight_article_comments TO service_role;
ALTER TABLE public.insight_article_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_insight_comments_article ON public.insight_article_comments(article_id, created_at DESC);
CREATE POLICY "Comments public read" ON public.insight_article_comments FOR SELECT USING (true);
CREATE POLICY "Users comment own" ON public.insight_article_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own comments" ON public.insight_article_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own or admin" ON public.insight_article_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============== SLUG HELPERS ==============
CREATE OR REPLACE FUNCTION public.generate_insight_article_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base TEXT; candidate TEXT; n INT := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND length(trim(NEW.slug)) > 0 THEN RETURN NEW; END IF;
  base := lower(regexp_replace(coalesce(NEW.title,'article'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  IF length(base) = 0 THEN base := 'article'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.insight_articles WHERE slug = candidate AND id <> NEW.id) LOOP
    n := n + 1; candidate := base || '-' || n;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END $$;

CREATE TRIGGER insight_articles_slug_trg
BEFORE INSERT OR UPDATE ON public.insight_articles
FOR EACH ROW EXECUTE FUNCTION public.generate_insight_article_slug();

CREATE OR REPLACE FUNCTION public.touch_insight_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER insight_articles_touch BEFORE UPDATE ON public.insight_articles FOR EACH ROW EXECUTE FUNCTION public.touch_insight_updated_at();
CREATE TRIGGER insight_categories_touch BEFORE UPDATE ON public.insight_categories FOR EACH ROW EXECUTE FUNCTION public.touch_insight_updated_at();
CREATE TRIGGER insight_comments_touch BEFORE UPDATE ON public.insight_article_comments FOR EACH ROW EXECUTE FUNCTION public.touch_insight_updated_at();

-- ============== LIKE COUNT TRIGGER ==============
CREATE OR REPLACE FUNCTION public.bump_insight_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.insight_articles SET like_count = like_count + 1 WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.insight_articles SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.article_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER insight_likes_count AFTER INSERT OR DELETE ON public.insight_article_likes FOR EACH ROW EXECUTE FUNCTION public.bump_insight_like_count();

-- ============== SCHEDULED PUBLISH ==============
CREATE OR REPLACE FUNCTION public.publish_scheduled_insights()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.insight_articles
  SET status = 'published', published_at = COALESCE(published_at, scheduled_for, now())
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= now();
$$;

-- Seed default categories
INSERT INTO public.insight_categories (name, slug, description, sort_order) VALUES
  ('Business Tips', 'business-tips', 'Practical advice for running and growing a small business.', 1),
  ('Technology', 'technology', 'Tech trends, tools, and how-to guides.', 2),
  ('Online Selling', 'online-selling', 'Strategies for selling more on P4NO and beyond.', 3),
  ('Marketplace News', 'marketplace-news', 'Updates and announcements from the P4NO platform.', 4)
ON CONFLICT (slug) DO NOTHING;
