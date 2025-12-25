-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a cron job to run every day at midnight (0 0 * * *)
-- It deletes notifications older than 30 days
SELECT cron.schedule(
  'delete-old-notifications', -- name of the cron job
  '0 0 * * *',                -- schedule (every day at midnight)
  $$DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days'$$
);
