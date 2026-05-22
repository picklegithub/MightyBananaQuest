-- Enable pg_cron + pg_net for scheduled push notifications
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Schedule push-notify edge function every 5 minutes
SELECT cron.schedule(
  'push-notify-every-5min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://bjufnywuxnvxtrzutdvi.supabase.co/functions/v1/push-notify',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    )
  $$
);
