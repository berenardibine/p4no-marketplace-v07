
-- Create product_weekly_stats table for aggregated analytics
CREATE TABLE IF NOT EXISTS public.product_weekly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  total_views integer NOT NULL DEFAULT 0,
  total_impressions integer NOT NULL DEFAULT 0,
  weekly_views integer NOT NULL DEFAULT 0,
  weekly_impressions integer NOT NULL DEFAULT 0,
  week_start date NOT NULL,
  week_end date NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, week_start)
);

-- Indexes
CREATE INDEX idx_product_weekly_stats_seller ON public.product_weekly_stats(seller_id);
CREATE INDEX idx_product_weekly_stats_week ON public.product_weekly_stats(week_start DESC);

-- Enable RLS
ALTER TABLE public.product_weekly_stats ENABLE ROW LEVEL SECURITY;

-- Sellers read own stats
CREATE POLICY "Sellers read own weekly stats"
  ON public.product_weekly_stats FOR SELECT
  USING (auth.uid() = seller_id);

-- Admin full access
CREATE POLICY "Admin full access product_weekly_stats"
  ON public.product_weekly_stats FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert/update (edge functions)
CREATE POLICY "Service insert product_weekly_stats"
  ON public.product_weekly_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service update product_weekly_stats"
  ON public.product_weekly_stats FOR UPDATE
  USING (true);
