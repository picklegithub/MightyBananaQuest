-- ── Migration 008: habit_log sync ────────────────────────────────────────────
--
-- Creates the habit_log table in Supabase so habitLog entries are no longer
-- silently local-only. Entries are append-only (no updates) — one row per
-- task × date. Includes server_seq for incremental pull.
--
-- Run AFTER migration 007 (global_server_seq must already exist).
--
-- ROLLBACK
--   DROP TABLE IF EXISTS habit_log;
--   DROP TRIGGER IF EXISTS set_server_seq ON habit_log;

CREATE TABLE IF NOT EXISTS habit_log (
  id         text        NOT NULL PRIMARY KEY,   -- '${taskId}:${date}'
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id    text        NOT NULL,
  date       date        NOT NULL,
  server_seq bigint,
  UNIQUE (user_id, task_id, date)
);

ALTER TABLE habit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own habit_log" ON habit_log
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS habit_log_server_seq_idx ON habit_log (user_id, server_seq);

-- Reuse the global sequence from migration 007
DROP TRIGGER IF EXISTS set_server_seq ON habit_log;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON habit_log
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();
