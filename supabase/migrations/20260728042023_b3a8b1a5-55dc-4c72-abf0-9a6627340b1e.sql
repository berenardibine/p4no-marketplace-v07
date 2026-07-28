
-- Replace unconditional dispatch-queue-1min with a gated version.
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'dispatch-queue-1min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'dispatch-queue-1min',
  '* * * * *',
  $cmd$
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.notification_queue
      WHERE status IN ('pending','retry')
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      LIMIT 1
    ) THEN
      PERFORM net.http_post(
        url:='https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/dispatch-queue',
        headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
        body:='{}'::jsonb
      );
    END IF;
  END $$;
  $cmd$
);

-- Replace unconditional group-pending-5min with a gated version.
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'group-pending-5min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'group-pending-5min',
  '*/5 * * * *',
  $cmd$
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.notification_queue
      WHERE status = 'pending'
      LIMIT 1
    ) THEN
      PERFORM net.http_post(
        url:='https://tsrnmrnfmvsivnvdkqrj.supabase.co/functions/v1/group-pending-notifications',
        headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8"}'::jsonb,
        body:='{}'::jsonb
      );
    END IF;
  END $$;
  $cmd$
);
