-- Migration: mood_entries table
-- Phase 4 — 5-point mood scale with energy, emotions, influences, and note.
-- Replaces scattered mood fields in journal_entries / daily_plans.
-- Legacy fields are retained in those tables for backward compat.

CREATE TABLE IF NOT EXISTS public.mood_entries (
  id           TEXT          PRIMARY KEY,
  user_id      UUID          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date         DATE          NOT NULL,
  time         TIME          NOT NULL,
  source       TEXT          NOT NULL
                             CHECK (source IN ('standalone', 'morning-journal', 'evening-journal', 'daily-plan')),
  mood         SMALLINT      NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy       TEXT          CHECK (energy IN ('tired', 'steady', 'charged')),
  emotions     TEXT[]        NOT NULL DEFAULT '{}',
  influences   TEXT[]        NOT NULL DEFAULT '{}',
  note         TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  _deleted     BOOLEAN       NOT NULL DEFAULT FALSE
);

-- Per-user date queries (history, distribution)
CREATE INDEX IF NOT EXISTS mood_entries_user_date
  ON public.mood_entries (user_id, date);

-- Compound index mirrors Dexie [date+source] for exact upserts
CREATE UNIQUE INDEX IF NOT EXISTS mood_entries_user_date_source
  ON public.mood_entries (user_id, date, source);

-- RLS: users can only see their own entries
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_entries_select_own"
  ON public.mood_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "mood_entries_insert_own"
  ON public.mood_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mood_entries_update_own"
  ON public.mood_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mood_entries_delete_own"
  ON public.mood_entries FOR DELETE
  USING (auth.uid() = user_id);
