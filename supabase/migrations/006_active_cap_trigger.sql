-- ── Migration 006: server-side active task cap (max 3 per user) ──────────────
--
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run — uses CREATE OR REPLACE and DROP IF EXISTS.
--
-- WHAT THIS DOES
--   Adds a Postgres trigger that fires BEFORE INSERT OR UPDATE on tasks.
--   If the incoming row has status = 'active', it counts how many OTHER rows
--   for the same user already have status = 'active'. If the count is >= 3,
--   it raises a P0001 exception ("active_cap_exceeded"), which Supabase
--   surfaces as a 400 error to the client.
--
--   The AND id != NEW.id guard ensures the UPDATE path (e.g. re-saving an
--   already-active task) is not incorrectly counted against itself.
--
-- TEST BEFORE DEPLOYING (run in SQL editor, then roll back):
--
--   -- 1. Find a real user_id from your auth.users table:
--   SELECT id FROM auth.users LIMIT 1;
--
--   -- 2. Insert 3 active tasks for that user (should succeed):
--   INSERT INTO tasks (id, user_id, title, status, cat, effort, due, streak, quad, done, sub)
--   VALUES
--     (gen_random_uuid(), '<your-user-id>', 'Test active 1', 'active', 'inbox', 'm', '', 0, 'q1', false, '[]'),
--     (gen_random_uuid(), '<your-user-id>', 'Test active 2', 'active', 'inbox', 'm', '', 0, 'q1', false, '[]'),
--     (gen_random_uuid(), '<your-user-id>', 'Test active 3', 'active', 'inbox', 'm', '', 0, 'q1', false, '[]');
--
--   -- 3. Try inserting a 4th active task (should fail with P0001):
--   INSERT INTO tasks (id, user_id, title, status, cat, effort, due, streak, quad, done, sub)
--   VALUES (gen_random_uuid(), '<your-user-id>', 'Test active 4', 'active', 'inbox', 'm', '', 0, 'q1', false, '[]');
--   -- Expected: ERROR: active_cap_exceeded
--
--   -- 4. Clean up test rows:
--   DELETE FROM tasks WHERE user_id = '<your-user-id>' AND title LIKE 'Test active %';
--
-- ROLLBACK (run this to remove the trigger entirely):
--
--   DROP TRIGGER IF EXISTS check_active_cap ON tasks;
--   DROP FUNCTION IF EXISTS enforce_active_cap();

-- ── Function ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_active_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COUNT(*) INTO active_count
    FROM tasks
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;         -- exclude the row being updated from its own count

    IF active_count >= 3 THEN
      RAISE EXCEPTION 'active_cap_exceeded'
        USING HINT = 'Max 3 active tasks allowed per user', ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger ───────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS check_active_cap ON tasks;

CREATE TRIGGER check_active_cap
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_active_cap();
