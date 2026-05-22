-- Web Push subscription fields for device_tokens
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS web_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS web_p256dh   TEXT,
  ADD COLUMN IF NOT EXISTS web_auth     TEXT;
