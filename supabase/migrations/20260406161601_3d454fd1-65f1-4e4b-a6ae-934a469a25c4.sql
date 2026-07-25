
-- Add module column to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS module text;

-- Add index for fast badge count queries
CREATE INDEX IF NOT EXISTS idx_notifications_module_unread ON public.notifications (module, is_read) WHERE module IS NOT NULL;
