
-- Drop the duplicate policy attempt and just add the public read one
CREATE POLICY "Public read active tasks" ON public.reward_tasks
  FOR SELECT TO public
  USING (is_active = true);
