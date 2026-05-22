-- ── Migration 010: deleted_tasks tombstones ───────────────────────────────────
--
-- Creates the deleted_tasks table so soft-delete tombstones are persisted
-- server-side. Without this, if a browser/iOS Safari evicts IndexedDB, local
-- tombstones are lost and the next pull re-inserts deleted tasks as if they
-- were never deleted (ghost data).
--
-- Each row records one deleted task ID per user. The pull logic checks this
-- table and skips / removes any matching task_id during a full or incremental
-- pull. Append-only (no updates needed).
--
-- ROLLBACK
--   DROP TABLE IF EXISTS deleted_tasks;

CREATE TABLE IF NOT EXISTS deleted_tasks (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id    text        NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

ALTER TABLE deleted_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own deleted_tasks" ON deleted_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS deleted_tasks_user_idx ON deleted_tasks (user_id);
CREATE INDEX IF NOT EXISTS deleted_tasks_task_idx ON deleted_tasks (user_id, task_id);
