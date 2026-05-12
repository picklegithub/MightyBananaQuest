-- ── Migration 005: align Supabase schema with app v15 ────────────────────────
--
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query).
-- All statements use IF NOT EXISTS / IF EXISTS so re-running is safe.
--
-- What this covers:
--   1. settings  — add custom_palette_hue, pet_icon
--   2. habits    — add best_streak, notes, time, strength, time_of_day, is_archived
--   3. tasks     — available_from was never synced; no column to add or remove
--   4. Rename settings.variant → settings.palette (wire mapping updated in app)
--
-- NOTE: The app's sync.ts still sends palette as "variant" on the wire for
-- backwards compat. Once this migration is applied you can optionally rename
-- the column (step 4) and update the rowToSettings/settingsToRow mappings.

-- ── 1. settings ───────────────────────────────────────────────────────────────
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS custom_palette_hue integer,
  ADD COLUMN IF NOT EXISTS pet_icon           text;

-- ── 2. habits ─────────────────────────────────────────────────────────────────
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS best_streak  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS time         text,
  ADD COLUMN IF NOT EXISTS strength     real,
  ADD COLUMN IF NOT EXISTS time_of_day  text,
  ADD COLUMN IF NOT EXISTS is_archived  boolean NOT NULL DEFAULT false;

-- ── 3. Backfill: seed strength = 0.5 for existing habits with no value ────────
UPDATE habits SET strength = 0.5 WHERE strength IS NULL;

-- ── 4. (Optional) Rename settings.variant → settings.palette ─────────────────
-- Only run this once you're ready to update the wire mapping in sync.ts.
-- After running, change settingsToRow to send "palette" and rowToSettings to
-- read "palette" instead of "variant".
--
-- ALTER TABLE settings RENAME COLUMN variant TO palette;
