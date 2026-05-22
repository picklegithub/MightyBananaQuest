-- Migration: add server_seq, deleted_at, and sync trigger to mood_entries
-- Brings mood_entries in line with other tables (habit_log pattern).

-- server_seq: monotonic integer for incremental pull without clock skew
ALTER TABLE public.mood_entries
  ADD COLUMN IF NOT EXISTS server_seq BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for efficient server_seq-based pulls
CREATE INDEX IF NOT EXISTS mood_entries_server_seq
  ON public.mood_entries (user_id, server_seq);

-- Sequence shared with other tables (reuse if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'global_server_seq') THEN
    CREATE SEQUENCE public.global_server_seq START 1;
  END IF;
END$$;

-- Trigger: stamp server_seq on every insert/update
CREATE OR REPLACE FUNCTION public.stamp_mood_entries_seq()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.server_seq := nextval('public.global_server_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mood_entries_seq ON public.mood_entries;
CREATE TRIGGER trg_mood_entries_seq
  BEFORE INSERT OR UPDATE ON public.mood_entries
  FOR EACH ROW EXECUTE FUNCTION public.stamp_mood_entries_seq();

-- incremental_sync_events: fire on insert/update/delete (same pattern as other tables)
CREATE OR REPLACE FUNCTION public.mood_entries_sync_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.incremental_sync_events (collection_name, operation, payload, occurred_at)
    VALUES ('mood_entries', 'delete', to_jsonb(OLD), now());
    RETURN OLD;
  ELSE
    INSERT INTO public.incremental_sync_events (collection_name, operation, payload, occurred_at)
    VALUES ('mood_entries', TG_OP::TEXT, to_jsonb(NEW), now());
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_mood_entries_sync ON public.mood_entries;
CREATE TRIGGER trg_mood_entries_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.mood_entries
  FOR EACH ROW EXECUTE FUNCTION public.mood_entries_sync_event();
