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
 *       • else LWW check   → remote wins only if updatedAt >= local.updatedAt
 *     Records the max synced_at from this batch; next pull starts from there.
 *
 *  4. REALTIME SUBSCRIPTIONS  (startRealtime)
 *     Supabase Realtime pushes INSERT/UPDATE/DELETE events.
 *     LWW guard: only overwrites local if incoming updatedAt >= local.updatedAt.
 *     Handles soft-deletes: if the incoming row has deleted_at, delete locally.
 *
 *  5. FULL PUSH AFTER RESET  (pushAllLocal)
 *     Used only after a nuclear reset — bypasses outbox for the initial mass push.
 */

import { supabase } from './supabase'
import { db, type OutboxEntry } from '../data/db'
import type { Task, Goal, JournalEntry, InboxItem, Category, AppSettings, ShoppingItem } from '../types'

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
// Stored as an ISO string — the max synced_at from the last pull.
// Using the server's synced_at (set by trigger) instead of client time
// means clock skew between devices can never create missed records.

const LAST_PULL_KEY = 'mbq_last_pull_at'

export function getLastPullAt(): string | null {
  try { return localStorage.getItem(LAST_PULL_KEY) } catch { return null }
}

function setLastPullAt(iso: string): void {
  try { localStorage.setItem(LAST_PULL_KEY, iso) } catch {}
}

// ── Outbox helpers ────────────────────────────────────────────────────────────
// Called synchronously inside every mutation helper in db.ts.
// Does NOT throw — outbox failures are non-blocking (will retry via drain).

export function enqueueUpsert(table: string, recordId: string, data: object): void {
  const key = `${table}:${recordId}`
  const now  = Date.now()
  // fire-and-forget put (IndexedDB is async but we don't need to await here)
  db.outbox.put({
    key,
    table,
    recordId,
    op:          'upsert',
    data,
    queuedAt:    now,
    attempts:    0,
    nextRetryAt: now,
  }).catch(() => {/* silently fail — worst case we just miss this sync */})
}

export function enqueueDelete(table: string, recordId: string): void {
  const key = `${table}:${recordId}`
  const now  = Date.now()
  db.outbox.put({
    key,
    table,
    recordId,
    op:          'delete',
    queuedAt:    now,
    attempts:    0,
    nextRetryAt: now,
  }).catch(() => {})
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
    ctx:           task.ctx,
    quad:          task.quad,
    recurring:     task.recurring,
    done:          task.done,
    sub:           task.sub,
    is_habit:      task.isHabit ?? null,
    status:        task.status ?? null,
    pomodoro_mins: task.pomodoroMins ?? null,
    time:          task.time ?? null,
    notes:         task.notes ?? null,
    created_at:    task.createdAt ?? null,
    updated_at:    task.updatedAt ? new Date(task.updatedAt).toISOString() : isoNow(),
  }
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id:           row.id as string,
    cat:          (row.cat as string) ?? '',
    title:        (row.title as string) ?? '',
    effort:       (row.effort as Task['effort']) ?? 's',
    due:          (row.due as string) ?? 'Today',
    streak:       (row.streak as number) ?? 0,
    ctx:          (row.ctx as string) ?? '',
    quad:         (row.quad as Task['quad']) ?? 'q2',
    recurring:    (row.recurring as string | null) ?? null,
    done:         (row.done as boolean) ?? false,
    sub:          (row.sub as Task['sub']) ?? [],
    isHabit:      (row.is_habit as boolean | undefined) ?? undefined,
    status:       (row.status as Task['status'] | undefined) ?? undefined,
    pomodoroMins: (row.pomodoro_mins as number | undefined) ?? undefined,
    time:         (row.time as string | undefined) ?? undefined,
    notes:        (row.notes as string | undefined) ?? undefined,
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

function inboxToRow(item: InboxItem, userId: string) {
  return {
    id:         item.id,
    user_id:    userId,
    kind:       item.kind,
    source:     item.source ?? null,
    text:       item.text,
    when_ts:    item.when,
    processed:  item.processed,
    updated_at: isoNow(),
  }
}

function rowToInbox(row: Record<string, unknown>): InboxItem {
  return {
    id:        row.id as string,
    kind:      (row.kind as InboxItem['kind']) ?? 'capture',
    source:    (row.source as string | undefined) ?? undefined,
    text:      (row.text as string) ?? '',
    when:      (row.when_ts as string) ?? '',
    processed: (row.processed as boolean) ?? false,
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
    variant:               s.variant,
    intensity:             s.intensity,
    default_pomodoro_mins: s.defaultPomodoroMins,
    notifications:         s.notifications,
    onboarded:             s.onboarded,
    xp:                    s.xp,
    streak:                s.streak,
    updated_at:            isoNow(),
  }
}

function rowToSettings(row: Record<string, unknown>): Partial<AppSettings> {
  return {
    theme:               (row.theme as AppSettings['theme']) ?? 'auto',
    variant:             (row.variant as AppSettings['variant']) ?? 'warm',
    intensity:           (row.intensity as AppSettings['intensity']) ?? 'balanced',
    defaultPomodoroMins: (row.default_pomodoro_mins as number) ?? 25,
    notifications:       (row.notifications as AppSettings['notifications']),
    onboarded:           (row.onboarded as boolean) ?? false,
    xp:                  (row.xp as number) ?? 0,
    streak:              (row.streak as number) ?? 0,
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
    createdAt: (row.created_at as number | undefined) ?? ts,
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : ts,
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
    case 'inbox':          return inboxToRow(data as InboxItem, userId)
    case 'categories':     return categoryToRow(data as Category, userId)
    case 'settings':       return settingsToRow(data as AppSettings, userId)
    case 'shopping_items': return shoppingItemToRow(data as ShoppingItem, userId)
    default:               return { ...data, user_id: userId }
  }
}

// ── Outbox drain ──────────────────────────────────────────────────────────────
// Processes all due outbox entries. Called from triggerSync() and also on
// reconnect events. Returns the count of remaining (failed) entries.

export async function drainOutbox(): Promise<number> {
  const userId = await getUserIdAsync()
  if (!userId) return 0

  // Fetch all entries that are due for retry, oldest first
  const due: OutboxEntry[] = await db.outbox
    .where('nextRetryAt')
    .belowOrEqual(Date.now())
    .sortBy('queuedAt')

  if (due.length === 0) return 0

  let failures = 0

  for (const entry of due) {
    try {
      if (entry.op === 'delete') {
        // Try soft-delete first (requires 002_incremental_sync.sql migration).
        // If deleted_at column doesn't exist yet, fall back to hard delete.
        const softResult = await supabase
          .from(entry.table)
          .upsert(
            { id: entry.recordId, user_id: userId, deleted_at: new Date().toISOString() },
            { onConflict: 'id' }
          )
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
        // Upsert: send the full local record
        const row = serializeForSupabase(entry.table, entry.data, userId)
        const conflictCol = entry.table === 'settings' ? 'user_id' : 'id'
        const { error } = await supabase
          .from(entry.table)
          .upsert(row, { onConflict: conflictCol })
        if (error) throw error
      }
      // Success — remove from outbox
      await db.outbox.delete(entry.key)
    } catch (err) {
      failures++
      const attempts = entry.attempts + 1
      // Exponential back-off: 30 s, 60 s, 90 s … cap at 5 min
      const backoffMs = Math.min(30_000 * attempts, 300_000)
      await db.outbox.update(entry.key, {
        attempts,
        nextRetryAt: Date.now() + backoffMs,
        lastError:   String(err),
      })
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
        case 'inbox':          await db.inbox.delete(id);         break
        case 'categories':     await db.categories.delete(id);    break
        case 'shopping_items': await db.shoppingItems.delete(id); break
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
        if (!local || incomingTs >= localTs) { await db.tasks.put(incoming); pulled++ }
        break
      }
      case 'goals': {
        const incoming   = rowToGoal(payload)
        const local      = await db.goals.get(incoming.id) as (Goal & { updatedAt?: number }) | undefined
        const incomingTs = payload.updated_at ? new Date(payload.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs >= localTs) { await db.goals.put(incoming); pulled++ }
        break
      }
      case 'journal': {
        const incoming   = rowToJournal(payload)
        const local      = await db.journal.get(incoming.id) as (JournalEntry & { updatedAt?: number }) | undefined
        const incomingTs = payload.updated_at ? new Date(payload.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs >= localTs) { await db.journal.put(incoming); pulled++ }
        break
      }
      case 'inbox': {
        const incoming   = rowToInbox(payload)
        const local      = await db.inbox.get(incoming.id) as (InboxItem & { updatedAt?: number }) | undefined
        const incomingTs = payload.updated_at ? new Date(payload.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs >= localTs) { await db.inbox.put(incoming); pulled++ }
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
        if (!local || incomingTs >= localTs) { await db.shoppingItems.put(incoming); pulled++ }
        break
      }
    }
  }

  // Advance watermark to the highest occurred_at seen in this batch
  if (maxOccurredAt) setLastPullAt(maxOccurredAt)

  return { pulled, deleted }
}

// ── Fallback full pull (used before migration 004 is applied) ─────────────────
// Fetches all tasks directly — no event log, no incremental. Keeps the app
// working while the migration is pending. Goals/journal/etc. are skipped
// (only tasks matter for immediate usability).
async function _fallbackFullPull(userId: string): Promise<void> {
  const { data: rows } = await supabase.from('tasks').select('*').eq('user_id', userId)
  if (!rows) return
  const tombstoneIds = new Set((await db.deletedTasks.toArray()).map(t => t.id))
  const toUpsert: Task[] = []
  for (const row of rows) {
    const id = row.id as string
    if (tombstoneIds.has(id)) continue
    const incoming = rowToTask(row as Record<string, unknown>)
    const local    = await db.tasks.get(id)
    if (!local || (incoming.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
      toUpsert.push(incoming)
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
      if (!local || incoming.updatedAt >= (local?.updatedAt ?? 0)) {
        await db.shoppingItems.put(incoming)
      }
    }
  }

  // Remaining tables (goals, journal, inbox, categories)
  {
    const [{ data: goals }, { data: journal }, { data: inbox }, { data: cats }] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('journal').select('*').eq('user_id', userId),
      supabase.from('inbox').select('*').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
    ])
    if (goals?.length)   await db.goals.bulkPut(goals.map(r => rowToGoal(r as Record<string, unknown>)))
    if (journal?.length) await db.journal.bulkPut(journal.map(r => rowToJournal(r as Record<string, unknown>)))
    if (inbox?.length)   await db.inbox.bulkPut(inbox.map(r => rowToInbox(r as Record<string, unknown>)))
    if (cats?.length)    await db.categories.bulkPut(cats.map(r => rowToCategory(r as Record<string, unknown>)))
  }

  // Don't advance the watermark — on the next sync after migration is applied
  // we want a full event-log pull to catch up.
}

// ── Compatibility shims (used in SyncStatusBar + legacy paths) ────────────────
// These keep the old API surface so SyncStatusBar needs minimal changes.

export interface PullPreview {
  toAdd:            Task[]
  toUpdate:         Task[]
  toDelete:         string[]
  tombstoneSkipped: number
}

/** @deprecated — use drainOutbox() + incrementalPull() instead */
export async function pushOnly(
  onProgress?: (done: number, total: number) => void
): Promise<{ tasksPushed: number }> {
  onProgress?.(0, 1)
  const failures = await drainOutbox()
  onProgress?.(1, 1)
  // Count pending outbox entries that are still tasks as "pushed"
  const remaining = await db.outbox.where('table').equals('tasks').count()
  return { tasksPushed: failures === 0 ? remaining : 0 }
}

/** @deprecated — use incrementalPull() instead */
export async function previewPull(): Promise<PullPreview> {
  // Run a real incremental pull and return an empty preview (no confirm modal needed)
  // The actual changes have already been applied.
  await incrementalPull()
  return { toAdd: [], toUpdate: [], toDelete: [], tombstoneSkipped: 0 }
}

/** @deprecated — no-op, pull already applied in previewPull */
export async function applyPull(_preview: PullPreview): Promise<void> {
  // no-op — incremental pull applies changes immediately
}

/** @deprecated — use incrementalPull() instead */
export async function pullNonTaskTables(): Promise<void> {
  // no-op — incrementalPull() handles all tables
}

/** @deprecated — use drainOutbox() + incrementalPull() instead */
export async function pullAll(): Promise<void> {
  await incrementalPull()
}

// ── Full push (nuclear reset only) ────────────────────────────────────────────

export async function pushAllLocal(): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return

  const tombstoneIds = new Set((await db.deletedTasks.toArray()).map(t => t.id))

  const [tasks, goals, journal, inbox, categories, settings, shoppingItems] = await Promise.all([
    db.tasks.toArray(),
    db.goals.toArray(),
    db.journal.toArray(),
    db.inbox.toArray(),
    db.categories.toArray(),
    db.settings.get(1),
    db.shoppingItems.toArray(),
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
    inbox.length
      ? supabase.from('inbox').upsert(inbox.map(i => inboxToRow(i, userId)), { onConflict: 'id' })
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
  ])
}

// ── Realtime subscriptions ────────────────────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

export function startRealtime(userId: string): void {
  if (realtimeChannel) return

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
        if (!local || incomingTs >= localTs) {
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
        if (!local || incomingTs >= localTs) await db.goals.put(incoming)
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
        if (!local || incomingTs >= localTs) await db.journal.put(incoming)
      }
    )

    // ── inbox ──────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'inbox', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.inbox.delete((payload.old as { id: string }).id)
          return
        }
        const row = payload.new as Record<string, unknown>
        if (row.deleted_at) { await db.inbox.delete(row.id as string); return }
        const incoming   = rowToInbox(row)
        const local      = await db.inbox.get(incoming.id) as (InboxItem & { updatedAt?: number }) | undefined
        const incomingTs = row.updated_at ? new Date(row.updated_at as string).getTime() : 0
        const localTs    = local?.updatedAt ?? 0
        if (!local || incomingTs >= localTs) await db.inbox.put(incoming)
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
        if (!local || incomingTs >= localTs) await db.shoppingItems.put(incoming)
      }
    )

    .subscribe()
}

export function stopRealtime(): void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}

// ── Outbox size (used by SyncStatusBar for pending indicator) ─────────────────
export async function outboxSize(): Promise<number> {
  return db.outbox.count()
}
