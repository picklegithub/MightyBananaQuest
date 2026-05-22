-- Phase 6: device tokens for Capacitor push notifications
-- Extension enablement (pg_cron + pg_net) is in 20260520020001_enable_cron.sql

CREATE TABLE public.device_tokens (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tokens"
  ON public.device_tokens
  FOR ALL
  USING (auth.uid() = user_id);
