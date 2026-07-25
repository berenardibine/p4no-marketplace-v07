
-- 1. Create task_submissions table (fixes "could not find table" error)
CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  proof_text text,
  proof_image text,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own submissions" ON public.task_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own submissions" ON public.task_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access task_submissions" ON public.task_submissions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add missing columns to reward_tasks (fixes "could not find difficulty column" error)
DO $$ BEGIN
  ALTER TABLE public.reward_tasks ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'easy';
  ALTER TABLE public.reward_tasks ADD COLUMN IF NOT EXISTS evidence_type text DEFAULT 'screenshot';
  ALTER TABLE public.reward_tasks ADD COLUMN IF NOT EXISTS external_link text;
  ALTER TABLE public.reward_tasks ADD COLUMN IF NOT EXISTS reward_type text DEFAULT 'points';
END $$;

-- 3. Create reward_transactions table
CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  transaction_type text NOT NULL DEFAULT 'task_reward',
  description text,
  task_id uuid,
  submission_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own transactions" ON public.reward_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admin full access reward_transactions" ON public.reward_transactions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own wallet" ON public.wallets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access wallets" ON public.wallets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'earn',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wallet_transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admin full access wallet_transactions" ON public.wallet_transactions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Create boost_plans table (admin-managed pricing)
CREATE TABLE IF NOT EXISTS public.boost_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration_days integer NOT NULL DEFAULT 1,
  cost_points integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boost_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active boost_plans" ON public.boost_plans
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admin full access boost_plans" ON public.boost_plans
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default boost plans
INSERT INTO public.boost_plans (name, duration_days, cost_points) VALUES
  ('1 Day Boost', 1, 50),
  ('3 Days Boost', 3, 120),
  ('7 Days Boost', 7, 250),
  ('14 Days Boost', 14, 450);

-- 7. Add boost_plan_id to boosted_products
DO $$ BEGIN
  ALTER TABLE public.boosted_products ADD COLUMN IF NOT EXISTS boost_plan_id uuid;
  ALTER TABLE public.boosted_products ADD COLUMN IF NOT EXISTS points_cost integer DEFAULT 0;
END $$;

-- 8. Allow users to update own wallet (for deduction flow via admin)
CREATE POLICY "Users update own wallet" ON public.wallets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 9. Allow insert into wallet_transactions by authenticated users
CREATE POLICY "Auth insert wallet_transactions" ON public.wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
