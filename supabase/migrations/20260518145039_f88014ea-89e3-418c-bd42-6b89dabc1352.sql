
-- 1. Allow authenticated users to insert their own role rows (fixes onboarding RLS error)
CREATE POLICY "Users insert own roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. service_comments table mirroring product_comments
CREATE TABLE IF NOT EXISTS public.service_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id UUID,
  session_id TEXT,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_comments_service_id_idx ON public.service_comments(service_id);

ALTER TABLE public.service_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read service_comments"
ON public.service_comments FOR SELECT
USING (is_deleted = false);

CREATE POLICY "Authenticated insert service_comments"
ON public.service_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors delete own service_comments"
ON public.service_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin full access service_comments"
ON public.service_comments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));
