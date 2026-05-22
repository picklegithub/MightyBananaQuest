-- Fix: mood_entries_sync_event() was inserting into incremental_sync_events
-- without user_id, violating RLS. Replace with the shared emit function
-- that correctly extracts user_id from the row payload.

DROP TRIGGER IF EXISTS trg_mood_entries_sync ON public.mood_entries;
DROP FUNCTION IF EXISTS public.mood_entries_sync_event();

CREATE TRIGGER trg_mood_entries_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.mood_entries
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();
