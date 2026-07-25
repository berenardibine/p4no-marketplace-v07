
CREATE TABLE public.seller_weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  weekly_views integer NOT NULL DEFAULT 0,
  weekly_impressions integer NOT NULL DEFAULT 0,
  lifetime_views integer NOT NULL DEFAULT 0,
  lifetime_impressions integer NOT NULL DEFAULT 0,
  growth_views_pct numeric NOT NULL DEFAULT 0,
  growth_impressions_pct numeric NOT NULL DEFAULT 0,
  suggestion text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (seller_id, week_start)
);

ALTER TABLE public.seller_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers read own reports"
ON public.seller_weekly_reports FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Admin full access seller_weekly_reports"
ON public.seller_weekly_reports FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service insert seller_weekly_reports"
ON public.seller_weekly_reports FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service update seller_weekly_reports"
ON public.seller_weekly_reports FOR UPDATE
USING (true);

CREATE INDEX idx_seller_weekly_reports_seller ON public.seller_weekly_reports (seller_id, week_start DESC);
