-- Admin settings table for toggles like identity verification requirement
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access admin_settings" ON public.admin_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read (for checking settings)
CREATE POLICY "Public read admin_settings" ON public.admin_settings
  FOR SELECT TO public
  USING (true);

-- Insert default setting: require_identity_verification = true
INSERT INTO public.admin_settings (key, value) VALUES 
  ('require_identity_verification', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;