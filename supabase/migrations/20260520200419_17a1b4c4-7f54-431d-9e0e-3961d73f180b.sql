
DROP POLICY IF EXISTS "Auth insert comments" ON public.product_comments;
CREATE POLICY "Authenticated insert product_comments"
  ON public.product_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors update own product_comments" ON public.product_comments;
CREATE POLICY "Authors update own product_comments"
  ON public.product_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
