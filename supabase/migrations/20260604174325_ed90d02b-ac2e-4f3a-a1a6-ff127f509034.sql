
CREATE OR REPLACE FUNCTION public.cleanup_browsing_and_weekly_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.browsing_history WHERE viewed_at < now() - interval '30 days';
  DELETE FROM public.weekly_views WHERE week_start < (date_trunc('week', now())::date - interval '12 weeks');
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-browsing-and-weekly-stats') THEN
    PERFORM cron.unschedule('cleanup-browsing-and-weekly-stats');
  END IF;
  PERFORM cron.schedule(
    'cleanup-browsing-and-weekly-stats',
    '0 3 * * *',
    $cron$ SELECT public.cleanup_browsing_and_weekly_stats(); $cron$
  );
END $$;
