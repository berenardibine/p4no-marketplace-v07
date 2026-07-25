-- Add 'social' to allowed task types
ALTER TABLE public.reward_tasks DROP CONSTRAINT reward_tasks_task_type_check;
ALTER TABLE public.reward_tasks ADD CONSTRAINT reward_tasks_task_type_check CHECK (task_type = ANY (ARRAY['view','share','invite','rate','referral','promotion','engagement','growth','traffic','custom','action','social']));

-- Add FK from task_submissions to profiles for join support
ALTER TABLE public.task_submissions DROP CONSTRAINT IF EXISTS task_submissions_user_id_fkey;
ALTER TABLE public.task_submissions ADD CONSTRAINT task_submissions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
