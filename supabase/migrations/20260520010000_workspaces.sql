-- Phase 4: Shared task lists
-- Creates workspaces + workspace_members tables, adds workspace_id to tasks.

-- ── Workspaces ──────────────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_seq  BIGINT      NOT NULL DEFAULT nextval('global_seq'),
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workspaces" ON public.workspaces
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "member can read workspace" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND joined_at IS NOT NULL
    )
  );

-- server_seq stamp trigger
CREATE OR REPLACE FUNCTION public.workspaces_set_server_seq()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.server_seq := nextval('global_seq');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspaces_server_seq
  BEFORE INSERT OR UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_set_server_seq();

CREATE TRIGGER trg_workspaces_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- ── Workspace members ────────────────────────────────────────────────────────
CREATE TABLE public.workspace_members (
  workspace_id   TEXT        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT        NOT NULL DEFAULT 'member'
                             CHECK (role IN ('owner', 'member', 'viewer')),
  invited_email  TEXT,
  joined_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_seq     BIGINT      NOT NULL DEFAULT nextval('global_seq'),
  PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own membership" ON public.workspace_members
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "workspace owner manages members" ON public.workspace_members
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.workspace_members_set_server_seq()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.server_seq := nextval('global_seq');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_members_server_seq
  BEFORE INSERT OR UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.workspace_members_set_server_seq();

CREATE TRIGGER trg_workspace_members_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- ── Tasks: add workspace_id ──────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Replace tasks RLS SELECT policy to include workspace task visibility
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks
  FOR SELECT USING (
    (workspace_id IS NULL AND auth.uid() = user_id)
    OR
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND joined_at IS NOT NULL
    )
  );
