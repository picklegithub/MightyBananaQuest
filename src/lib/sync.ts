import { makeId } from '../lib/makeId'
/**
 * sync.ts — Incremental, outbox-based Supabase ↔ Dexie sync
 *
 * Architecture:
 *  1. LOCAL-FIRST WRITES
 *     Every mutation writes to Dexie first, then calls enqueueUpsert/enqueueDelete.
 *     This puts an OutboxEntry (key = `${table}:${id}`) into db.outbox.
 *     Same record edited twice → same key → dedup. User always sees local state
 *     instantly; the network is only a broadcast channel.
 *
 *  2. OUTBOX DRAIN  (drainOutbox)
 *     Reads all OutboxEntry rows with nextRetryAt <= now(), sorted oldest first.
 *     For upsert: serialises the local record and upserts to Supabase.
 *     For delete: sends a soft-delete (sets deleted_at on the server row).
 *     On success: removes the entry from db.outbox.
 *     On failure: exponential back-off (30 s × attempts, cap 5 min).
 *
 *  3. INCREMENTAL PULL  (incrementalPull)
 *     Stores lastPullAt = max server synced_at seen so far (set by DB trigger,
 *     so client clock drift is irrelevant). Queries each table with
 *     `synced_at > lastPullAt` — only fetches rows changed since last pull.
 *     For each row:
 *       • deleted_at set   → remove locally + tombstone
 *       • else LWW check   → remote wins only if updatedAt > local.updatedAt
 *                            (strict >: local always wins on equal timestamps)
 *       • tasks extra guard → if task is in completedTasks and incoming.done=false
 *                            with incomingTs <= completedAt, skip (outbox not yet drained)
 *     Records the max synced_at from this batch; next pull starts from there.
 *
 *  4. REALTIME SUBSCRIPTIONS  (startRealtime)
 *     Supabase Realtime pushes INSERT/UPDATE/DELETE events.
 *     LWW guard: only overwrites local if incoming updatedAt > local.updatedAt.
 *     Handles soft-deletes: if the incoming row has deleted_at, delete locally.
 *
 *  5. FULL PUSH AFTER RESET  (pushAllLocal)
 *     Used only after a nuclear reset — bypasses outbox for the initial mass push.
 */

import { supabase } from './supabase'
import { db, type OutboxEntry } from '../data/db'
import type { Task, Goal, JournalEntry, InboxItem, Category, AppSettings, ShoppingItem, Habit, WeeklyReview, DailyPlan, GoalPulse, CopingCard, SubTask, MoodEntry, MoodEnergy, MoodSource, Workspace, WorkspaceMember, WorkspaceMemberRole } from '../types'

// ── Error message extractor ───────────────────────────────────────────────────
// Supabase PostgrestError is a plain object { message, details, hint, code },
// NOT an Error instance. String(plainObj) → "[object Object]". We extract the
// human-readable message regardless of what was thrown.
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string') return e.message
    if (typeof e.details === 'string') return e.details
  }
  return String(err)
}

// ── Cached user ID ────────────────────────────────────────────────────────────
let _cachedUserId: string | null = null

export function setCachedUserId(id: string | null): void {
  _cachedUserId = id
}

export async function getUserIdAsync(): Promise<string | null> {
  if (_cachedUserId) return _cachedUserId
  const { data } = await supabase.auth.getSession()
  _cachedUserId = data.session?.user?.id ?? null
  return _cachedUserId
}

// ── Pull watermark ────────────────────────────────────────────────────────────
// Dual watermark strategy during migration 007 transition:
//
//   LAST_SEQ_KEY  — server_seq integer (preferred, post-007)
//     Immune to clock skew. Used when migration 007 has been applied and
//     server_seq columns are populated.
//
//   LAST_PULL_KEY — synced_at ISO timestamp (legacy, pre-007)
//     Still used as fallback when server_seq is unavailable (null on all rows,
//     meaning 007 hasn't been deployed yet). Clients that have never pulled
//     start with null → full pull on first sync.
//
// Once 007 is stable in production: set VITE_REQUIRE_SERVER_SEQ=true in .env to
// retire the synced_at fallback. The flag makes SyncStatusBar skip incrementalPull()
// instead of falling back — safe to enable once all environments have 007 applied.

const LAST_PULL_KEY = 'mbq_last_pull_at'
const LAST_SEQ_KEY  = 'mbq_last_server_seq'

export function getLastPullAt(): string | null {
  try { return localStorage.getItem(LAST_PULL_KEY) } catch { return null }
}

function setLastPullAt(iso: string): void {
  try { localStorage.setItem(LAST_PULL_KEY, iso) } catch {}
}

export function getLastServerSeq(): number {
  try { return parseInt(localStorage.getItem(LAST_SEQ_KEY) ?? '0', 10) || 0 } catch { return 0 }
}

function setLastServerSeq(seq: number): void {
  try { localStorage.setItem(LAST_SEQ_KEY, String(seq)) } catch {}
}

// ── Outbox helpers ────────────────────────────────────────────────────────────
// Called synchronously inside every mutation helper in db.ts.
// Does NOT throw — outbox failures are non-blocking (will retry via drain).

const MAX_OUTBOX_ATTEMPTS = 5  // dead-letter after this many consecutive failures

export function enqueueUpsert(table: string, recordId: string, data: object): void {
  const key = `${table}:${recordId}`
  const now  = Date.now()
  // Preserve existing idempotencyKey if the entry already exists (rapid edits → same key)
  db.outbox.get(key).then(existing => {
    // Compute changedFields by diffing new data against last queued data.
    // Accumulated across rapid edits (union). Falls back to all-fields on first write.
    const nd = data as Record<string, unknown>
    let changedFields: string[]
    if (existing?.data) {
      const pd = existing.data as Record<string, unknown>
      const diffed = Object.keys(nd).filter(k => JSON.stringify(nd[k]) !== JSON.stringify(pd[k]))
      const prev   = existing.changedFields ?? Object.keys(pd)
      changedFields = [...new Set([...prev, ...diffed])]
    } else {
      changedFields = Object.keys(nd)
    }
    db.outbox.put({
      key,
      table,
      recordId,
      op:              'upsert',
      data,
      changedFields,
      queuedAt:        existing?.queuedAt ?? now,
      attempts:        0,                          // reset on each new edit
      nextRetryAt:     now,
      idempotencyKey:  existing?.idempotencyKey ?? makeId(),
      deadLettered:    false,
    }).catch(() => {})
  }).catch(() => {
    db.outbox.put({
      key, table, recordId, op: 'upsert', data,
      changedFields: Object.keys(data as Record<string, unknown>),
      queuedAt: now, attempts: 0, nextRetryAt: now,
      idempotencyKey: makeId(), deadLettered: false,
    }).catch(() => {})
  })
}

// data is an optional snapshot of the record at deletion time. When present,
// drainOutbox merges deleted_at into the full serialized row so the server
// retains all field values — preventing ghost re-inserts on other devices.
export function enqueueDelete(table: string, recordId: string, data?: object): void {
  const key = `${table}:${recordId}`
  const now  = Date.now()
  db.outbox.get(key).then(existing => {
    db.outbox.put({
      key, table, recordId, op: 'delete',
      data,
      queuedAt:       existing?.queuedAt ?? now,
      attempts:       0,
      nextRetryAt:    now,
      idempotencyKey: existing?.idempotencyKey ?? makeId(),
      deadLettered:   false,
    }).catch(() => {})
  }).catch(() => {
    db.outbox.put({
      key, table, recordId, op: 'delete', data,
      queuedAt: now, attempts: 0, nextRetryAt: now,
      idempotencyKey: makeId(), deadLettered: false,
    }).catch(() => {})
  })
}

// ── Serialisers ───────────────────────────────────────────────────────────────

function isoNow() { return new Date().toISOString() }

function taskToRow(task: Task, userId: string) {
  // NOTE: deleted_at and synced_at are NOT included here.
  // deleted_at is only sent by drainOutbox when performing a soft-delete,
  // and only after the 002_incremental_sync.sql migration has been applied.
  // Including unknown columns in a PostgREST upsert causes a 400 error.
  return {
    id:            task.id,
    user_id:       userId,
    cat:           task.cat,
    title:         task.title,
    effort:        task.effort,
    due:           task.due,
    streak:        task.streak,
    quad:          task.quad ?? null,
    recurring:     task.recurring,
    done:          task.done,
    sub:           task.sub,
    is_habit:      task.isHabit ?? null,
    status:        task.status ?? null,
    pomodoro_mins: task.pomodoroMins ?? null,
    time:          task.time ?? null,
    notes:         task.notes ?? null,
    workspace_id:  task.workspaceId ?? null,
    created_at:    task.createdAt ?? null,
    updated_at:    task.updatedAt ? new Date(task.updatedAt).toISOString() : isoNow(),
  }
}

function rowToWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id:        row.id as string,
    name:      (row.name as string) ?? '',
    ownerId:   (row.owner_id as string) ?? '',
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).getTime() : undefined,
  }
}

function rowToWorkspaceMember(row: Record<string, unknown>): WorkspaceMember {
  return {
    workspaceId:   (row.workspace_id as string) ?? '',
    userId:        (row.user_id as string) ?? '',
    role:          (row.role as WorkspaceMemberRole) ?? 'member',
    invitedEmail:  (row.invited_email as string | undefined) ?? undefined,
    joinedAt:      row.joined_at ? new Date(row.joined_at as string).getTime() : undefined,
    createdAt:     row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updatedAt:     row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
  }
}

// Merge sub[] arrays by id: remote wins on conflicts; local-only subs are preserved.
// Falls back to remote-takes-all when either side lacks ids (legacy data).
function mergeSubTasks(local: SubTask[], remote: SubTask[]): SubTask[] {
  const hasIds = (subs: SubTask[]) => subs.length === 0 || subs.some(s => s.id)
  if (!hasIds(remote) || !hasIds(local)) return remote
  const remoteMap = new Map(remote.filter(s => s.id).map(s => [s.id!, s]))
  const localOnly = local.filter(s => s.id && !remoteMap.has(s.id!))
  return [...remote, ...localOnly]
}

// Field-level LWW merge: preserve locally-changed fields, take remote for everything else.
// localChangedFields comes from the outbox entry for this record.
// Falls back gracefully — if no changedFields, caller should use standard LWW.
function fieldLevelMerge<T extends Record<string, unknown>>(
  local: T,
  remote: T,
  localChangedFields: string[],
): T {
  const merged = { ...remote } as Record<string, unknown>
  for (const field of localChangedFields) {
    if (field in local) merged[field] = local[field]
  }
  return merged as T
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id:           row.id as string,
    cat:          (row.cat as string) ?? '',
    title:        (row.title as string) ?? '',
    effort:       (row.effort as Task['effort']) ?? 's',
    due:          (row.due as string) ?? 'Today',
    streak:       (row.streak as number) ?? 0,
    quad:         (row.quad as Task['quad']) ?? undefined,
    recurring:    (row.recurring as string | null) ?? null,
    done:         (row.done as boolean) ?? false,
    sub:          (row.sub as Task['sub']) ?? [],
    isHabit:      (row.is_habit as boolean | undefined) ?? undefined,
    status:       (row.status as Task['status'] | undefined) ?? undefined,
    pomodoroMins: (row.pomodoro_mins as number | undefined) ?? undefined,
    time:         (row.time as string | undefined) ?? undefined,
    notes:        (row.notes as string | undefined) ?? undefined,
    workspaceId:  (row.workspace_id as string | undefined) ?? undefined,
    createdAt:    (row.created_at as number | undefined) ?? undefined,
    updatedAt:    row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
    deletedAt:    row.deleted_at ? new Date(row.deleted_at as string).getTime() : undefined,
    syncedAt:     row.synced_at  ? new Date(row.synced_at  as string).getTime() : undefined,
  }
}

function goalToRow(goal: Goal, userId: string) {
  return {
    id:         goal.id,
    user_id:    userId,
    title:      goal.title,
    area:       goal.area,
    horizon:    goal.horizon,
    progress:   goal.progress,
    why:        goal.why,
    linked:     goal.linked,
    updated_at: isoNow(),
  }
}

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id:       row.id as string,
    title:    (row.title as string) ?? '',
    area:     (row.area as string) ?? '',
    horizon:  (row.horizon as string) ?? '',
    progress: (row.progress as number) ?? 0,
    why:      (row.why as string) ?? '',
    linked:   (row.linked as string[]) ?? [],
  }
}

function journalToRow(entry: JournalEntry, userId: string) {
  return {
    id:         entry.id,
    user_id:    userId,
    date:       entry.date,
    kind:       entry.kind,
    gratitude:  entry.gratitude ?? null,
    intention:  entry.intention ?? null,
    priorities: entry.priorities ?? null,
    win:        entry.win ?? null,
    diff:       entry.diff ?? null,
    lesson:     entry.lesson ?? null,
    tomorrow:   entry.tomorrow ?? null,
    notes:      entry.notes ?? null,
    updated_at: isoNow(),
  }
}

function rowToJournal(row: Record<string, unknown>): JournalEntry {
  return {
    id:         row.id as string,
    date:       (row.date as string) ?? '',
    kind:       (row.kind as JournalEntry['kind']) ?? 'morning',
    gratitude:  (row.gratitude as string[] | undefined) ?? undefined,
    intention:  (row.intention as string | undefined) ?? undefined,
    priorities: (row.priorities as string[] | undefined) ?? undefined,
    win:        (row.win as string | undefined) ?? undefined,
    diff:       (row.diff as string | undefined) ?? undefined,
    lesson:     (row.lesson as string | undefined) ?? undefined,
    tomorrow:   (row.tomorrow as string | undefined) ?? undefined,
    notes:      (row.notes as string | undefined) ?? undefined,
  }
}

function habitLogToRow(log: { id: string; taskId: string; date: string }, userId: string) {
  return { id: log.id, user_id: userId, task_id: log.taskId, date: log.date }
}

function moodEntryToRow(entry: MoodEntry, userId: string) {
  return {
    id:         entry.id,
    user_id:    userId,
    date:       entry.date,
    time:       entry.time,
    source:     entry.source,
    mood:       entry.mood,
    energy:     entry.energy ?? null,
    emotions:   entry.emotions,
    influences: entry.influences,
    note:       entry.note ?? null,
    created_at: new Date(entry.createdAt).toISOString(),
    updated_at: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : isoNow(),
  }
}

function rowToMoodEntry(row: Record<string, unknown>): MoodEntry {
  return {
    id:         row.id as string,
    date:       row.date as string,
    time:       row.time as string,
    source:     row.source as MoodSource,
    mood:       row.mood as MoodEntry['mood'],
    energy:     (row.energy as MoodEnergy) ?? null,
    emotions:   (row.emotions as string[]) ?? [],
    influences: (row.influences as string[]) ?? [],
    note:       (row.note as string) ?? null,
    createdAt:  row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updatedAt:  row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
  }
}

function copingCardToRow(card: CopingCard, userId: string) {
  return {
    id:         card.id,
    user_id:    userId,
    title:      card.title,
    content:    card.content,
    category:   card.category,
    is_default: card.isDefault,
    is_pinned:  card.isPinned ?? false,
    created_at: new Date(card.createdAt).toISOString(),
    updated_at: card.updatedAt ? new Date(card.updatedAt).toISOString() : isoNow(),
  }
}

function rowToCopingCard(row: Record<string, unknown>): CopingCard {
  return {
    id:        row.id as string,
    title:     (row.title as string) ?? '',
    content:   (row.content as string) ?? '',
    category:  (row.category as CopingCard['category']) ?? 'mindfulness',
    isDefault: (row.is_default as boolean) ?? false,
    isPinned:  (row.is_pinned as boolean) ?? false,
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
  }
}

function inboxItemsToRow(item: InboxItem, userId: string) {
  return {
    id:              item.id,
    user_id:         userId,
    text:            item.text,
    source:          item.source,
    source_meta:     item.sourceMeta ?? null,
    created_at:      new Date(item.createdAt).toISOString(),
    processed_at:    item.processedAt ? new Date(item.processedAt).toISOString() : null,
    status:          item.status,
    converted_task_id: item.convertedTaskId ?? null,
    updated_at:      isoNow(),
  }
}

function categoryToRow(cat: Category, userId: string) {
  return {
    id:         cat.id,
    user_id:    userId,
    name:       cat.name,
    icon:       cat.icon,
    hue:        cat.hue,
    updated_at: isoNow(),
  }
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id:   row.id as string,
    name: (row.name as string) ?? '',
    icon: (row.icon as string) ?? '',
    hue:  (row.hue as number) ?? 200,
  }
}

function settingsToRow(s: AppSettings, userId: string) {
  return {
    user_id:               userId,
    theme:                 s.theme,
    // Server column is 'variant'; local AppSettings renamed it to 'palette' in DB v11.
    // We keep mapping to 'variant' on the wire until a server migration renames it.
    variant:               s.palette,
    intensity:             s.intensity,
    default_pomodoro_mins: s.defaultPomodoroMins,
    notifications:         s.notifications,
    onboarded:             s.onboarded,
    xp:                    s.xp,
    streak:                s.streak,
    custom_palette_hue: s.customPaletteHue ?? null,
    pet_icon:           s.petIcon ?? null,
    updated_at:            isoNow(),
  }
}

function rowToSettings(row: Record<string, unknown>): Partial<AppSettings> {
  return {
    theme:               (row.theme as AppSettings['theme']) ?? 'auto',
    // Read 'variant' from server (column not yet renamed); fall back to 'palette' for future compat.
    palette:             ((row.variant ?? row.palette) as AppSettings['palette']) ?? 'warm',
    intensity:           (row.intensity as AppSettings['intensity']) ?? 'balanced',
    defaultPomodoroMins: (row.default_pomodoro_mins as number) ?? 25,
    notifications:       (row.notifications as AppSettings['notifications']),
    onboarded:           (row.onboarded as boolean) ?? false,
    xp:                  (row.xp as number) ?? 0,
    streak:              (row.streak as number) ?? 0,
    customPaletteHue:    (row.custom_palette_hue as number) ?? undefined,
    petIcon:             (row.pet_icon as AppSettings['petIcon']) ?? undefined,
  }
}

function habitToRow(habit: Habit, userId: string) {
  return {
    id:          habit.id,
    user_id:     userId,
    title:       habit.title,
    cat:         habit.cat,
    frequency:   habit.frequency,
    streak:      habit.streak,
    best_streak: habit.bestStreak ?? 0,
    done:        habit.done,
    notes:       habit.notes ?? null,
    time:        habit.time ?? null,
    strength:    habit.strength ?? null,
    time_of_day: habit.timeOfDay ?? null,
    is_archived: habit.isArchived ?? false,
    created_at:  habit.createdAt ?? null,
    updated_at:  habit.updatedAt ? new Date(habit.updatedAt).toISOString() : isoNow(),
  }
}

function rowToHabit(row: Record<string, unknown>): Habit {
  return {
    id:         row.id as string,
    title:      (row.title as string) ?? '',
    cat:        (row.cat as string) ?? '',
    frequency:  (row.frequency as string) ?? 'daily',
    streak:     (row.streak as number) ?? 0,
    bestStreak: (row.best_streak as number) ?? 0,
    done:       (row.done as boolean) ?? false,
    notes:      (row.notes as string | undefined) ?? undefined,
    time:       (row.time as string | undefined) ?? undefined,
    strength:   (row.strength as number | undefined) ?? undefined,
    timeOfDay:  (row.time_of_day as Habit['timeOfDay']) ?? undefined,
    isArchived: (row.is_archived as boolean | undefined) ?? undefined,
    createdAt:  (row.created_at as number | undefined) ?? undefined,
    updatedAt:  row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
  }
}

function shoppingItemToRow(item: ShoppingItem, userId: string) {
  return {
    id:         item.id,
    user_id:    userId,
    title:      item.title,
    category:   item.category,
    checked:    item.checked,
    quantity:   item.quantity ?? null,
    notes:      item.notes ?? null,
    store:      item.store ?? null,
    created_at: item.createdAt ?? null,
    updated_at: item.updatedAt ? new Date(item.updatedAt).toISOString() : isoNow(),
  }
}

function rowToShoppingItem(row: Record<string, unknown>): ShoppingItem {
  const ts = Date.now()
  return {
    id:        row.id as string,
    title:     (row.title as string) ?? '',
    category:  (row.category as string) ?? '',
    checked:   (row.checked as boolean) ?? false,
    quantity:  (row.quantity as string | undefined) ?? undefined,
    notes:     (row.notes as string | undefined) ?? undefined,
    store:     (row.store as string | undefined) ?? undefined,
    createdAt: (row.created_at as number | undefined) ?? ts,
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : ts,
  }
}

function weeklyReviewToRow(review: WeeklyReview, userId: string) {
  return {
    id:              review.id,
    user_id:         userId,
    week_start:      review.weekStart,
    week_end:        review.weekEnd,
    tasks_completed: review.tasksCompleted,
    xp_gained:       review.xpGained,
    journal_days:    review.journalDays,
    quad_counts:     review.quadCounts,
    wins:            review.wins,
    goal_pulse:      review.goalPulse,
    next_week_thing: review.nextWeekThing,
    completed_at:    review.completedAt ?? null,   // bigint ms — store directly
    updated_at:      review.updatedAt ? new Date(review.updatedAt).toISOString() : isoNow(),
  }
}

function rowToWeeklyReview(row: Record<string, unknown>): WeeklyReview {
  return {
    id:             row.id as string,
    weekStart:      (row.week_start as string) ?? '',
    weekEnd:        (row.week_end as string) ?? '',
    tasksCompleted: (row.tasks_completed as number) ?? 0,
    xpGained:       (row.xp_gained as number) ?? 0,
    journalDays:    (row.journal_days as number) ?? 0,
    quadCounts:     (row.quad_counts as WeeklyReview['quadCounts']) ?? { q1: 0, q2: 0, q3: 0, q4: 0 },
    wins:           (row.wins as string[]) ?? [],
    goalPulse:      (row.goal_pulse as GoalPulse[]) ?? [],
    nextWeekThing:  (row.next_week_thing as string) ?? '',
    completedAt:    (row.completed_at as number | undefined) ?? undefined,
    updatedAt:      row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
    shareToken:     (row.share_token as string | undefined) ?? undefined,
  }
}

function dailyPlanToRow(plan: DailyPlan, userId: string) {
  return {
    user_id:        userId,
    date:           plan.date,
    mood:           plan.mood ?? null,
    picked_ids:     plan.pickedIds,
    top3_ids:       plan.top3Ids,
    reckonings:     plan.reckonings,
    cal_budget_min: plan.calBudgetMin,
    completed_at:   plan.completedAt ?? null,   // bigint ms — store directly
    updated_at:     isoNow(),
  }
}

function rowToDailyPlan(row: Record<string, unknown>): DailyPlan {
  return {
    date:          (row.date as string) ?? '',
    mood:          (row.mood as DailyPlan['mood']) ?? null,
    pickedIds:     (row.picked_ids as string[]) ?? [],
    top3Ids:       (row.top3_ids as string[]) ?? [],
    reckonings:    (row.reckonings as DailyPlan['reckonings']) ?? [],
    calBudgetMin:  (row.cal_budget_min as number) ?? 0,
    completedAt:   (row.completed_at as number | null) ?? null,
  }
}

// ── Serialize for outbox drain ─────────────────────────────────────────────────
// Converts the stored local object into a Supabase row for the given table.

function serializeForSupabase(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  userId: string
): Record<string, unknown> {
  switch (table) {
    case 'tasks':          return taskToRow(data as Task, userId)
    case 'goals':          return goalToRow(data as Goal, userId)
    case 'journal':        return journalToRow(data as JournalEntry, userId)
    case 'inbox_items':    return inboxItemsToRow(data as InboxItem, userId)
    case 'categories':     return categoryToRow(data as Category, userId)
    case 'settings':       return settingsToRow(data as AppSettings, userId)
    case 'shopping_items':  return shoppingItemToRow(data as ShoppingItem, userId)
    case 'habits':          return habitToRow(data as Habit, userId)
    case 'weekly_reviews':  return weeklyReviewToRow(data as WeeklyReview, userId)
    case 'daily_plans':     return dailyPlanToRow(data as DailyPlan, userId)
    case 'coping_cards':   return copingCardToRow(data as CopingCard, userId)
    case 'habit_log':      return habitLogToRow(data as { id: string; taskId: string; date: string }, userId)
    case 'mood_entries':   return moodEntryToRow(data as MoodEntry, userId)
    case 'workspaces': {
      const ws = data as Workspace
      return {
        id:         ws.id,
        name:       ws.name,
        owner_id:   ws.ownerId ?? userId,
        created_at: new Date(ws.createdAt).toISOString(),
        updated_at: new Date(ws.updatedAt).toISOString(),
        ...(ws.deletedAt ? { deleted_at: new Date(ws.deletedAt).toISOString() } : {}),
      }
    }
    case 'workspace_members': {
      const wm = data as WorkspaceMember
      return {
        workspace_id:  wm.workspaceId,
        user_id:       wm.userId,
        role:          wm.role,
        invited_email: wm.invitedEmail ?? null,
        joined_at:     wm.joinedAt ? new Date(wm.joinedAt).toISOString() : null,
        created_at:    new Date(wm.createdAt).toISOString(),
        updated_at:    new Date(wm.updatedAt).toISOString(),
      }
    }
    default:               return { ...data, user_id: userId }
  }
}

// ── Selective sync ────────────────────────────────────────────────────────────

const DEFAULT_SYNC_PREFS = { tasks: true, habits: true, goals: true, journal: false, moods: false, shopping: true }

// Maps Supabase table names → syncPrefs key. Tables absent from this map always sync.
const SYNC_TABLE_MAP: Partial<Record<string, keyof typeof DEFAULT_SYNC_PREFS>> = {
  tasks:          'tasks',
  habits:         'habits',
  goals:          'goals',
  journal:        'journal',
  mood_entries:   'moods',
  shopping_items: 'shopping',
}

async function getSyncPrefs(): Promise<typeof DEFAULT_SYNC_PREFS> {
  const settings = await db.settings.get(1)
  return { ...DEFAULT_SYNC_PREFS, ...(settings?.syncPrefs ?? {}) }
}

// ── Outbox drain ──────────────────────────────────────────────────────────────
// Processes all due outbox entries. Called from triggerSync() and also on
// reconnect events. Returns the count of remaining (failed) entries.

export async function drainOutbox(): Promise<number> {
  const userId = await getUserIdAsync()
  if (!userId) return 0

  const syncPrefs = await getSyncPrefs()

  // Fetch all entries that are due for retry, oldest first — skip dead-lettered
  const due: OutboxEntry[] = (await db.outbox
    .where('nextRetryAt')
    .belowOrEqual(Date.now())
    .sortBy('queuedAt')
  ).filter(e => {
    if (e.deadLettered) return false
    const prefKey = SYNC_TABLE_MAP[e.table]
    if (prefKey && !syncPrefs[prefKey]) return false  // table disabled by user pref
    return true
  })

  if (due.length === 0) return 0

  let failures = 0

  for (const entry of due) {
    try {
      if (entry.op === 'delete') {
        // Try soft-delete first (requires 002_incremental_sync.sql migration).
        // If we have the full record snapshot, merge deleted_at into the
        // serialized row so the server retains all field values. Other devices
        // pulling the row will see the complete state + deleted_at and remove
        // it locally — preventing ghost re-inserts from partial payloads.
        const deletedAt = new Date().toISOString()
        const softPayload = entry.data
          ? { ...serializeForSupabase(entry.table, entry.data, userId), deleted_at: deletedAt }
          : { id: entry.recordId, user_id: userId, deleted_at: deletedAt }
        const softResult = await supabase
          .from(entry.table)
          .upsert(softPayload, { onConflict: 'id' })
        if (softResult.error) {
          // Fallback: hard delete (works before migration; no multi-device propagation)
          const { error } = await supabase
            .from(entry.table)
            .delete()
            .eq('id', entry.recordId)
            .eq('user_id', userId)
          if (error) throw error
        }
      } else {
        // Upsert: send the full local record + idempotency key header
        const row = serializeForSupabase(entry.table, entry.data, userId)
        const conflictCol =
          entry.table === 'settings'    ? 'user_id' :
          entry.table === 'daily_plans' ? 'user_id,date' :
          'id'
        const { error } = await supabase
          .from(entry.table)
          .upsert(row, { onConflict: conflictCol })
          // Note: Supabase JS client doesn't expose a raw header API for
          // Idempotency-Key, but the key is stored for dedup tracking.
          // Full header support requires a direct fetch() call — added when
          // Supabase supports it natively or via a custom fetch wrapper.
        if (error) throw error
      }
      // Success — remove from outbox
      await db.outbox.delete(entry.key)
    } catch (err) {
      // Server-side cap rejection: silently drop the entry rather than dead-lettering.
      // This only happens when a second device bypassed the client cap — the server is
      // the authoritative guard and the write should simply not go through.
      if (errMsg(err).includes('active_task_cap_exceeded')) {
        await db.outbox.delete(entry.key)
        console.warn(`[sync] active task cap rejected by server — outbox entry dropped`)
        window.dispatchEvent(new CustomEvent('sync:cap-exceeded'))
        continue
      }
      failures++
      const attempts = entry.attempts + 1
      const deadLettered = attempts >= MAX_OUTBOX_ATTEMPTS
      // Exponential back-off: 30 s, 60 s, 90 s … cap at 5 min
      const backoffMs = Math.min(30_000 * attempts, 300_000)
      await db.outbox.update(entry.key, {
        attempts,
        nextRetryAt:  Date.now() + backoffMs,
        lastError:    errMsg(err),
        deadLettered,
      })
      if (deadLettered) {
        console.warn(`[sync] dead-lettered ${entry.key} after ${attempts} attempts: ${errMsg(err)}`)
      }
    }
  }

  return failures
}

// ── Incremental pull ──────────────────────────────────────────────────────────
// Reads from the incremental_sync_events event log (built by migrations 002-004).
// Only fetches events newer than the last pull watermark — a single query covers
// all tables. RLS ensures we only see our own events.
//
// Event payload is the full NEW row (for insert/update) or OLD row (for delete),
// so we can apply it directly with LWW merge.

export async function incrementalPull(): Promise<{ pulled: number; deleted: number }> {
  const userId = await getUserIdAsync()
  if (!userId) return { pulled: 0, deleted: 0 }

  const since = getLastPullAt()  // ISO string or null

  // Single query across all tables — RLS filters by user_id automatically
  let q = supabase
    .from('incremental_sync_events')
    .select('id, collection_name, operation, occurred_at, payload')
    .order('occurred_at', { ascending: true })

  if (since) q = q.gt('occurred_at', since)

  const { data: events, error } = await q

  if (error || !events || events.length === 0) {
    // If the event log tables don't exist yet (migration not applied), fall
    // back to a full pull of tasks only so the app stays functional.
    if (error) await _fallbackFullPull(userId)
    return { pulled: 0, deleted: 0 }
  }

  let pulled  = 0
  let deleted = 0
  let maxOccurredAt: string | null = null

  const tombstoneIds = new Set((await db.deletedTasks.toArray()).map(t => t.id))

  for (const event of events) {
    const table     = event.collection_name as string
    const op        = event.operation as 'insert' | 'update' | 'delete'
    const payload   = event.payload as Record<string, unknown>
    const occurredAt = event.occurred_at as string

    if (!maxOccurredAt || occurredAt > maxOccurredAt) maxOccurredAt = occurredAt

    if (op === 'delete') {
      const id = payload.id as string
      switch (table) {
        case 'tasks':
          await db.deletedTasks.put({ id, deletedAt: Date.now() })
          await db.tasks.delete(id)
          break
        case 'goals':          await db.goals.delete(id);         break
        case 'journal':        await db.journal.delete(id);       break
        case 'inbox_items':    await db.inboxItems.delete(id);    break
        case 'coping_cards':   await db.copingCards.delete(id);   break
        case 'categories':     await db.categories.delete(id);    break
        case 'shopping_items':  await db.shoppingItems.delete(id);      break
        case 'habits':          await db.habits.delete(id);             break
        case 'weekly_reviews':  await db.weeklyReviews.delete(id);      break
        case 'daily_plans':     await db.dailyPlans.delete(id as string); break
        case 'mood_entries':    await db.moodEntries.delete(id);           break
      }
      deleted++
      continue
    }

    // insert or update — apply with LWW
    switch (table) {
      case 'tasks': {
        const id = payload.id as string
        if (tombstoneIds.has(id)) break  // locally deleted — skip
        const incoming   = rowToTask(payload)
        const local      = await db.tasks.get(id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        // Completion guard: if this task was completed locally but the outbox
        // hasn't drained yet, the server still has done=false. Don't let that
        // stale row re-open the task. Once the outbox drains the server will
        // have done=true and the next pull will pass this check cleanly.
        if (!incoming.done || !local) {
          const completed = await db.completedTasks.get(id)
          if (completed && !incoming.done && completed.completedAt >= incomingTs) break
        }
        if (local) {
          const outboxEntry = await db.outbox.get(`tasks:${id}`)
          if (outboxEntry?.changedFields) {
            const merged = fieldLevelMerge({ ...local } as Record<string, unknown>, incoming as unknown as Record<string, unknown>, outboxEntry.changedFields)
            merged['sub'] = mergeSubTasks(local.sub ?? [], incoming.sub ?? [])
            await db.tasks.put(merged as unknown as Task); pulled++
          } else if (incomingTs > localTs) {
            const merged = { ...incoming, sub: mergeSubTasks(local.sub ?? [], incoming.sub ?? []) }
            await db.tasks.put(merged); pulled++
          }
        } else {
          await db.tasks.put(incoming); pulled++
        }
        break
      }
      case 'goals': {
        const incoming   = rowToGoal(payload)
        const local      = await db.goals.get(incoming.id) as (Goal & { updatedAt?: number }) | undefined
        const incomingTs = payload.updated_at ? new Date(payload.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) { await db.goals.put(incoming); pulled++ }
        break
      }
      case 'journal': {
        const incoming   = rowToJournal(payload)
        const local      = await db.journal.get(incoming.id) as (JournalEntry & { updatedAt?: number }) | undefined
        const incomingTs = payload.updated_at ? new Date(payload.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) { await db.journal.put(incoming); pulled++ }
        break
      }
      case 'inbox_items': {
        const incoming: InboxItem = {
          id:              payload.id as string,
          text:            (payload.text as string) ?? '',
          source:          (payload.source as InboxItem['source']) ?? 'capture',
          sourceMeta:      (payload.source_meta as InboxItem['sourceMeta']) ?? undefined,
          createdAt:       payload.created_at ? new Date(payload.created_at as string).getTime() : Date.now(),
          updatedAt:       payload.updated_at ? new Date(payload.updated_at as string).getTime() : undefined,
          processedAt:     payload.processed_at ? new Date(payload.processed_at as string).getTime() : undefined,
          status:          (payload.status as InboxItem['status']) ?? 'inbox',
          convertedTaskId: (payload.converted_task_id as string | undefined) ?? undefined,
        }
        const local      = await db.inboxItems.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? incoming.createdAt ?? 0
        const localTs    = local?.updatedAt ?? local?.createdAt ?? 0
        if (!local || incomingTs > localTs) { await db.inboxItems.put(incoming); pulled++ }
        break
      }
      case 'coping_cards': {
        const incoming   = rowToCopingCard(payload)
        const local      = await db.copingCards.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) { await db.copingCards.put(incoming); pulled++ }
        break
      }
      case 'categories': {
        await db.categories.put(rowToCategory(payload))
        pulled++
        break
      }
      case 'settings': {
        await db.settings.update(1, rowToSettings(payload))
        pulled++
        break
      }
      case 'shopping_items': {
        const incoming   = rowToShoppingItem(payload)
        const local      = await db.shoppingItems.get(incoming.id)
        const incomingTs = incoming.updatedAt
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) { await db.shoppingItems.put(incoming); pulled++ }
        break
      }
      case 'habits': {
        const incoming   = rowToHabit(payload)
        const local      = await db.habits.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) { await db.habits.put(incoming); pulled++ }
        break
      }
      case 'weekly_reviews': {
        const incoming   = rowToWeeklyReview(payload)
        const local      = await db.weeklyReviews.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) { await db.weeklyReviews.put(incoming); pulled++ }
        break
      }
      case 'daily_plans': {
        const incoming = rowToDailyPlan(payload)
        const local    = await db.dailyPlans.get(incoming.date)
        // DailyPlan has no updatedAt — last write wins (date is the PK)
        if (!local || (incoming.completedAt ?? 0) > (local.completedAt ?? 0)) {
          await db.dailyPlans.put(incoming); pulled++
        }
        break
      }
      case 'mood_entries': {
        const incoming   = rowToMoodEntry(payload)
        const local      = await db.moodEntries.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? incoming.createdAt ?? 0
        const localTs    = local?.updatedAt ?? local?.createdAt ?? 0
        if (!local || incomingTs > localTs) { await db.moodEntries.put(incoming); pulled++ }
        break
      }
    }
  }

  // Advance watermark to the highest occurred_at seen in this batch
  if (maxOccurredAt) setLastPullAt(maxOccurredAt)

  return { pulled, deleted }
}

// ── Server-seq incremental pull (post migration 007) ─────────────────────────
// Replaces the synced_at watermark pull once migration 007 is deployed.
// Uses a monotonic server_seq assigned by Postgres trigger — immune to
// client clock skew. Pages through 100 rows at a time until empty.
//
// Returns null if server_seq columns are not yet populated (007 not deployed),
// allowing callers to fall back to incrementalPull().

const PULL_PAGE_SIZE = 100

const TABLE_PULLERS: Array<{
  name: string
  pull: (since: number, userId: string) => Promise<{ pulled: number; deleted: number; maxSeq: number }>
}> = [
  {
    name: 'tasks',
    pull: async (since, userId) => {
      let pulled = 0; let deleted = 0; let maxSeq = since; let hasMore = true
      const tombstoneIds = new Set((await db.deletedTasks.toArray()).map(t => t.id))
      while (hasMore) {
        const { data, error } = await supabase.from('tasks').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0
          if (seq > maxSeq) maxSeq = seq
          if (row.deleted_at) {
            await db.deletedTasks.put({ id: row.id as string, deletedAt: Date.now() })
            await db.tasks.delete(row.id as string); deleted++
          } else if (!tombstoneIds.has(row.id as string)) {
            const incoming = rowToTask(row); const local = await db.tasks.get(incoming.id)
            const inTs = incoming.updatedAt ?? 0; const loTs = local?.updatedAt ?? 0
            // Completion guard: block re-opening a locally-completed task whose
            // done=true hasn't reached the server yet (outbox not yet drained).
            if (!incoming.done || !local) {
              const completed = await db.completedTasks.get(incoming.id)
              if (completed && !incoming.done && completed.completedAt >= inTs) continue
            }
            if (local) {
              const outboxEntry = await db.outbox.get(`tasks:${incoming.id}`)
              if (outboxEntry?.changedFields) {
                const merged = fieldLevelMerge({ ...local } as Record<string, unknown>, incoming as unknown as Record<string, unknown>, outboxEntry.changedFields)
                merged['sub'] = mergeSubTasks(local.sub ?? [], incoming.sub ?? [])
                await db.tasks.put(merged as unknown as Task); pulled++
              } else if (inTs > loTs) {
                const merged = { ...incoming, sub: mergeSubTasks(local.sub ?? [], incoming.sub ?? []) }
                await db.tasks.put(merged); pulled++
              }
            } else {
              await db.tasks.put(incoming); pulled++
            }
          }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted, maxSeq }
    },
  },
  {
    name: 'habits',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('habits').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming = rowToHabit(row); const local = await db.habits.get(incoming.id)
          const inTs = incoming.updatedAt ?? 0; const loTs = local?.updatedAt ?? 0
          if (!local || inTs > loTs) { await db.habits.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'goals',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('goals').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming = rowToGoal(row); const local = await db.goals.get(incoming.id) as (Goal & { updatedAt?: number }) | undefined
          const inTs = row.updated_at ? new Date(row.updated_at as string).getTime() : 0
          const loTs = local?.updatedAt ?? 0
          if (!local || inTs > loTs) { await db.goals.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'settings',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since
      const { data } = await supabase.from('settings').select('*')
        .eq('user_id', userId).gt('server_seq', maxSeq).order('server_seq', { ascending: true }).limit(1)
      if (data && data.length > 0) {
        const seq = (data[0].server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
        await db.settings.update(1, rowToSettings(data[0])); pulled++
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'categories',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('categories').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          await db.categories.put(rowToCategory(row as Record<string, unknown>)); pulled++
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'journal',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('journal').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming   = rowToJournal(row as Record<string, unknown>)
          const local      = await db.journal.get(incoming.id) as (JournalEntry & { updatedAt?: number }) | undefined
          const inTs = row.updated_at ? new Date(row.updated_at as string).getTime() : 0
          const loTs = local?.updatedAt ?? 0
          if (!local || inTs > loTs) { await db.journal.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'shopping_items',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('shopping_items').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming   = rowToShoppingItem(row as Record<string, unknown>)
          const local      = await db.shoppingItems.get(incoming.id)
          const inTs = incoming.updatedAt
          const loTs = local?.updatedAt ?? 0
          if (!local || inTs > loTs) { await db.shoppingItems.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'weekly_reviews',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('weekly_reviews').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming   = rowToWeeklyReview(row as Record<string, unknown>)
          const local      = await db.weeklyReviews.get(incoming.id)
          const inTs = incoming.updatedAt ?? 0
          const loTs = local?.updatedAt ?? 0
          if (!local || inTs > loTs) { await db.weeklyReviews.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'daily_plans',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('daily_plans').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming = rowToDailyPlan(row as Record<string, unknown>)
          const local    = await db.dailyPlans.get(incoming.date)
          if (!local || (incoming.completedAt ?? 0) > (local.completedAt ?? 0)) {
            await db.dailyPlans.put(incoming); pulled++
          }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'inbox_items',
    pull: async (since, userId) => {
      let pulled = 0; let deleted = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('inbox_items').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          if (row.deleted_at) {
            await db.inboxItems.delete(row.id as string); deleted++
          } else {
            const incoming: InboxItem = {
              id:              row.id as string,
              text:            (row.text as string) ?? '',
              source:          (row.source as InboxItem['source']) ?? 'capture',
              sourceMeta:      (row.source_meta as InboxItem['sourceMeta']) ?? undefined,
              createdAt:       row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
              updatedAt:       row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
              processedAt:     row.processed_at ? new Date(row.processed_at as string).getTime() : undefined,
              status:          (row.status as InboxItem['status']) ?? 'inbox',
              convertedTaskId: (row.converted_task_id as string | undefined) ?? undefined,
            }
            const local = await db.inboxItems.get(incoming.id)
            const inTs  = incoming.updatedAt ?? incoming.createdAt ?? 0
            const loTs  = local?.updatedAt ?? local?.createdAt ?? 0
            if (!local || inTs > loTs) { await db.inboxItems.put(incoming); pulled++ }
          }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted, maxSeq }
    },
  },
  {
    name: 'coping_cards',
    pull: async (since, userId) => {
      let pulled = 0; let deleted = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('coping_cards').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          if (row.deleted_at) {
            await db.copingCards.delete(row.id as string); deleted++
          } else {
            const incoming = rowToCopingCard(row as Record<string, unknown>)
            const local    = await db.copingCards.get(incoming.id)
            const inTs     = incoming.updatedAt ?? 0
            const loTs     = local?.updatedAt ?? 0
            if (!local || inTs > loTs) { await db.copingCards.put(incoming); pulled++ }
          }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted, maxSeq }
    },
  },
  {
    name: 'habit_log',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('habit_log').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const entry = { id: row.id as string, taskId: row.task_id as string, date: row.date as string }
          if (!(await db.habitLog.get(entry.id))) { await db.habitLog.put(entry); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
  {
    name: 'mood_entries',
    pull: async (since, userId) => {
      let pulled = 0; let deleted = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('mood_entries').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          if (row.deleted_at) { await db.moodEntries.delete(row.id as string); deleted++; continue }
          const incoming   = rowToMoodEntry(row as Record<string, unknown>)
          const local      = await db.moodEntries.get(incoming.id)
          const inTs       = incoming.updatedAt ?? incoming.createdAt ?? 0
          const loTs       = local?.updatedAt ?? local?.createdAt ?? 0
          if (!local || inTs > loTs) { await db.moodEntries.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted, maxSeq }
    },
  },
  {
    name: 'workspaces',
    pull: async (since, userId) => {
      let pulled = 0; let deleted = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('workspaces').select('*')
          .eq('owner_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          if (row.deleted_at) { await db.workspaces.delete(row.id as string); deleted++; continue }
          const incoming = rowToWorkspace(row as Record<string, unknown>)
          const local    = await db.workspaces.get(incoming.id)
          const inTs     = incoming.updatedAt; const loTs = local?.updatedAt ?? 0
          if (!local || inTs > loTs) { await db.workspaces.put(incoming); pulled++ }
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted, maxSeq }
    },
  },
  {
    name: 'workspace_members',
    pull: async (since, userId) => {
      let pulled = 0; let maxSeq = since; let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase.from('workspace_members').select('*')
          .eq('user_id', userId).gt('server_seq', maxSeq)
          .order('server_seq', { ascending: true }).limit(PULL_PAGE_SIZE)
        if (error || !data || data.length === 0) { hasMore = false; break }
        for (const row of data) {
          const seq = (row.server_seq as number) ?? 0; if (seq > maxSeq) maxSeq = seq
          const incoming = rowToWorkspaceMember(row as Record<string, unknown>)
          await db.workspaceMembers.put(incoming); pulled++
        }
        hasMore = data.length === PULL_PAGE_SIZE
      }
      return { pulled, deleted: 0, maxSeq }
    },
  },
]

export async function incrementalPullBySeq(
  onProgress?: (pct: number) => void,
): Promise<{ pulled: number; deleted: number } | null> {
  const userId = await getUserIdAsync()
  if (!userId) return null

  // Check if migration 007 is deployed by probing server_seq on tasks
  const { data: probe } = await supabase.from('tasks')
    .select('server_seq').eq('user_id', userId).not('server_seq', 'is', null).limit(1)
  if (!probe || probe.length === 0) return null  // 007 not yet deployed — signal caller to fall back

  const lastSeq = getLastServerSeq()
  const syncPrefs = await getSyncPrefs()
  let totalPulled = 0; let totalDeleted = 0; let maxSeq = lastSeq

  for (let i = 0; i < TABLE_PULLERS.length; i++) {
    const puller = TABLE_PULLERS[i]
    const prefKey = SYNC_TABLE_MAP[puller.name]
    if (prefKey && !syncPrefs[prefKey]) continue  // table disabled by user pref
    const { pulled, deleted, maxSeq: tableMax } = await puller.pull(lastSeq, userId)
    totalPulled += pulled; totalDeleted += deleted
    if (tableMax > maxSeq) maxSeq = tableMax
    onProgress?.(Math.round(10 + ((i + 1) / TABLE_PULLERS.length) * 90))
  }

  if (maxSeq > lastSeq) setLastServerSeq(maxSeq)

  return { pulled: totalPulled, deleted: totalDeleted }
}

// ── Server tombstone helpers ───────────────────────────────────────────────────

export async function pushTombstoneToServer(taskId: string): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('deleted_tasks').upsert(
    { user_id: userId, task_id: taskId, deleted_at: new Date().toISOString() },
    { onConflict: 'user_id,task_id' }
  )
}

async function pullServerTombstones(userId: string): Promise<void> {
  const { data } = await supabase.from('deleted_tasks').select('task_id').eq('user_id', userId)
  if (!data || data.length === 0) return
  const now = Date.now()
  await Promise.all(
    data.map(r => db.deletedTasks.put({ id: r.task_id as string, deletedAt: now }))
  )
}

// ── Fallback full pull (used before migration 004 is applied) ─────────────────
// Fetches all tasks directly — no event log, no incremental. Keeps the app
// working while the migration is pending. Goals/journal/etc. are skipped
// (only tasks matter for immediate usability).
async function _fallbackFullPull(userId: string): Promise<void> {
  // Rebuild local tombstones from server before pulling — prevents ghost data
  // if IndexedDB was evicted and local tombstones were lost.
  await pullServerTombstones(userId)

  const { data: rows } = await supabase.from('tasks').select('*').eq('user_id', userId)
  if (!rows) return
  const tombstoneIds = new Set((await db.deletedTasks.toArray()).map(t => t.id))
  const toUpsert: Task[] = []
  for (const row of rows) {
    const id = row.id as string
    if (tombstoneIds.has(id)) continue
    if (row.deleted_at) {
      await db.deletedTasks.put({ id, deletedAt: Date.now() })
      await db.tasks.delete(id)
      continue
    }
    const incoming = rowToTask(row as Record<string, unknown>)
    const local    = await db.tasks.get(id)
    if (!local || (incoming.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      toUpsert.push(local ? { ...incoming, sub: mergeSubTasks(local.sub ?? [], incoming.sub ?? []) } : incoming)
    }
  }
  if (toUpsert.length > 0) await db.tasks.bulkPut(toUpsert)

  // Also pull settings (single row, no conflict risk)
  const { data: settings } = await supabase
    .from('settings').select('*').eq('user_id', userId).maybeSingle()
  if (settings) await db.settings.update(1, rowToSettings(settings as Record<string, unknown>))

  // shopping_items fallback
  const { data: items } = await supabase.from('shopping_items').select('*').eq('user_id', userId)
  if (items && items.length > 0) {
    for (const row of items) {
      const incoming = rowToShoppingItem(row as Record<string, unknown>)
      const local    = await db.shoppingItems.get(incoming.id)
      if (!local || incoming.updatedAt > (local?.updatedAt ?? 0)) {
        await db.shoppingItems.put(incoming)
      }
    }
  }

  // Remaining tables (goals, journal, inbox, categories, habits)
  {
    const [{ data: goals }, { data: journal }, { data: cats }, { data: habits }] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('journal').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('habits').select('*').eq('user_id', userId),
    ])
    if (goals?.length)   await db.goals.bulkPut(goals.map(r => rowToGoal(r as Record<string, unknown>)))
    if (journal?.length) await db.journal.bulkPut(journal.map(r => rowToJournal(r as Record<string, unknown>)))
    if (cats?.length)    await db.categories.bulkPut(cats.map(r => rowToCategory(r as Record<string, unknown>)))
    if (habits?.length) {
      for (const row of habits) {
        const incoming = rowToHabit(row as Record<string, unknown>)
        const local    = await db.habits.get(incoming.id)
        if (!local || (incoming.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          await db.habits.put(incoming)
        }
      }
    }
  }

  // weekly_reviews + daily_plans fallback
  {
    const [{ data: reviews }, { data: plans }] = await Promise.all([
      supabase.from('weekly_reviews').select('*').eq('user_id', userId),
      supabase.from('daily_plans').select('*').eq('user_id', userId),
    ])
    if (reviews?.length) {
      for (const row of reviews) {
        const incoming = rowToWeeklyReview(row as Record<string, unknown>)
        const local    = await db.weeklyReviews.get(incoming.id)
        if (!local || (incoming.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          await db.weeklyReviews.put(incoming)
        }
      }
    }
    if (plans?.length) {
      for (const row of plans) {
        const incoming = rowToDailyPlan(row as Record<string, unknown>)
        const local    = await db.dailyPlans.get(incoming.date)
        if (!local || (incoming.completedAt ?? 0) > (local.completedAt ?? 0)) {
          await db.dailyPlans.put(incoming)
        }
      }
    }
  }

  // Don't advance the watermark — on the next sync after migration is applied
  // we want a full event-log pull to catch up.
}

// ── Full push (nuclear reset only) ────────────────────────────────────────────

export async function pushAllLocal(): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return

  const tombstoneIds = new Set((await db.deletedTasks.toArray()).map(t => t.id))

  const [tasks, goals, journal, categories, settings, shoppingItems, habits, weeklyReviews, dailyPlans, inboxItems, copingCards, habitLogs, moodEntries] = await Promise.all([
    db.tasks.toArray(),
    db.goals.toArray(),
    db.journal.toArray(),
    db.categories.toArray(),
    db.settings.get(1),
    db.shoppingItems.toArray(),
    db.habits.toArray(),
    db.weeklyReviews.toArray(),
    db.dailyPlans.toArray(),
    db.inboxItems.toArray(),
    db.copingCards.toArray(),
    db.habitLog.toArray(),
    db.moodEntries.toArray(),
  ])

  const filteredTasks = tasks.filter(t => !tombstoneIds.has(t.id))

  await Promise.all([
    filteredTasks.length
      ? supabase.from('tasks').upsert(filteredTasks.map(t => taskToRow(t, userId)), { onConflict: 'id' })
      : null,
    goals.length
      ? supabase.from('goals').upsert(goals.map(g => goalToRow(g, userId)), { onConflict: 'id' })
      : null,
    journal.length
      ? supabase.from('journal').upsert(journal.map(j => journalToRow(j, userId)), { onConflict: 'id' })
      : null,
    categories.length
      ? supabase.from('categories').upsert(categories.map(c => categoryToRow(c, userId)), { onConflict: 'id' })
      : null,
    settings
      ? supabase.from('settings').upsert(settingsToRow(settings, userId), { onConflict: 'user_id' })
      : null,
    shoppingItems.length
      ? supabase.from('shopping_items').upsert(shoppingItems.map(i => shoppingItemToRow(i, userId)), { onConflict: 'id' })
      : null,
    habits.length
      ? supabase.from('habits').upsert(habits.map(h => habitToRow(h, userId)), { onConflict: 'id' })
      : null,
    weeklyReviews.length
      ? supabase.from('weekly_reviews').upsert(weeklyReviews.map(r => weeklyReviewToRow(r, userId)), { onConflict: 'id' })
      : null,
    dailyPlans.length
      ? supabase.from('daily_plans').upsert(dailyPlans.map(p => dailyPlanToRow(p, userId)), { onConflict: 'user_id,date' })
      : null,
    inboxItems.length
      ? supabase.from('inbox_items').upsert(inboxItems.map(i => inboxItemsToRow(i, userId)), { onConflict: 'id' })
      : null,
    copingCards.filter(c => !c.isDefault).length
      ? supabase.from('coping_cards').upsert(copingCards.filter(c => !c.isDefault).map(c => copingCardToRow(c, userId)), { onConflict: 'id' })
      : null,
    habitLogs.length
      ? supabase.from('habit_log').upsert(habitLogs.map(l => habitLogToRow(l, userId)), { onConflict: 'id' })
      : null,
    moodEntries.length
      ? supabase.from('mood_entries').upsert(moodEntries.map(e => moodEntryToRow(e, userId)), { onConflict: 'id' })
      : null,
  ])
}

// ── Realtime subscriptions ────────────────────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
let _realtimeUserId: string | null = null

export function startRealtime(userId: string): void {
  // If we already have a live channel for this user, do nothing.
  // Tearing down and recreating causes connection churn that can delay
  // in-flight REST requests (e.g. drainOutbox) and triggers the 30s timeout.
  if (_realtimeUserId === userId && realtimeChannel) return

  // User changed (e.g. account switch) or channel was torn down — rebuild.
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
  _realtimeUserId = userId

  realtimeChannel = supabase
    .channel(`mbq-${userId}`)

    // ── tasks ──────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.tasks.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        // Soft-delete propagation via realtime
        if (row.deleted_at) {
          const id = row.id as string
          await db.deletedTasks.put({ id, deletedAt: Date.now() })
          await db.tasks.delete(id)
          return
        }
        // LWW: skip if we have a newer local version
        const incoming   = rowToTask(row)
        const local      = await db.tasks.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        // Completion guard: don't let a stale done=false from the server
        // re-open a task that was completed locally but not yet synced.
        if (!incoming.done || !local) {
          const completed = await db.completedTasks.get(incoming.id)
          if (completed && !incoming.done && completed.completedAt >= incomingTs) return
        }
        if (local) {
          const outboxEntry = await db.outbox.get(`tasks:${incoming.id}`)
          if (outboxEntry?.changedFields) {
            const merged = fieldLevelMerge({ ...local } as Record<string, unknown>, incoming as unknown as Record<string, unknown>, outboxEntry.changedFields)
            merged['sub'] = mergeSubTasks(local.sub ?? [], incoming.sub ?? [])
            await db.tasks.put(merged as unknown as Task)
          } else if (incomingTs > localTs) {
            const merged = { ...incoming, sub: mergeSubTasks(local.sub ?? [], incoming.sub ?? []) }
            await db.tasks.put(merged)
          }
        } else {
          await db.tasks.put(incoming)
        }
      }
    )

    // ── goals ──────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.goals.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.goals.delete(row.id as string); return }
        const incoming   = rowToGoal(row)
        const local      = await db.goals.get(incoming.id) as (Goal & { updatedAt?: number }) | undefined
        const incomingTs = row.updated_at ? new Date(row.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) await db.goals.put(incoming)
      }
    )

    // ── journal ────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'journal', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.journal.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.journal.delete(row.id as string); return }
        const incoming   = rowToJournal(row)
        const local      = await db.journal.get(incoming.id) as (JournalEntry & { updatedAt?: number }) | undefined
        const incomingTs = row.updated_at ? new Date(row.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) await db.journal.put(incoming)
      }
    )

    // ── categories ─────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.categories.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.categories.delete(row.id as string); return }
        await db.categories.put(rowToCategory(row))
      }
    )

    // ── settings ───────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType !== 'DELETE') {
          await db.settings.update(1, rowToSettings(payload.new as Record<string, unknown>))
        }
      }
    )

    // ── shopping_items ─────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'shopping_items', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.shoppingItems.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.shoppingItems.delete(row.id as string); return }
        const incoming   = rowToShoppingItem(row)
        const local      = await db.shoppingItems.get(incoming.id)
        const incomingTs = incoming.updatedAt
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) await db.shoppingItems.put(incoming)
      }
    )

    // ── habits ─────────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.habits.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.habits.delete(row.id as string); return }
        const incoming   = rowToHabit(row)
        const local      = await db.habits.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) await db.habits.put(incoming)
      }
    )

    // ── weekly_reviews ─────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'weekly_reviews', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.weeklyReviews.delete((payload.old as { id: string }).id)
          return
        }
        const row        = payload.new as Record<string, unknown>
        const incoming   = rowToWeeklyReview(row)
        const local      = await db.weeklyReviews.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) await db.weeklyReviews.put(incoming)
      }
    )

    // ── daily_plans ────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'daily_plans', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.dailyPlans.delete((payload.old as { date: string }).date)
          return
        }
        const row      = payload.new as Record<string, unknown>
        const incoming = rowToDailyPlan(row)
        const local    = await db.dailyPlans.get(incoming.date)
        if (!local || (incoming.completedAt ?? 0) > (local.completedAt ?? 0)) {
          await db.dailyPlans.put(incoming)
        }
      }
    )

    // ── inbox_items ────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'inbox_items', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.inboxItems.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.inboxItems.delete(row.id as string); return }
        const incoming: InboxItem = {
          id:              row.id as string,
          text:            (row.text as string) ?? '',
          source:          (row.source as InboxItem['source']) ?? 'capture',
          sourceMeta:      (row.source_meta as InboxItem['sourceMeta']) ?? undefined,
          createdAt:       row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
          updatedAt:       row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
          processedAt:     row.processed_at ? new Date(row.processed_at as string).getTime() : undefined,
          status:          (row.status as InboxItem['status']) ?? 'inbox',
          convertedTaskId: (row.converted_task_id as string | undefined) ?? undefined,
        }
        const local      = await db.inboxItems.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? incoming.createdAt ?? 0
        const localTs    = local?.updatedAt ?? local?.createdAt ?? 0
        if (!local || incomingTs > localTs) await db.inboxItems.put(incoming)
      }
    )

    // ── coping_cards ───────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'coping_cards', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.copingCards.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.copingCards.delete(row.id as string); return }
        const incoming   = rowToCopingCard(row)
        const local      = await db.copingCards.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs > localTs) await db.copingCards.put(incoming)
      }
    )

    // ── habit_log ──────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'habit_log', filter: `user_id=eq.${userId}` },
      async (payload) => {
        const row = payload.new as { id: string; task_id: string; date: string }
        if (!(await db.habitLog.get(row.id))) {
          await db.habitLog.put({ id: row.id, taskId: row.task_id, date: row.date })
        }
      }
    )

    // ── mood_entries ───────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'mood_entries', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.moodEntries.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.moodEntries.delete(row.id as string); return }
        const incoming   = rowToMoodEntry(row)
        const local      = await db.moodEntries.get(incoming.id)
        const incomingTs = incoming.updatedAt ?? incoming.createdAt ?? 0
        const localTs    = local?.updatedAt ?? local?.createdAt ?? 0
        if (!local || incomingTs > localTs) await db.moodEntries.put(incoming)
      }
    )

    // ── workspaces ─────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'workspaces', filter: `owner_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.workspaces.delete((payload.old as { id: string }).id); return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.workspaces.delete(row.id as string); return }
        const incoming = rowToWorkspace(row)
        const local    = await db.workspaces.get(incoming.id)
        if (!local || incoming.updatedAt > (local.updatedAt ?? 0)) await db.workspaces.put(incoming)
      }
    )

    // ── workspace_members ──────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'workspace_members', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { workspace_id: string; user_id: string }
          await db.workspaceMembers.delete([old.workspace_id, old.user_id]); return
        }
        const row = payload.new as Record<string, unknown>
        await db.workspaceMembers.put(rowToWorkspaceMember(row))
      }
    )

    .subscribe()
}

export function stopRealtime(): void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
  _realtimeUserId = null
}

// ── Outbox size (used by SyncStatusBar for pending indicator) ─────────────────
export async function outboxSize(): Promise<number> {
  return db.outbox.filter(e => !e.deadLettered).count()
}

/** Count of dead-lettered entries (gave up after MAX_OUTBOX_ATTEMPTS). */
export async function outboxDeadCount(): Promise<number> {
  return db.outbox.filter(e => !!e.deadLettered).count()
}

/** Returns pending (non-dead) outbox task IDs as a Set<string>. */
export async function getPendingTaskIds(): Promise<Set<string>> {
  const entries = await db.outbox.filter(e => e.table === 'tasks' && !e.deadLettered).toArray()
  return new Set(entries.map(e => e.recordId))
}

/** Returns dead-lettered outbox task IDs as a Set<string>. */
export async function getFailedTaskIds(): Promise<Set<string>> {
  const entries = await db.outbox.filter(e => e.table === 'tasks' && !!e.deadLettered).toArray()
  return new Set(entries.map(e => e.recordId))
}

/** Returns all dead-lettered outbox entries with their last error (for dashboard). */
export async function getDeadEntries(): Promise<Array<{ key: string; table: string; recordId: string; attempts: number; lastError?: string }>> {
  return db.outbox.filter(e => !!e.deadLettered).toArray()
}

/** Re-queue all dead-lettered entries for retry (user-initiated). */
export async function retryDeadLettered(): Promise<void> {
  const dead = await db.outbox.filter(e => !!e.deadLettered).toArray()
  for (const entry of dead) {
    await db.outbox.update(entry.key, {
      deadLettered: false,
      attempts:     0,
      nextRetryAt:  Date.now(),
      lastError:    undefined,
    })
  }
}

/** Keep local version — re-queue dead-lettered entry with a fresh idempotency key. */
export async function resolveKeepLocal(key: string): Promise<void> {
  await db.outbox.update(key, {
    deadLettered:    false,
    attempts:        0,
    nextRetryAt:     Date.now(),
    lastError:       undefined,
    idempotencyKey:  makeId(),
  })
}

/** Accept server version — fetch the server record, overwrite local, remove from outbox. */
export async function resolveAcceptServer(table: string, recordId: string): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  try {
    const { data } = await supabase.from(table).select('*').eq('id', recordId).eq('user_id', userId).single()
    if (data) {
      // Put the server version into the appropriate local table
      const row = data as Record<string, unknown>
      switch (table) {
        case 'tasks':          await db.tasks.put(rowToTask(row)); break
        case 'habits':         await db.habits.put(rowToHabit(row)); break
        case 'goals':          await db.goals.put(rowToGoal(row)); break
        case 'journal':        await db.journal.put(rowToJournal(row)); break
        case 'shopping_items': await db.shoppingItems.put(rowToShoppingItem(row)); break
        case 'coping_cards':   await db.copingCards.put(rowToCopingCard(row)); break
        case 'mood_entries':   await db.moodEntries.put(rowToMoodEntry(row)); break
      }
    }
    await db.outbox.delete(`${table}:${recordId}`)
  } catch {
    // Non-critical — leave in dead-letter queue if fetch fails
  }
}

/** Discard — remove dead-lettered entry from outbox, leave local record unchanged (no sync). */
export async function resolveDiscard(key: string): Promise<void> {
  await db.outbox.delete(key)
}

/**
 * Prune incremental_sync_events rows older than max_age_days (default 30).
 * Called silently after a successful sync — fire-and-forget, never throws.
 */
export async function pruneEventLog(maxAgeDays = 30): Promise<void> {
  try {
    await supabase.rpc('incremental_sync_prune_events', { max_age_days: maxAgeDays })
  } catch {
    // Non-critical — swallow silently
  }
}
