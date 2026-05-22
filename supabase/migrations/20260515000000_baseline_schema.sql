-- =============================================================
-- MightyBananaQuest — Squashed Baseline Migration
-- Generated: 2026-05-15
-- Replaces: 9 previous migrations
--   • complete_schema_setup
--   • 005_settings_color_mode_pet_icon
--   • 006_weekly_reviews
--   • 007_daily_plans
--   • 008_sync_triggers_new_tables
--   • add_habits_and_settings_columns
--   • active_cap_trigger
--   • 007_server_seq
--   • 005_align_schema
--
-- NOTE: Also consolidates duplicate RLS policies that accumulated
-- across migrations (each table now has one clean policy).
-- =============================================================


-- ───────────────────────────────────────────────────────────────
-- SEQUENCES
-- ───────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS global_server_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS incremental_sync_events_id_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;


-- ───────────────────────────────────────────────────────────────
-- TABLES
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id          text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  name        text,
  icon        text,
  hue         integer,
  updated_at  timestamptz DEFAULT now(),
  server_seq  bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.daily_plans (
  date           text        NOT NULL,
  user_id        uuid        NOT NULL REFERENCES auth.users(id),
  picked_ids     jsonb       DEFAULT '[]'::jsonb,
  top3_ids       jsonb       DEFAULT '[]'::jsonb,
  reckonings     jsonb       DEFAULT '[]'::jsonb,
  cal_budget_min integer     DEFAULT 0,
  completed_at   bigint,
  updated_at     timestamptz DEFAULT now(),
  server_seq     bigint,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.goals (
  id          text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  title       text,
  area        text,
  horizon     text,
  progress    float8      DEFAULT 0,
  why         text,
  linked      jsonb       DEFAULT '[]'::jsonb,
  updated_at  timestamptz DEFAULT now(),
  server_seq  bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.habits (
  id          text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  title       text        NOT NULL DEFAULT '',
  cat         text        NOT NULL DEFAULT '',
  frequency   text        NOT NULL DEFAULT 'daily',
  streak      integer     NOT NULL DEFAULT 0,
  done        boolean     NOT NULL DEFAULT false,
  notes       text,
  time        text,
  created_at  bigint,
  updated_at  timestamptz DEFAULT now(),
  best_streak integer     NOT NULL DEFAULT 0,
  strength    real,
  time_of_day text,
  is_archived boolean     NOT NULL DEFAULT false,
  server_seq  bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inbox (
  id          text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  kind        text,
  source      text,
  text        text,
  when_ts     text,
  processed   boolean     DEFAULT false,
  updated_at  timestamptz DEFAULT now(),
  server_seq  bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.incremental_sync_events (
  id              bigint      NOT NULL DEFAULT nextval('incremental_sync_events_id_seq'),
  collection_name text        NOT NULL,
  operation       text        NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  user_id         uuid,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.incremental_sync_state (
  collection_name text        NOT NULL,
  last_synced_at  timestamptz NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_name)
);

CREATE TABLE IF NOT EXISTS public.journal (
  id          text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  date        text,
  kind        text,
  gratitude   jsonb,
  intention   text,
  priorities  jsonb,
  win         text,
  diff        text,
  lesson      text,
  tomorrow    text,
  updated_at  timestamptz DEFAULT now(),
  notes       text,
  server_seq  bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.settings (
  user_id              uuid        NOT NULL REFERENCES auth.users(id),
  theme                text        DEFAULT 'auto',
  variant              text        DEFAULT 'warm',
  intensity            text        DEFAULT 'balanced',
  default_pomodoro_mins integer    DEFAULT 25,
  notifications        jsonb,
  onboarded            boolean     DEFAULT false,
  xp                   integer     DEFAULT 0,
  streak               integer     DEFAULT 0,
  updated_at           timestamptz DEFAULT now(),
  color_mode           text        DEFAULT 'color',
  pet_icon             text,
  custom_palette_hue   integer,
  server_seq           bigint,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.shopping_items (
  id          text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  title       text        NOT NULL DEFAULT '',
  category    text        NOT NULL DEFAULT '',
  checked     boolean     NOT NULL DEFAULT false,
  quantity    text,
  notes       text,
  store       text,
  created_at  bigint,
  updated_at  timestamptz DEFAULT now(),
  server_seq  bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id            text        NOT NULL,
  user_id       uuid        NOT NULL REFERENCES auth.users(id),
  cat           text,
  title         text,
  effort        text,
  due           text,
  streak        integer     DEFAULT 0,
  ctx           text,
  quad          text,
  recurring     text,
  done          boolean     DEFAULT false,
  sub           jsonb       DEFAULT '[]'::jsonb,
  pomodoro_mins integer,
  time          text,
  notes         text,
  created_at    bigint,
  updated_at    timestamptz DEFAULT now(),
  is_habit      boolean,
  status        text,
  server_seq    bigint,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id              text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id),
  week_start      text,
  week_end        text,
  tasks_completed integer     DEFAULT 0,
  xp_gained       integer     DEFAULT 0,
  journal_days    integer     DEFAULT 0,
  quad_counts     jsonb       DEFAULT '{"q1": 0, "q2": 0, "q3": 0, "q4": 0}'::jsonb,
  wins            jsonb       DEFAULT '[]'::jsonb,
  goal_pulse      jsonb       DEFAULT '[]'::jsonb,
  next_week_thing text        DEFAULT '',
  completed_at    bigint,
  updated_at      timestamptz DEFAULT now(),
  server_seq      bigint,
  PRIMARY KEY (id)
);


-- ───────────────────────────────────────────────────────────────
-- INDEXES
-- ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS categories_server_seq_idx
  ON public.categories (user_id, server_seq);

CREATE INDEX IF NOT EXISTS daily_plans_server_seq_idx
  ON public.daily_plans (user_id, server_seq);

CREATE INDEX IF NOT EXISTS goals_server_seq_idx
  ON public.goals (user_id, server_seq);

CREATE INDEX IF NOT EXISTS habits_server_seq_idx
  ON public.habits (user_id, server_seq);

CREATE INDEX IF NOT EXISTS inbox_server_seq_idx
  ON public.inbox (user_id, server_seq);

CREATE INDEX IF NOT EXISTS idx_sync_events_user_occurred
  ON public.incremental_sync_events (user_id, occurred_at);

CREATE INDEX IF NOT EXISTS incremental_sync_events_collection_name_idx
  ON public.incremental_sync_events (collection_name);

CREATE INDEX IF NOT EXISTS incremental_sync_events_occurred_at_idx
  ON public.incremental_sync_events (occurred_at);

CREATE INDEX IF NOT EXISTS journal_server_seq_idx
  ON public.journal (user_id, server_seq);

CREATE INDEX IF NOT EXISTS settings_server_seq_idx
  ON public.settings (user_id, server_seq);

CREATE INDEX IF NOT EXISTS shopping_items_server_seq_idx
  ON public.shopping_items (user_id, server_seq);

CREATE INDEX IF NOT EXISTS tasks_server_seq_idx
  ON public.tasks (user_id, server_seq);

CREATE INDEX IF NOT EXISTS weekly_reviews_server_seq_idx
  ON public.weekly_reviews (user_id, server_seq);


-- ───────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ───────────────────────────────────────────────────────────────

-- Assigns a globally-ordered sequence number on every insert/update
CREATE OR REPLACE FUNCTION public.assign_server_seq()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.server_seq := nextval('global_server_seq');
  RETURN NEW;
END;
$$;

-- Emits a row into incremental_sync_events after any DML
CREATE OR REPLACE FUNCTION public.incremental_sync_emit_event()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_operation TEXT;
  v_payload   JSONB;
  v_user_id   UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_operation := 'insert';
    v_payload   := to_jsonb(NEW);
    v_user_id   := (to_jsonb(NEW)->>'user_id')::UUID;
  ELSIF TG_OP = 'UPDATE' THEN
    v_operation := 'update';
    v_payload   := to_jsonb(NEW);
    v_user_id   := (to_jsonb(NEW)->>'user_id')::UUID;
  ELSIF TG_OP = 'DELETE' THEN
    v_operation := 'delete';
    v_payload   := to_jsonb(OLD);
    v_user_id   := (to_jsonb(OLD)->>'user_id')::UUID;
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO incremental_sync_events (collection_name, operation, payload, user_id)
  VALUES (TG_TABLE_NAME, v_operation, v_payload, v_user_id);

  RETURN NULL;
END;
$$;

-- Prunes old sync events older than max_age_days; returns deleted count
CREATE OR REPLACE FUNCTION public.incremental_sync_prune_events(max_age_days integer)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM incremental_sync_events
  WHERE occurred_at < now() - (max_age_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Enforces max 3 active tasks per user
CREATE OR REPLACE FUNCTION public.enforce_active_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COUNT(*) INTO active_count
    FROM tasks
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;
    IF active_count >= 3 THEN
      RAISE EXCEPTION 'active_cap_exceeded'
        USING HINT = 'Max 3 active tasks allowed per user', ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- ───────────────────────────────────────────────────────────────
-- TRIGGERS
-- ───────────────────────────────────────────────────────────────

-- categories
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_categories_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- daily_plans
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_daily_plans_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- goals
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_goals_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- habits
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_habits_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- inbox
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.inbox
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_inbox_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.inbox
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- journal
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.journal
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_journal_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.journal
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- settings
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_settings_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- shopping_items
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_shopping_items_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- tasks
CREATE OR REPLACE TRIGGER check_active_cap
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_cap();

CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_tasks_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();

-- weekly_reviews
CREATE OR REPLACE TRIGGER set_server_seq
  BEFORE INSERT OR UPDATE ON public.weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.assign_server_seq();

CREATE OR REPLACE TRIGGER trg_weekly_reviews_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.incremental_sync_emit_event();


-- ───────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────

ALTER TABLE public.categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incremental_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reviews          ENABLE ROW LEVEL SECURITY;

-- One clean policy per table (duplicate policies from old migrations are collapsed here)

CREATE POLICY "categories_owner" ON public.categories
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_plans_owner" ON public.daily_plans
  FOR ALL TO public
  USING (user_id = auth.uid());

CREATE POLICY "goals_owner" ON public.goals
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habits_owner" ON public.habits
  FOR ALL TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "inbox_owner" ON public.inbox
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sync_events_read_own" ON public.incremental_sync_events
  FOR SELECT TO public
  USING (user_id = auth.uid());

CREATE POLICY "sync_events_delete_own" ON public.incremental_sync_events
  FOR DELETE TO public
  USING (user_id = auth.uid());

CREATE POLICY "journal_owner" ON public.journal
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_owner" ON public.settings
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shopping_items_owner" ON public.shopping_items
  FOR ALL TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tasks_owner" ON public.tasks
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weekly_reviews_owner" ON public.weekly_reviews
  FOR ALL TO public
  USING (user_id = auth.uid());
