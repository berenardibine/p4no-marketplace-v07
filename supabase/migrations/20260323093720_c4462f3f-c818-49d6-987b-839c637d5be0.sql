-- Enable RLS on user_security
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

-- Users can read their own security record
CREATE POLICY "Users read own security"
ON public.user_security FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own security record
CREATE POLICY "Users insert own security"
ON public.user_security FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own security record
CREATE POLICY "Users update own security"
ON public.user_security FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Admin full access to user_security (for disabling 2FA without code)
CREATE POLICY "Admin full access user_security"
ON public.user_security FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));