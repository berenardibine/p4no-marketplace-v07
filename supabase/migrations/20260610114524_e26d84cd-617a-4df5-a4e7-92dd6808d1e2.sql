-- Notification Center: extend notifications with deep-linking, rich media, priority, archive, click tracking.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Priority sanity check via trigger (immutable-friendly)
CREATE OR REPLACE FUNCTION public.validate_notification_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.priority NOT IN ('high','medium','low') THEN
    NEW.priority := 'medium';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_notification_priority ON public.notifications;
CREATE TRIGGER trg_validate_notification_priority
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.validate_notification_priority();

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_archived
  ON public.notifications (user_id, archived_at);