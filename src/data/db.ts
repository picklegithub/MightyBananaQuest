import Dexie, { type Table } from 'dexie'
import type { Task, Habit, Category, Goal, JournalEntry, InboxItem, AppSettings, WeeklyReview, ShoppingItem, DailyPlan, CopingCard, CopingCategory } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, EFFORT } from '../constants'
import { SEED_TASKS, SEED_GOALS, SEED_JOURNAL, SEED_COPING_CARDS } from './seeds'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'
import { localDateISO } from '../lib/useCurrentDate'

// ── Habit log entry ──────────────────────────────────────────────────────────
export interface HabitLog {
  id: string      // `${taskId}:${dateStr}`
  taskId: string
  date: string    // 'YYYY-MM-DD'
}

// ── Tombstone entry (soft-delete record) ─────────────────────────────────────
export interface DeletedTask {
  id: string
  deletedAt: number
}

// ── Completion tombstone — protects against sync re-opening completed tasks ──
// Written by completeTask(); checked in the pull LWW guard for tasks.
// If a pull arrives with done=false for an id in this table and the server
// timestamp is older than our local completedAt, the pull is skipped.
export interface CompletedTask {
  id: string
  completedAt: number
}

// ── Outbox entry (pending sync operations) ───────────────────────────────────
// key = `${table}:${recordId}` — primary key ensures automatic dedup so rapid
// edits to the same record only produce a single outbox entry.
export interface OutboxEntry {
  key:              string                // `${table}:${recordId}`
  table:            string
  recordId:         string
  op:               'upsert' | 'delete'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?:            any                   // full local record for upsert
  queuedAt:         number
  attempts:         number
  nextRetryAt:      number
  lastError?:       string
  idempotencyKey:   string               // UUID — prevents duplicate server writes on retry
  deadLettered?:    boolean              // true after MAX_OUTBOX_ATTEMPTS — stops retrying
}

export class MightyBananaQuestDB extends Dexie {
  tasks!:          Table<Task>
  habits!:         Table<Habit>
  categories!:     Table<Category>
  goals!:          Table<Goal>
  journal!:        Table<JournalEntry>
  inbox!:          Table<any>
  inboxItems!:     Table<InboxItem>
  settings!:       Table<AppSettings>
  habitLog!:       Table<HabitLog>
  weeklyReviews!:  Table<WeeklyReview>
  deletedTasks!:   Table<DeletedTask>
  completedTasks!: Table<CompletedTask>
  shoppingItems!:  Table<ShoppingItem>
  outbox!:         Table<OutboxEntry>
  dailyPlans!:     Table<DailyPlan>
  copingCards!:    Table<CopingCard>

  constructor() {
    // ── Version history (collapsed pre-launch) ────────────────────────────────
    // v1–v11 accumulated incrementally during development.  Since this app has
    // not yet launched publicly there are no production installs to preserve, so
    // all previous version declarations have been removed and replaced with a
    // single authoritative version(12).
    //
    // Dev/test installs on v1–v10: open DevTools → Application → IndexedDB →
    // delete "MightyBananaQuestDB", then hard-refresh.  v11 installs upgrade
    // automatically via the combined upgrade() below.
    super('MightyBananaQuestDB')

    // ── Version 12 — canonical pre-launch schema ──────────────────────────────
    this.version(12).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt',
      // key = `${table}:${recordId}` — deduplicates rapid edits to same record
      outbox:        'key, table, queuedAt, nextRetryAt',
      // primary key is ISO date string; completedAt index for ritual check
      dailyPlans:    'date, completedAt',
    }).upgrade(async tx => {
      // ── Absorbed from v8: migrate isHabit tasks → habits table ────────────
      // Safe to re-run: tasks with isHabit=true are already absent on v11.
      const habitTasks: Task[] = await tx.table('tasks').filter((t: Task) => !!t.isHabit).toArray()
      if (habitTasks.length > 0) {
        const habits: Habit[] = habitTasks.map(t => ({
          id:        t.id,
          title:     t.title,
          cat:       t.cat,
          frequency: t.recurring ?? 'daily',
          streak:    t.streak ?? 0,
          bestStreak: t.streak ?? 0,
          done:      t.done ?? false,
          notes:     t.notes,
          time:      t.time,
          createdAt: t.createdAt ?? Date.now(),
          updatedAt: t.updatedAt ?? Date.now(),
        }))
        await tx.table('habits').bulkAdd(habits)
        await tx.table('tasks').bulkDelete(habitTasks.map((t: Task) => t.id))
      }

      // ── Absorbed from v11: rename settings.variant → settings.palette ──────
      const s = await tx.table('settings').get(1)
      if (s && s.variant && !s.palette) {
        const palette = s.variant === 'strict' ? 'mono' : 'warm'
        await tx.table('settings').update(1, { palette, variant: undefined })
      }

      // ── Seed bestStreak for existing habits that didn't have it ────────────
      const existingHabits: Habit[] = await tx.table('habits').toArray()
      for (const h of existingHabits) {
        if (h.bestStreak === undefined) {
          await tx.table('habits').update(h.id, { bestStreak: h.streak ?? 0 })
        }
      }
    })

    // ── Version 13 — strength/timeOfDay/isArchived on habits ────────────────
    this.version(13).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status, availableFrom',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
    }).upgrade(async tx => {
      // Seed strength = 0.5 (neutral) for existing habits that don't have it
      const habits: Habit[] = await tx.table('habits').toArray()
      for (const h of habits) {
        if (h.strength === undefined) {
          await tx.table('habits').update(h.id, { strength: 0.5 })
        }
      }
    })

    // ── Version 14 — adds copingCards table ───────────────────────────────────
    this.version(14).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status, availableFrom',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id',
    })

    // ── Version 15 — removes availableFrom index from tasks ──────────────────
    this.version(15).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id',
    })

    // ── Version 16 — copingCards: singleton → deck (id: string, category, isPinned) ──
    this.version(16).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id, category, isPinned',
    }).upgrade(async tx => {
      // Clear the old singleton record (id: 1) — incompatible shape
      await tx.table('copingCards').clear()
      // Seed the full deck
      await tx.table('copingCards').bulkAdd(SEED_COPING_CARDS)
    })

    // ── Version 17 — tasks: add reminderMin + completedAt indexes ─────────────
    this.version(17).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id, category, isPinned',
    })

    // ── Version 18 — add completedTasks tombstone table ───────────────────────
    // Protects completed tasks from being re-opened by a stale server pull that
    // arrives before the outbox drains (done=true hasn't reached the server yet).
    // See: sync.ts tasks puller LWW guard.
    this.version(18).stores({
      tasks:          'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      inbox:          'id, kind, processed',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
    })
    // No upgrade needed — new table starts empty; existing completed tasks will
    // write their tombstone on the next completion or on undo+redo.

    // ── Version 19 — add inboxItems (active capture inbox) ───────────────────
    this.version(19).stores({
      tasks:          'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      inbox:          'id, kind, processed',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
      inboxItems:     'id, status, createdAt, source',
    })
  }
}

export const db = new MightyBananaQuestDB()

// ── Seed on first run ─────────────────────────────────────────────────────────
db.on('ready', async () => {
  const count = await db.settings.count()
  if (count > 0) return  // already seeded

  await db.transaction('rw', [db.settings, db.categories, db.tasks, db.goals, db.journal, db.copingCards], async () => {
    await db.settings.add(DEFAULT_SETTINGS)
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    await db.tasks.bulkAdd(SEED_TASKS)
    await db.goals.bulkAdd(SEED_GOALS)
    await db.journal.bulkAdd(SEED_JOURNAL)
    await db.copingCards.bulkAdd(SEED_COPING_CARDS)
  })
})

// ── Helper: calculate next occurrence date for a recurring rule ───────────────
export function nextOccurrenceISO(currentDue: string, recurring: string): string {
  // Parse the current due date (or today if missing/relative)
  let base: Date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (/^\d{4}-\d{2}-\d{2}$/.test(currentDue)) {
    base = new Date(currentDue + 'T00:00:00')
  } else {
    base = new Date(today)
  }

  const r = recurring.toLowerCase()

  if (r === 'daily') {
    base.setDate(base.getDate() + 1)
  } else if (r === 'weekdays') {
    do { base.setDate(base.getDate() + 1) } while ([0, 6].includes(base.getDay()))
  } else if (r === 'weekends') {
    do { base.setDate(base.getDate() + 1) } while (![0, 6].includes(base.getDay()))
  } else if (r === 'weekly' || r.startsWith('weekly on')) {
    // "Weekly on Mon" → find next occurrence of that day
    const dowMatch = r.match(/weekly on (\w+)/)
    if (dowMatch) {
      const dowNames = ['sun','mon','tue','wed','thu','fri','sat']
      const target = dowNames.indexOf(dowMatch[1].toLowerCase().slice(0, 3))
      if (target >= 0) {
        do { base.setDate(base.getDate() + 1) } while (base.getDay() !== target)
      } else {
        base.setDate(base.getDate() + 7)
      }
    } else {
      base.setDate(base.getDate() + 7)
    }
  } else if (r === 'biweekly') {
    base.setDate(base.getDate() + 14)
  } else if (r === 'monthly') {
    base.setMonth(base.getMonth() + 1)
  } else {
    // "Every N days/weeks/months"
    const m = r.match(/every (\d+) (day|days|week|weeks|month|months)/)
    if (m) {
      const n = parseInt(m[1], 10)
      const unit = m[2]
      if (unit.startsWith('day'))   base.setDate(base.getDate() + n)
      else if (unit.startsWith('week'))  base.setDate(base.getDate() + n * 7)
      else if (unit.startsWith('month')) base.setMonth(base.getMonth() + n)
    } else {
      // Fallback: +1 day
      base.setDate(base.getDate() + 1)
    }
  }

  const y = base.getFullYear()
  const mo = String(base.getMonth() + 1).padStart(2, '0')
  const d  = String(base.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

// ── Helper: record daily activity and maintain global streak ─────────────────
// Call from completeTask, completeHabit, saveJournalEntry — any meaningful action.
// Increments settings.streak when called on a new calendar day, resets to 1 if
// a day was skipped. Idempotent — multiple calls on the same day are safe.
export async function recordDailyActivity(): Promise<void> {
  const today    = localDateISO()
  const settings = await db.settings.get(1)
  if (!settings) return
  const last = settings.lastActiveDate ?? null
  if (last === today) return  // already recorded today — no-op

  let newStreak: number
  if (last === null) {
    newStreak = 1  // first-ever activity
  } else {
    // Check if yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayISO = localDateISO(yesterday)
    newStreak = last === yesterdayISO ? (settings.streak ?? 0) + 1 : 1
  }

  await db.settings.update(1, { streak: newStreak, lastActiveDate: today })
  const updated = await db.settings.get(1)
  if (updated) enqueueUpsert('settings', String(updated.id), updated)
}

// ── Helper: complete a task (award XP + update streak + log habit) ──────────
// Returns { xp, nextDue } where nextDue is the ISO next-occurrence date for
// recurring tasks (used by the UI to show "✓ Next: Thursday" feedback), or
// null for one-off tasks.
export async function completeTask(taskId: string): Promise<{ xp: number; nextDue: string | null }> {
  const task = await db.tasks.get(taskId)
  if (!task || task.done) return { xp: 0, nextDue: null }
  // 3-tier XP: s/xs → 5, m → 15, l/xl/xxl → 40
  const gained = EFFORT[task.effort]?.xp ?? 15

  // For recurring tasks, increment per-task streak
  const newStreak = task.recurring ? (task.streak ?? 0) + 1 : task.streak ?? 0
  const completedAt = Date.now()

  // Atomic read-modify-write: task + XP inside one IDB transaction to prevent
  // double-award on rapid taps or concurrent completions from two sources.
  let updatedTask: Task | undefined
  let updatedSettings: AppSettings | undefined
  await db.transaction('rw', [db.tasks, db.settings, db.completedTasks], async () => {
    await db.tasks.update(taskId, { done: true, streak: newStreak, completedAt, updatedAt: completedAt })
    updatedTask = (await db.tasks.get(taskId)) ?? undefined
    await db.completedTasks.put({ id: taskId, completedAt })
    const settings = await db.settings.get(1)
    if (settings) {
      await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
      updatedSettings = (await db.settings.get(1)) ?? undefined
    }
  })
  if (updatedTask) enqueueUpsert('tasks', updatedTask.id, updatedTask)
  if (updatedSettings) enqueueUpsert('settings', String(updatedSettings.id), updatedSettings)

  // Log completion for recurring tasks (habits now live in their own table)
  if (task.recurring) {
    const today = localDateISO()
    await logHabitCompletion(taskId, today)
  }

  // For recurring tasks: create a fresh copy with the next occurrence date
  let nextDue: string | null = null
  if (task.recurring) {
    nextDue = nextOccurrenceISO(task.due, task.recurring)
    const copy: Task = {
      ...task,
      id: crypto.randomUUID(),
      done: false,
      streak: newStreak,
      due: nextDue,
      sub: task.sub.map(s => ({ ...s, done: false })),
      updatedAt: Date.now(),
    }
    await db.tasks.add(copy)
    enqueueUpsert('tasks', copy.id, copy)
  }

  await recordDailyActivity()
  return { xp: gained, nextDue }
}

// ── Helper: undo a task completion (reverse XP, reset done, decrement streak) ─
export async function uncompleteTask(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task || !task.done) return

  const gained = EFFORT[task.effort]?.xp ?? 15
  const newStreak = task.recurring ? Math.max(0, (task.streak ?? 0) - 1) : task.streak ?? 0
  await db.tasks.update(taskId, { done: false, streak: newStreak, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)
  // Remove completion tombstone so the pull guard doesn't block future syncs
  await db.completedTasks.delete(taskId)

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: Math.max(0, (settings.xp ?? 0) - gained) })
  }

  if (task.recurring) {
    const today = localDateISO()
    await db.habitLog.delete(`${taskId}:${today}`)
  }
}

// ── Helper: reset recurring tasks that weren't completed today ───────────────
// Call on app start (after auth). Finds recurring/habit tasks that are done=true
// but have no habitLog entry for today — meaning they were completed on a prior
// day and should be reset so the user can complete them again today.
export async function resetRecurringTasks(): Promise<void> {
  const today    = localDateISO()
  const recurring = await db.tasks.filter(t => !!t.recurring && t.done).toArray()
  if (recurring.length === 0) return

  const resetIds: string[] = []
  for (const task of recurring) {
    const log = await db.habitLog.get(`${task.id}:${today}`)
    if (!log) resetIds.push(task.id)
  }
  if (resetIds.length > 0) {
    // Keep original updatedAt so remote completions (with newer stamps) can win on next pull
    await Promise.all(resetIds.map(id => {
      const task = recurring.find(t => t.id === id)
      return db.tasks.update(id, { done: false, updatedAt: task?.updatedAt ?? Date.now() })
    }))
    // Queue resets to outbox
    const updatedTasks = await db.tasks.bulkGet(resetIds)
    updatedTasks.forEach(t => { if (t) enqueueUpsert('tasks', t.id, t) })
  }
}

// ── Helper: log a habit completion ───────────────────────────────────────────
export async function logHabitCompletion(taskId: string, date: string) {
  const id = `${taskId}:${date}`
  const entry = { id, taskId, date }
  await db.habitLog.put(entry)
  enqueueUpsert('habit_log', id, entry)
}

// ── Habit CRUD ────────────────────────────────────────────────────────────────

export async function addHabit(habit: Omit<Habit, 'createdAt' | 'updatedAt'>): Promise<Habit> {
  const now = Date.now()
  const full: Habit = { ...habit, createdAt: now, updatedAt: now }
  await db.habits.add(full)
  enqueueUpsert('habits', full.id, full)
  return full
}

export async function updateHabit(habitId: string, patch: Partial<Habit>) {
  await db.habits.update(habitId, { ...patch, updatedAt: Date.now() })
  const updated = await db.habits.get(habitId)
  if (updated) enqueueUpsert('habits', updated.id, updated)
}

export async function deleteHabit(habitId: string) {
  await db.habits.delete(habitId)
  enqueueDelete('habits', habitId)
  // Clean up log entries for this habit
  const logs = await db.habitLog.where('taskId').equals(habitId).toArray()
  if (logs.length > 0) await db.habitLog.bulkDelete(logs.map(l => l.id))
}

// ── Helper: complete a habit (award XP, update streak, log) ──────────────────
export async function completeHabit(habitId: string): Promise<number> {
  const habit = await db.habits.get(habitId)
  if (!habit || habit.done) return 0
  const gained     = 3   // flat XP per habit check-in
  const newStreak  = (habit.streak ?? 0) + 1
  const newBest    = Math.max(habit.bestStreak ?? 0, newStreak)
  // EMA strength: S = prev * 0.9 + 1.0 * 0.1 (completion = 1)
  const newStrength = Math.min(1.0, parseFloat(((habit.strength ?? 0.5) * 0.9 + 0.1).toFixed(4)))
  await db.habits.update(habitId, { done: true, streak: newStreak, bestStreak: newBest, strength: newStrength, updatedAt: Date.now() })
  const updatedHabit = await db.habits.get(habitId)
  if (updatedHabit) enqueueUpsert('habits', updatedHabit.id, updatedHabit)

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
    const newSettings = await db.settings.get(1)
    if (newSettings) enqueueUpsert('settings', String(newSettings.id), newSettings)
  }

  const today = localDateISO()
  const logEntry = { id: `${habitId}:${today}`, taskId: habitId, date: today }
  await db.habitLog.put(logEntry)
  enqueueUpsert('habit_log', logEntry.id, logEntry)
  await recordDailyActivity()
  return gained
}

// ── Helper: reset habits that weren't completed today ─────────────────────────
// Call alongside resetRecurringTasks on app start.
export async function resetHabits(): Promise<void> {
  const today     = localDateISO()
  const doneHabits = await db.habits.filter(h => h.done).toArray()
  const toReset: string[] = []
  for (const habit of doneHabits) {
    const log = await db.habitLog.get(`${habit.id}:${today}`)
    if (!log) toReset.push(habit.id)
  }
  if (toReset.length > 0) {
    // Reset streak to 0 for missed habits — bestStreak is intentionally preserved
    // EMA decay: S = prev * 0.9 + 0.0 * 0.1 (miss = 0)
    await Promise.all(toReset.map(id => {
      const habit = doneHabits.find(h => h.id === id)
      const decayedStrength = parseFloat(((habit?.strength ?? 0.5) * 0.9).toFixed(4))
      return db.habits.update(id, { done: false, streak: 0, strength: decayedStrength, updatedAt: Date.now() })
    }))
  }
}

// ── Helper: count active tasks (for Slow Productivity cap) ───────────────────
export async function countActiveTasks(): Promise<number> {
  return db.tasks.where('status').equals('active').count()
}

// ── Helper: toggle a subtask ─────────────────────────────────────────────────
export async function toggleSubTask(taskId: string, index: number) {
  const task = await db.tasks.get(taskId)
  if (!task) return
  const sub = task.sub.map((s, i) => i === index ? { ...s, d: !s.d } : s)
  await db.tasks.update(taskId, { sub, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)
}

// ── Helper: add a task ───────────────────────────────────────────────────────
export async function addTask(task: Task) {
  const now = Date.now()
  const toAdd = { ...task, createdAt: now, updatedAt: now }
  await db.tasks.add(toAdd)
  enqueueUpsert('tasks', toAdd.id, toAdd)
}

// ── Helper: update a task (always stamps updatedAt, syncs to Supabase) ───────
export async function updateTask(taskId: string, patch: Partial<Task>) {
  await db.tasks.update(taskId, { ...patch, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)
}

// ── Helper: get settings (always returns something) ──────────────────────────
export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(1)) ?? DEFAULT_SETTINGS
}

// ── Helper: delete a task ─────────────────────────────────────────────────────
export async function deleteTask(taskId: string) {
  // Snapshot the record BEFORE deletion so the outbox can send the full row
  // with deleted_at — not just {id, user_id, deleted_at} — to the server.
  // This preserves all field values on other devices' next pull.
  const snapshot = await db.tasks.get(taskId)
  await db.deletedTasks.put({ id: taskId, deletedAt: Date.now() })
  await db.completedTasks.delete(taskId)  // clean up any completion tombstone
  await db.tasks.delete(taskId)
  enqueueDelete('tasks', taskId, snapshot ?? undefined)
}

// ── Helper: delete multiple tasks ────────────────────────────────────────────
export async function deleteTasks(taskIds: string[]) {
  const now = Date.now()
  const snapshots = await db.tasks.bulkGet(taskIds)
  await db.deletedTasks.bulkPut(taskIds.map(id => ({ id, deletedAt: now })))
  await db.completedTasks.bulkDelete(taskIds)
  await db.tasks.bulkDelete(taskIds)
  taskIds.forEach((id, i) => enqueueDelete('tasks', id, snapshots[i] ?? undefined))
}

// ── Helper: get all tombstoned task IDs ──────────────────────────────────────
export async function getTombstoneIds(): Promise<Set<string>> {
  const tombstones = await db.deletedTasks.toArray()
  return new Set(tombstones.map(t => t.id))
}

// ── Helper: add a goal ────────────────────────────────────────────────────────
export async function addGoal(goal: Goal) {
  await db.goals.add(goal)
  enqueueUpsert('goals', goal.id, goal)
}

// ── Helper: update a goal ─────────────────────────────────────────────────────
export async function updateGoal(goalId: string, patch: Partial<Goal>) {
  await db.goals.update(goalId, patch)
  const updated = await db.goals.get(goalId)
  if (updated) enqueueUpsert('goals', updated.id, updated)
}

// ── Helper: delete a goal ─────────────────────────────────────────────────────
export async function deleteGoal(goalId: string) {
  await db.goals.delete(goalId)
  enqueueDelete('goals', goalId)
}

// ── Helper: add a custom area/category ───────────────────────────────────────
export async function addCategory(cat: Category) {
  await db.categories.add(cat)
  enqueueUpsert('categories', cat.id, cat)
}

// ── Helper: update an area/category (rename, icon, hue) ──────────────────────
export async function updateCategory(catId: string, patch: Partial<Category>) {
  await db.categories.update(catId, patch)
  const updated = await db.categories.get(catId)
  if (updated) enqueueUpsert('categories', updated.id, updated)
}

// ── Helper: delete a custom area/category ────────────────────────────────────
export async function deleteCategory(catId: string) {
  await db.categories.delete(catId)
  enqueueDelete('categories', catId)
}

// ── Helper: save a journal entry ─────────────────────────────────────────────
export async function saveJournalEntry(entry: JournalEntry) {
  const existing = await db.journal.get(entry.id)
  let toSave = entry

  // Award +5 XP once per entry when it first has substantive content
  if (!existing?.xpAwarded) {
    const hasContent = entry.kind === 'morning'
      ? !!(entry.intention?.trim() || entry.priorities?.some(p => p?.trim()))
      : !!(entry.win?.trim() || entry.diff?.trim())
    if (hasContent) {
      const settings = await db.settings.get(1)
      if (settings) {
        await db.settings.update(1, { xp: (settings.xp ?? 0) + 5 })
        const updated = await db.settings.get(1)
        if (updated) enqueueUpsert('settings', String(updated.id), updated)
      }
      toSave = { ...entry, xpAwarded: true }
    }
  } else {
    toSave = { ...entry, xpAwarded: true }
  }

  await db.journal.put(toSave)
  enqueueUpsert('journal', toSave.id, toSave)
  await recordDailyActivity()
}

// ── Helper: delete a single journal entry ─────────────────────────────────────
export async function deleteJournalEntry(entryId: string) {
  await db.journal.delete(entryId)
  enqueueDelete('journal', entryId)
}

// ── Active inbox helpers ──────────────────────────────────────────────────────
export async function createInboxItem(
  partial: Pick<InboxItem, 'text' | 'source'> & { sourceMeta?: InboxItem['sourceMeta'] }
): Promise<InboxItem> {
  const now = Date.now()
  const item: InboxItem = {
    id: crypto.randomUUID(),
    text: partial.text,
    source: partial.source,
    sourceMeta: partial.sourceMeta,
    createdAt: now,
    updatedAt: now,
    status: 'inbox',
  }
  await db.inboxItems.add(item)
  enqueueUpsert('inbox_items', item.id, item)
  return item
}

export async function countInbox(): Promise<number> {
  return db.inboxItems.where('status').equals('inbox').count()
}

export async function processInboxItem(
  id: string,
  status: 'converted' | 'someday' | 'archived',
  convertedTaskId?: string
): Promise<void> {
  const now = Date.now()
  const patch: Partial<InboxItem> = { status, processedAt: now, updatedAt: now }
  if (convertedTaskId) patch.convertedTaskId = convertedTaskId
  await db.inboxItems.update(id, patch)
  const updated = await db.inboxItems.get(id)
  if (updated) enqueueUpsert('inbox_items', id, updated)
}

export async function revertInboxItem(id: string, status: 'inbox'): Promise<void> {
  const now = Date.now()
  await db.inboxItems.update(id, { status, updatedAt: now })
  // Dexie update() ignores undefined — use modify() to actually remove the fields
  await db.inboxItems.where('id').equals(id).modify(item => {
    delete item.processedAt
    delete item.convertedTaskId
  })
  const updated = await db.inboxItems.get(id)
  if (updated) enqueueUpsert('inbox_items', id, updated)
}

// ── Shopping list helpers ─────────────────────────────────────────────────────
export async function addShoppingItem(item: Omit<ShoppingItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShoppingItem> {
  const now = Date.now()
  const full: ShoppingItem = { ...item, id: `s${now}`, createdAt: now, updatedAt: now }
  await db.shoppingItems.add(full)
  enqueueUpsert('shopping_items', full.id, full)
  return full
}

export async function updateShoppingItem(id: string, patch: Partial<ShoppingItem>) {
  const updatedAt = Date.now()
  await db.shoppingItems.update(id, { ...patch, updatedAt })
  const updated = await db.shoppingItems.get(id)
  if (updated) enqueueUpsert('shopping_items', updated.id, updated)
}

export async function deleteShoppingItem(id: string) {
  await db.shoppingItems.delete(id)
  enqueueDelete('shopping_items', id)
}

export async function deleteCheckedShoppingItems() {
  const checked = await db.shoppingItems.filter(i => i.checked).primaryKeys()
  await db.shoppingItems.bulkDelete(checked)
  ;(checked as string[]).forEach(id => enqueueDelete('shopping_items', id))
}

// ── Daily Plan helpers ────────────────────────────────────────────────────────

/** Returns today's ISO date string, e.g. '2026-04-27'. */
export function todayISO(): string {
  return localDateISO()
}

/**
 * Fetch the DailyPlan row for today, or null if the ritual hasn't been started.
 * Use `plan.completedAt !== null` to check whether it's fully done.
 */
export async function getTodayPlan(): Promise<DailyPlan | null> {
  return (await db.dailyPlans.get(todayISO())) ?? null
}

/**
 * Persist (create or overwrite) the plan row for today.
 * Pass a partial update — the helper merges it with the existing row if one exists.
 */
export async function saveDailyPlan(patch: Partial<Omit<DailyPlan, 'date'>>): Promise<void> {
  const date     = todayISO()
  const existing = await db.dailyPlans.get(date)
  const next: DailyPlan = {
    date,
    pickedIds:    [],
    top3Ids:      [],
    reckonings:   [],
    calBudgetMin: 0,
    completedAt:  null,
    ...existing,
    ...patch,
  }
  await db.dailyPlans.put(next)
  enqueueUpsert('daily_plans', next.date, next)
}

/**
 * Returns true if today's ritual has been completed (i.e. "Start the day" was tapped).
 * Safe to call on every app open — returns false when no row exists yet.
 */
export async function isTodayPlanComplete(): Promise<boolean> {
  const plan = await getTodayPlan()
  return plan !== null && plan.completedAt !== null
}

// ── Helper: wipe streak history — habits kept, streaks + logs reset ──────────
export async function wipeStreaks(): Promise<void> {
  await db.transaction('rw', [db.habits, db.habitLog, db.settings], async () => {
    const habits = await db.habits.toArray()
    await Promise.all(habits.map(h =>
      db.habits.update(h.id, { streak: 0, bestStreak: 0, updatedAt: Date.now() })
    ))
    await db.habitLog.clear()
    const s = await db.settings.get(1)
    if (s) await db.settings.update(1, { streak: 0 })
  })
}

// ── Helper: wipe tasks only ───────────────────────────────────────────────────
export async function wipeTasks(): Promise<void> {
  await db.transaction('rw', [db.tasks, db.deletedTasks, db.completedTasks, db.dailyPlans, db.outbox], async () => {
    await db.tasks.clear()
    await db.deletedTasks.clear()
    await db.completedTasks.clear()
    await db.dailyPlans.clear()
    const keys = await db.outbox.where('table').anyOf(['tasks', 'daily_plans']).primaryKeys()
    await db.outbox.bulkDelete(keys as string[])
  })
}

// ── Helper: wipe goals only ───────────────────────────────────────────────────
export async function wipeGoals(): Promise<void> {
  await db.transaction('rw', [db.goals, db.outbox], async () => {
    await db.goals.clear()
    const keys = await db.outbox.where('table').equals('goals').primaryKeys()
    await db.outbox.bulkDelete(keys as string[])
  })
}

// ── Helper: wipe everything — no re-seed, clears watermarks ──────────────────
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', [
    db.settings, db.categories, db.tasks, db.habits, db.goals,
    db.journal, db.habitLog, db.deletedTasks, db.completedTasks, db.outbox,
    db.dailyPlans, db.weeklyReviews, db.shoppingItems, db.copingCards, db.inboxItems,
  ], async () => {
    await db.settings.clear()
    await db.categories.clear()
    await db.tasks.clear()
    await db.habits.clear()
    await db.goals.clear()
    await db.journal.clear()
    await db.inboxItems.clear()
    await db.habitLog.clear()
    await db.deletedTasks.clear()
    await db.completedTasks.clear()
    await db.outbox.clear()
    await db.dailyPlans.clear()
    await db.weeklyReviews.clear()
    await db.shoppingItems.clear()
    await db.copingCards.clear()
  })
  try { localStorage.removeItem('mbq_last_pull_at') } catch {}
  try { localStorage.removeItem('mbq_last_server_seq') } catch {}
}

// ── Coping card helpers ───────────────────────────────────────────────────────
export async function getAllCopingCards(category?: CopingCategory): Promise<CopingCard[]> {
  if (category) return db.copingCards.where('category').equals(category).toArray()
  return db.copingCards.toArray()
}

export async function getPinnedCard(): Promise<CopingCard | null> {
  const pinned = await db.copingCards.where('isPinned').equals(1).first()
  return pinned ?? null
}

export async function addCopingCard(card: Omit<CopingCard, 'createdAt' | 'updatedAt'>): Promise<void> {
  const now = Date.now()
  const full = { ...card, createdAt: now, updatedAt: now }
  await db.copingCards.add(full)
  if (!card.isDefault) enqueueUpsert('coping_cards', card.id, full)
}

export async function updateCopingCard(id: string, patch: Partial<CopingCard>): Promise<void> {
  const now = Date.now()
  await db.copingCards.update(id, { ...patch, updatedAt: now })
  const updated = await db.copingCards.get(id)
  if (updated && !updated.isDefault) enqueueUpsert('coping_cards', id, updated)
}

export async function deleteCopingCard(id: string): Promise<void> {
  const card = await db.copingCards.get(id)
  await db.copingCards.delete(id)
  if (card && !card.isDefault) enqueueDelete('coping_cards', id)
}

export async function pinCopingCard(id: string): Promise<void> {
  const now = Date.now()
  const allPinned = await db.copingCards.where('isPinned').equals(1).toArray()
  await Promise.all(allPinned.map(c => db.copingCards.update(c.id, { isPinned: false, updatedAt: now })))
  await db.copingCards.update(id, { isPinned: true, updatedAt: now })
  // Sync the pin change for user-created cards
  for (const c of allPinned) {
    const updated = await db.copingCards.get(c.id)
    if (updated && !updated.isDefault) enqueueUpsert('coping_cards', c.id, updated)
  }
  const pinned = await db.copingCards.get(id)
  if (pinned && !pinned.isDefault) enqueueUpsert('coping_cards', id, pinned)
}

// ── Helper: clear local state and prepare for a full server re-pull ──────────
// Clears all tables + watermarks, then adds a minimal settings placeholder
// so the db.on('ready') seed guard doesn't re-populate with demo data.
export async function resetLocalForResync(): Promise<void> {
  await wipeAllData()
  // Add a placeholder settings row so the seed guard (count > 0) stays true
  await db.settings.add({ ...DEFAULT_SETTINGS })
}

