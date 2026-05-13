-- ── Migration 007: server_seq for reliable incremental pull ──────────────────
--
-- Run in Supabase SQL editor AFTER migration 006.
-- All statements are additive — no existing data is modified or deleted.
--
-- WHAT THIS DOES
--   Adds a BIGSERIAL server_seq column to every synced table. A Postgres
--   trigger auto-assigns the next sequence value on every INSERT or UPDATE,
--   so the sequence is monotonically increasing and immune to client clock skew.
--
--   Clients pull with:
--     GET /incremental_sync_events?server_seq=gt.{last_seq}&order=server_seq.asc&limit=100
--   instead of the current synced_at timestamp watermark.
--
--   The old synced_at watermark pull continues to work — both columns coexist.
--   Switch the client pull protocol to server_seq after deploying this migration
--   and verifying the sequence is being populated correctly.
--
-- TABLES COVERED
--   tasks, habits, goals, journal, inbox, categories, settings,
--   shopping_items, weekly_reviews, daily_plans
--   (outbox and coping_cards are local-only — no server_seq needed)
--
-- TEST BEFORE DEPLOYING
--   After running, insert or update any task and verify:
--     SELECT id, server_seq FROM tasks ORDER BY server_seq DESC LIMIT 5;
--   All recently touched rows should have non-null, increasing server_seq values.
--
-- ROLLBACK
--   -- Remove trigger function and triggers from all tables:
--   DROP TRIGGER IF EXISTS set_server_seq ON tasks;
--   DROP TRIGGER IF EXISTS set_server_seq ON habits;
--   DROP TRIGGER IF EXISTS set_server_seq ON goals;
--   DROP TRIGGER IF EXISTS set_server_seq ON journal;
--   DROP TRIGGER IF EXISTS set_server_seq ON inbox;
--   DROP TRIGGER IF EXISTS set_server_seq ON categories;
--   DROP TRIGGER IF EXISTS set_server_seq ON settings;
--   DROP TRIGGER IF EXISTS set_server_seq ON shopping_items;
--   DROP TRIGGER IF EXISTS set_server_seq ON weekly_reviews;
--   DROP TRIGGER IF EXISTS set_server_seq ON daily_plans;
--   DROP FUNCTION IF EXISTS assign_server_seq();
--   DROP SEQUENCE IF EXISTS global_server_seq;
--   -- Remove columns (only after reverting client pull protocol):
--   ALTER TABLE tasks          DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE habits         DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE goals          DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE journal        DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE inbox          DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE categories     DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE settings       DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE shopping_items DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE weekly_reviews DROP COLUMN IF EXISTS server_seq;
--   ALTER TABLE daily_plans    DROP COLUMN IF EXISTS server_seq;

-- ── Shared sequence (one sequence across all tables → globally ordered) ────────

CREATE SEQUENCE IF NOT EXISTS global_server_seq START 1;

-- ── Add server_seq column to every synced table ───────────────────────────────

ALTER TABLE tasks          ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE habits         ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE goals          ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE journal        ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE inbox          ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE categories     ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE settings       ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE weekly_reviews ADD COLUMN IF NOT EXISTS server_seq BIGINT;
ALTER TABLE daily_plans    ADD COLUMN IF NOT EXISTS server_seq BIGINT;

-- ── Indexes for efficient incremental pull ────────────────────────────────────

CREATE INDEX IF NOT EXISTS tasks_server_seq_idx          ON tasks          (user_id, server_seq);
CREATE INDEX IF NOT EXISTS habits_server_seq_idx         ON habits         (user_id, server_seq);
CREATE INDEX IF NOT EXISTS goals_server_seq_idx          ON goals          (user_id, server_seq);
CREATE INDEX IF NOT EXISTS journal_server_seq_idx        ON journal        (user_id, server_seq);
CREATE INDEX IF NOT EXISTS inbox_server_seq_idx          ON inbox          (user_id, server_seq);
CREATE INDEX IF NOT EXISTS categories_server_seq_idx     ON categories     (user_id, server_seq);
CREATE INDEX IF NOT EXISTS settings_server_seq_idx       ON settings       (user_id, server_seq);
CREATE INDEX IF NOT EXISTS shopping_items_server_seq_idx ON shopping_items (user_id, server_seq);
CREATE INDEX IF NOT EXISTS weekly_reviews_server_seq_idx ON weekly_reviews (user_id, server_seq);
CREATE INDEX IF NOT EXISTS daily_plans_server_seq_idx    ON daily_plans    (user_id, server_seq);

-- ── Trigger function: assign next sequence value on every write ───────────────

CREATE OR REPLACE FUNCTION assign_server_seq()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.server_seq := nextval('global_server_seq');
  RETURN NEW;
END;
$$;

-- ── Attach trigger to each table ──────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_server_seq ON tasks;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON habits;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON goals;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON journal;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON journal
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON inbox;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON inbox
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON categories;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON settings;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON shopping_items;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON shopping_items
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON weekly_reviews;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

DROP TRIGGER IF EXISTS set_server_seq ON daily_plans;
CREATE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON daily_plans
  FOR EACH ROW EXECUTE FUNCTION assign_server_seq();

-- ── Backfill existing rows with sequence values ───────────────────────────────
-- Assigns server_seq to all existing rows ordered by synced_at (best proxy
-- for insertion order). Rows with no synced_at get the lowest values.

UPDATE tasks          SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE habits         SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY created_at ASC NULLS FIRST;
UPDATE goals          SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE journal        SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE inbox          SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE categories     SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE settings       SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE shopping_items SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE weekly_reviews SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
UPDATE daily_plans    SET server_seq = nextval('global_server_seq') WHERE server_seq IS NULL ORDER BY synced_at ASC NULLS FIRST;
