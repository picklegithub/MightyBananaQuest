# Sync, Sharing & Multi-Device — Implementation Plan
> MightyBananaQuest · Status: PLANNED · Author: Claude

## Current State (as of May 2026)

| Capability | Status |
|---|---|
| 14-table outbox sync (LWW, task-level) | ✅ Done |
| server_seq watermark + incremental pull | ✅ Done |
| Dead-letter queue, 5-retry backoff | ✅ Done |
| Soft-delete propagation via `deleted_at` | ✅ Done |
| SubTask field-level merge by id | ✅ Done |
| Realtime subscriptions (all 14 tables) | ✅ Done |
| Web Notifications API (5 channels) | ✅ Done |
| SyncDashboardSheet (status UI) | ✅ Done |
| Field-level LWW beyond sub-tasks | ❌ Missing |
| Selective sync prefs | ❌ Missing |
| Offline conflict queue UI | ❌ Missing |
| Shared workspaces | ❌ Missing |
| Read-only sharing links | ❌ Missing |
| Capacitor push notifications | ❌ Missing |

---

## Phase 1 — Field-Level LWW Merge

**Goal:** When two devices edit different fields of the same record offline, merge them instead of letting the later writer overwrite the earlier one entirely.

### What exists
- `mergeSubTasks(local, remote)` in `src/lib/sync.ts` — merges by `SubTask.id`, keeps local-only items, remote wins conflicts
- LWW today: `if (incoming.updatedAt > local.updatedAt) → replace whole record`
- This means: edit task title on phone + edit task notes on desktop → only one survives

### What to build

**1a. Field-change tracking in the outbox**
- Extend `OutboxEntry` (in `src/data/schema.ts` v24) with `changedFields?: string[]`
- Every `enqueueUpsert()` call in `src/data/db.ts` computes a diff against the current local record before writing
- Store `changedFields: ['notes', 'title']` alongside the data payload
- No server changes required — this is purely client-side metadata

**1b. Field-level merge in `incrementalPullBySeq()` and realtime handler**
- Current merge point: `src/lib/sync.ts` ~line 750 (tasks), ~line 899 (habits), ~line 1426 (realtime)
- Add `fieldLevelMerge(local, remote, remoteChangedFields)`:
  ```
  for each field in remote record:
    if field in remoteChangedFields → take remote value
    else → keep local value
  ```
- Fall back to whole-record LWW if `changedFields` is absent (backwards compat)

**1c. Array merge extensions**
Extend the SubTask pattern to three more arrays:
- `Goal.linked[]` — merge by task id (same as SubTask pattern)
- `JournalEntry.gratitude[]` — merge by index (remote wins per-slot; local-only slots appended)
- `JournalEntry.priorities[]` — same

**Verification:**
- Edit task title on device A offline
- Edit task notes on device B offline
- Both devices come online → merged record has both changes
- `npx tsc --noEmit` passes

**Files touched:** `src/lib/sync.ts`, `src/data/schema.ts` (v24), `src/data/db.ts`

---

## Phase 2 — Selective Sync

**Goal:** User can choose which data categories sync to Supabase. Privacy-conscious users may not want journal entries leaving their device.

### What to build

**2a. `syncPrefs` in AppSettings**
Add to `AppSettings` type (`src/types/index.ts`):
```typescript
syncPrefs?: {
  tasks:    boolean  // default true
  habits:   boolean  // default true
  goals:    boolean  // default true
  journal:  boolean  // default false  ← privacy-sensitive
  moods:    boolean  // default false  ← privacy-sensitive
  shopping: boolean  // default true
}
```

**2b. Filter drainOutbox**
In `drainOutbox()` (`src/lib/sync.ts`):
```typescript
const prefs = settings?.syncPrefs ?? DEFAULT_SYNC_PREFS
const SYNC_TABLE_MAP: Record<string, keyof SyncPrefs> = {
  tasks: 'tasks', habits: 'habits', goals: 'goals',
  journal: 'journal', mood_entries: 'moods', shopping_items: 'shopping',
  // settings, categories, inbox_items, weekly_reviews always sync
}
if (entry.table in SYNC_TABLE_MAP && !prefs[SYNC_TABLE_MAP[entry.table]]) {
  skip entry (don't push to server)
}
```

**2c. Filter TABLE_PULLERS**
In `incrementalPullBySeq()` skip pullers for disabled tables.

**2d. Settings UI**
In `src/screens/SettingsScreen.tsx`, add a "Sync preferences" section:
- Toggle per category with a warning: "Disabling removes existing server data for this category"
- On toggle-off: soft-delete all server rows for that table (set `deleted_at` via a bulk upsert)

**Verification:**
- Disable journal sync → journal entries stay local, not pushed
- Re-enable → entries push on next drain
- `npx tsc --noEmit` passes

**Files touched:** `src/types/index.ts`, `src/lib/sync.ts`, `src/screens/SettingsScreen.tsx`

---

## Phase 3 — Offline-First Conflict Queue UI

**Goal:** Surface dead-lettered outbox failures to the user with actionable resolution options.

### What exists
- `getDeadEntries()` returns `{ key, table, recordId, attempts, lastError }[]`
- `retryDeadLettered()` re-queues all dead entries
- `SyncDashboardSheet` (`src/components/SyncDashboardSheet.tsx`) shows sync status
- `outboxDeadCount()` returns count

### What to build

**3a. Conflict resolution actions in sync.ts**
```typescript
// Keep local — re-push with current local record (clears deadLettered flag)
resolveKeepLocal(key: string): Promise<void>

// Accept server — fetch server version, overwrite local, remove from outbox
resolveAcceptServer(table: string, recordId: string): Promise<void>

// Discard — remove from outbox, leave local record unchanged (no sync for this record)
resolveDiscard(key: string): Promise<void>
```

**3b. ConflictQueueSheet component**
New component: `src/components/ConflictQueueSheet.tsx`
- List of dead-lettered entries, grouped by table
- Per-entry: record title (fetched from local db), error summary, age
- Three action buttons per entry: "Keep mine" / "Accept server" / "Discard"
- "Retry all" batch action at top
- Triggered from SyncDashboardSheet when `outboxDeadCount() > 0`

**3c. Badge on SyncStatusBar**
- `src/components/SyncStatusBar.tsx` already shows sync status
- Add red dot when dead count > 0
- Tap → opens SyncDashboardSheet → shows conflict queue

**Verification:**
- Force a dead-letter (disconnect, create task, reconnect with invalid data)
- Conflict queue shows the entry
- "Keep mine" resolves without data loss
- `npx tsc --noEmit` passes

**Files touched:** `src/lib/sync.ts`, `src/components/SyncDashboardSheet.tsx`, `src/components/SyncStatusBar.tsx`  
**New files:** `src/components/ConflictQueueSheet.tsx`

---

## Phase 4 — Shared Task Lists (Invite by Email)

**Goal:** Two users can share a named task list. Both can create, complete, and edit tasks in it.

### Supabase schema changes

```sql
-- Workspaces: named shared contexts
CREATE TABLE public.workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Membership: links users to workspaces
CREATE TABLE public.workspace_members (
  workspace_id  TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
  invited_email TEXT,          -- pending invite (user not yet signed up)
  joined_at     TIMESTAMPTZ,   -- null = pending
  PRIMARY KEY (workspace_id, user_id)
);

-- tasks gets a nullable workspace_id
ALTER TABLE public.tasks ADD COLUMN workspace_id TEXT REFERENCES public.workspaces(id);
```

**RLS additions:**
```sql
-- Workspace members can see workspace tasks
CREATE POLICY "workspace_task_read" ON public.tasks
  FOR SELECT USING (
    workspace_id IS NULL AND auth.uid() = user_id   -- own tasks (existing)
    OR
    workspace_id IN (                                 -- shared tasks
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND joined_at IS NOT NULL
    )
  );
```

### Client changes

**4a. New Dexie table** `workspaces` + `workspaceMembers` in `src/data/schema.ts` v25

**4b. Workspace selector in AddTaskSheet**
- Optional "Share to workspace" picker below category
- Only shown if user has ≥1 workspace

**4c. Invite flow**
New screen `WorkspaceSettingsScreen`:
- Create workspace (name → POST to workspaces table)
- Invite by email → insert `workspace_members` row with `invited_email`, `joined_at: null`
- Supabase Auth magic link email handled by trigger or Edge Function

**4d. Sync extension**
- Add `workspaces` and `workspace_members` to TABLE_PULLERS
- Workspace tasks pull via standard server_seq watermark (RLS handles visibility)

**Verification:**
- User A creates workspace, invites User B email
- User B accepts, sees shared tasks in a filtered list
- User A completes a task → User B sees it update in realtime

**New files:** `src/screens/WorkspaceSettingsScreen.tsx`  
**Files touched:** `src/data/schema.ts`, `src/lib/sync.ts`, `src/types/index.ts`, `src/components/AddTaskSheet.tsx`  
**Supabase:** 2 new tables + RLS + optional Edge Function for invite email

---

## Phase 5 — Read-Only Sharing Links (Weekly Review)

**Goal:** Generate a link to share a weekly review with someone who doesn't have an account.

### Supabase schema change

```sql
ALTER TABLE public.weekly_reviews
  ADD COLUMN share_token UUID DEFAULT NULL;

CREATE INDEX weekly_reviews_share_token ON public.weekly_reviews (share_token)
  WHERE share_token IS NOT NULL;

-- New RLS policy: bearer of token can read
CREATE POLICY "weekly_review_public_read" ON public.weekly_reviews
  FOR SELECT USING (
    auth.uid() = user_id                      -- owner (existing)
    OR share_token = current_setting(         -- public link bearer
      'request.headers', true)::json->>'x-share-token' -- via custom header
    -- Alternative simpler approach: anon Supabase client + match token
  );
```

**Simpler alternative (recommended):** Use Supabase anon key + RPC function:
```sql
CREATE OR REPLACE FUNCTION public.get_shared_review(p_token UUID)
RETURNS SETOF weekly_reviews LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM weekly_reviews WHERE share_token = p_token AND share_token IS NOT NULL;
$$;
```

### Client changes

**5a. "Share" button in WeeklyReviewScreen**
- Generates `crypto.randomUUID()`, saves to `weekly_reviews.share_token` via updateTask pattern
- Copies link to clipboard: `https://app.mbq.com/review/{token}`
- "Revoke" button sets `share_token = null`

**5b. Public review page**
- Route `{ name: 'shared-review'; token: string }`
- Calls `supabase.rpc('get_shared_review', { p_token: token })`
- Read-only render of the review (no auth required)
- Shows: week summary, completions, wins, goals pulse

**Verification:**
- Generate link, open in incognito (no auth) → review renders
- Revoke link → page returns 404/empty

**Files touched:** `src/screens/WeeklyReviewScreen.tsx`, `src/types/index.ts`, `src/lib/sync.ts`  
**Supabase:** 1 column + RLS or RPC function

---

## Phase 6 — Capacitor Push Notifications

**Goal:** Deliver due-task reminders and streak nudges as native push notifications (Android/iOS), not just web notifications.

### Current state
- `src/lib/notifications.ts` uses `new Notification()` — Web Notifications API only
- Works in PWA, not when app is backgrounded on native

### What to build

**6a. Device token registration**
```typescript
// src/lib/pushNotifications.ts  (new file)
import { PushNotifications } from '@capacitor/push-notifications'

export async function registerPushToken(userId: string): Promise<void>
// 1. PushNotifications.requestPermissions()
// 2. PushNotifications.register()
// 3. On registration: upsert token to Supabase device_tokens table
// 4. On notificationReceived (foreground): delegate to existing notify()
// 5. On notificationActionPerformed: navigate to relevant task/screen
```

**New Supabase table:**
```sql
CREATE TABLE public.device_tokens (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, token)
);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens" ON device_tokens FOR ALL USING (auth.uid() = user_id);
```

**6b. Edge Function: `push-notify`**
```typescript
// supabase/functions/push-notify/index.ts
// Called by pg_cron every 5 minutes (or triggered by tasks table INSERT/UPDATE)
// Logic:
//   1. SELECT tasks WHERE due = today AND time IS NOT NULL AND done = false
//   2. For each task: find device_tokens for task.user_id
//   3. Send via FCM (Android) or APNs (iOS) via fetch to Firebase/Apple APIs
//   4. Honour quiet hours from settings table
```

**6c. Capacitor integration**
- `npx cap add android && npx cap add ios` (if not already done)
- Add `@capacitor/push-notifications` to package.json
- Register token on `App.appStateChange` (foreground→background transition)
- Handle deep-link on notification tap → navigate to task

**6d. Fallback**
- On web/PWA: existing `useNotifications.ts` hook continues working
- `Capacitor.isNativePlatform()` guard selects push vs web

**Verification:**
- Task with `time: '09:00'` and `due: today` → push arrives at 9am on device
- Quiet hours in settings → no push between 10pm–7am
- `npx tsc --noEmit` passes

**New files:** `src/lib/pushNotifications.ts`, `supabase/functions/push-notify/index.ts`  
**Files touched:** `src/main.tsx` (register on app start), `src/lib/notifications.ts` (merge with push)  
**Supabase:** 1 new table + Edge Function + pg_cron schedule

---

## Execution Order & Dependencies

```
Phase 1 (Field-level LWW)     — no dependencies, low risk
    ↓
Phase 2 (Selective sync)       — no dependencies, low risk
    ↓
Phase 3 (Conflict queue UI)    — uses dead-letter queue (already exists)
    ↓
Phase 4 (Shared task lists)    — requires Supabase schema changes, medium complexity
    ↓
Phase 5 (Read-only links)      — standalone, can be done anytime after P4
    ↓
Phase 6 (Capacitor push)       — requires Capacitor native setup, highest complexity
```

Phases 1–3 are pure client-side hardening and can ship together.
Phases 4–5 are the sharing features and require Supabase migrations.
Phase 6 is native infra and should be its own sprint.

---

## Key Files Reference

| File | Role |
|---|---|
| `src/lib/sync.ts` | Outbox drain, pull, realtime, LWW merge — 1703 lines |
| `src/data/schema.ts` | Dexie schema (v23), outbox/tombstone table definitions |
| `src/data/db.ts` | Re-exports all data helpers; enqueueUpsert/enqueueDelete called here |
| `src/types/index.ts` | Task, Habit, Goal, JournalEntry, DailyPlan, MoodEntry shapes |
| `src/components/SyncDashboardSheet.tsx` | Sync status UI, entry point for conflict queue |
| `src/components/SyncStatusBar.tsx` | Status bar badge |
| `src/lib/notifications.ts` | Web notifications, 5 channels, quiet hours |
| `src/lib/useNotifications.ts` | Scheduling hook, due-time reminders |
| `supabase/migrations/20260515000000_baseline_schema.sql` | Server schema baseline, RLS policies |
