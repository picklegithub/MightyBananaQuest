-- Migration 011: Add mood_score column to journal table
-- Phase 4 — Mood Tracking: optional 1-10 explicit mood score on journal entries.
-- Supplements the existing morningMood enum ('steady'|'tired'|'charged').
-- NULL = not yet captured (all existing rows default to NULL — fully non-breaking).

ALTER TABLE journal
  ADD COLUMN IF NOT EXISTS mood_score smallint
    CHECK (mood_score IS NULL OR (mood_score >= 1 AND mood_score <= 10));

COMMENT ON COLUMN journal.mood_score IS
  'Optional explicit mood score 1–10. Captured in morning journal (Phase 4). NULL = not captured.';
