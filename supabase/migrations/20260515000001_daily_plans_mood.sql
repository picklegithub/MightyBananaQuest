-- Add mood field to daily_plans so it syncs across devices.
-- Uses IF NOT EXISTS so it's safe to re-run against the baseline schema.

ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS mood TEXT
    CHECK (mood IN ('steady', 'tired', 'charged'))
    DEFAULT NULL;

COMMENT ON COLUMN public.daily_plans.mood IS 'Morning mood tap: steady | tired | charged (Step 0 of daily plan ritual)';
