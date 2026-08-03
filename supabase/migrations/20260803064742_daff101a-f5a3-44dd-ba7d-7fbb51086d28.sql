CREATE OR REPLACE FUNCTION public.infra_audit_cron()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  _jobs jsonb;
  _runs jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(j) ORDER BY j.jobid), '[]'::jsonb)
  INTO _jobs
  FROM (
    SELECT jobid, jobname, schedule, active, command
    FROM cron.job
  ) j;

  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  INTO _runs
  FROM (
    SELECT jobid, runid, status, return_message, start_time, end_time
    FROM cron.job_run_details
    ORDER BY start_time DESC
    LIMIT 100
  ) r;

  RETURN jsonb_build_object('jobs', _jobs, 'runs', _runs, 'generated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.infra_audit_cron() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.infra_audit_cron() TO authenticated;