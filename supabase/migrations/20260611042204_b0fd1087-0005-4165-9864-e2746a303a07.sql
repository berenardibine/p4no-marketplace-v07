
-- 1) user_interest_profiles
CREATE TABLE IF NOT EXISTS public.user_interest_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  tag_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_active_at timestamptz,
  timezone text,
  preferred_hours int[] DEFAULT ARRAY[9,12,18,20],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interest_profiles TO authenticated;
GRANT ALL ON public.user_interest_profiles TO service_role;

ALTER TABLE public.user_interest_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interest profile"
  ON public.user_interest_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own interest profile"
  ON public.user_interest_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interest profile"
  ON public.user_interest_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_interest_profiles_updated_at
  BEFORE UPDATE ON public.user_interest_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) recommendation_events
CREATE TABLE IF NOT EXISTS public.recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  weight numeric NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.recommendation_events TO authenticated;
GRANT ALL ON public.recommendation_events TO service_role;

ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own recommendation events"
  ON public.recommendation_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own recommendation events"
  ON public.recommendation_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_created
  ON public.recommendation_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_entity
  ON public.recommendation_events (entity_type, entity_id);

-- 3) notification_preferences extension
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS recommendations_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price_drops_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS back_in_stock_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS followed_seller_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opportunities_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opportunity_interests text[] DEFAULT ARRAY[]::text[];

-- 4) Dedup helper
CREATE OR REPLACE FUNCTION public.can_notify_dedup(
  _user_id uuid, _type text, _entity_id uuid, _within_days int DEFAULT 7
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = _user_id
      AND type = _type
      AND entity_id = _entity_id
      AND created_at > now() - (_within_days || ' days')::interval
  );
$$;
