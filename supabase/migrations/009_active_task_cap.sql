-- Server-side backstop for Slow Productivity active-task cap.
-- Client enforces a UX cap of 3; this trigger fires at 10 to catch
-- cap bypass via a second device syncing in additional active tasks.
-- Only applies to non-deleted tasks with status = 'active'.

CREATE OR REPLACE FUNCTION check_active_task_cap()
RETURNS TRIGGER AS $$
DECLARE
  active_count integer;
  cap integer := 10;
BEGIN
  -- Only enforce when the row is becoming active and not deleted
  IF NEW.status = 'active' AND NEW.deleted_at IS NULL THEN
    SELECT COUNT(*) INTO active_count
    FROM tasks
    WHERE user_id = NEW.user_id
      AND status  = 'active'
      AND deleted_at IS NULL
      AND id != NEW.id;

    IF active_count >= cap THEN
      RAISE EXCEPTION 'active_task_cap_exceeded: % active tasks (cap=%)', active_count, cap;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_active_task_cap ON tasks;
CREATE TRIGGER trg_active_task_cap
  BEFORE INSERT OR UPDATE OF status, deleted_at ON tasks
  FOR EACH ROW EXECUTE FUNCTION check_active_task_cap();
