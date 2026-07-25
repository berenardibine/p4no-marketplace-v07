
-- 1. notification_queue (batched/scheduled pushes)
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  image_url text,
  priority text NOT NULL DEFAULT 'medium',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_queue_pending_idx
  ON public.notification_queue (status, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_queue_user_idx
  ON public.notification_queue (user_id, status);

GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own queued notifications"
  ON public.notification_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages queue"
  ON public.notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. clicked_at on notification_logs
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_logs_type_day_idx
  ON public.notification_logs (notification_type, created_at desc);

-- 3. Analytics view (admin)
CREATE OR REPLACE VIEW public.notification_analytics_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  notification_type,
  count(*) FILTER (WHERE status = 'sent')   AS sent,
  count(*) FILTER (WHERE status = 'failed') AS failed,
  count(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
  count(*) AS total
FROM public.notification_logs
GROUP BY 1, 2;

GRANT SELECT ON public.notification_analytics_daily TO authenticated;

-- 4. mark_notification_clicked helper
CREATE OR REPLACE FUNCTION public.mark_notification_clicked(_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid;
  _type text;
BEGIN
  UPDATE public.notifications
     SET clicked_at = COALESCE(clicked_at, now()),
         is_read = true
   WHERE id = _notification_id
     AND (user_id = auth.uid() OR user_id IS NULL)
   RETURNING user_id, type INTO _user, _type;

  IF _user IS NOT NULL THEN
    UPDATE public.notification_logs
       SET clicked_at = now()
     WHERE id = (
       SELECT id FROM public.notification_logs
        WHERE user_id = _user
          AND notification_type = _type
          AND clicked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
     );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_clicked(uuid) TO authenticated;

-- 5. inactivity lookup
CREATE INDEX IF NOT EXISTS user_interest_profiles_last_active_idx
  ON public.user_interest_profiles (last_active_at);
