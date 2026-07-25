-- Fix: Add 'action' to allowed task_type values
ALTER TABLE public.reward_tasks DROP CONSTRAINT reward_tasks_task_type_check;
ALTER TABLE public.reward_tasks ADD CONSTRAINT reward_tasks_task_type_check CHECK (task_type = ANY (ARRAY['view','share','invite','rate','referral','promotion','engagement','growth','traffic','custom','action']));

-- Fix: Ensure admin can read all task_submissions
DROP POLICY IF EXISTS "Admin full access task_submissions" ON public.task_submissions;
CREATE POLICY "Admin full access task_submissions" ON public.task_submissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
