-- ============================================================
-- Phase 2: Browsing History
-- ============================================================
CREATE TABLE public.browsing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('product','service','article')),
  item_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX idx_browsing_history_user ON public.browsing_history (user_id, viewed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.browsing_history TO authenticated;
GRANT ALL ON public.browsing_history TO service_role;

ALTER TABLE public.browsing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history owner select" ON public.browsing_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "history owner insert" ON public.browsing_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "history owner update" ON public.browsing_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "history owner delete" ON public.browsing_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "history admin manage" ON public.browsing_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Upsert RPC: bump viewed_at if exists, else insert
CREATE OR REPLACE FUNCTION public.track_browsing_history(p_item_type text, p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF p_item_type NOT IN ('product','service','article') THEN RETURN; END IF;
  INSERT INTO public.browsing_history (user_id, item_type, item_id, viewed_at)
  VALUES (v_uid, p_item_type, p_item_id, now())
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET viewed_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.track_browsing_history(text, uuid) TO authenticated;

-- ============================================================
-- Phase 5: Structured AI product content
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description_structured jsonb;