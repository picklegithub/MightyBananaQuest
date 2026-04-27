import Dexie, { type Table } from 'dexie'
import type { Task, Habit, Category, Goal, JournalEntry, InboxItem, AppSettings, WeeklyReview, ShoppingItem } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, EFFORT } from '../constants'
import { SEED_TASKS, SEED_GOALS, SEED_JOURNAL, SEED_INBOX } from './seeds'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'

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

// ── Outbox entry (pending sync operations) ───────────────────────────────────
// key = `${table}:${recordId}` — primary key ensures automatic dedup so rapid
// edits to the same record only produce a single outbox entry.
export interface OutboxEntry {
  key:          string                // `${table}:${recordId}`
  table:        string
  recordId:     string
  op:           'upsert' | 'delete'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?:        any                   // full local record for upsert
  queuedAt:     number
  attempts:     number
  nextRetryAt:  number
  lastError?:   string
}

export class MightyBananaQuestDB extends Dexie {
  tasks!:          Table<Task>
  habits!:         Table<Habit>
  categories!:     Table<Category>
  goals!:          Table<Goal>
  journal!:        Table<JournalEntry>
  inbox!:          Table<InboxItem>
  settings!:       Table<AppSettings>
  habitLog!:       Table<HabitLog>
  weeklyReviews!:  Table<WeeklyReview>
  deletedTasks!:   Table<DeletedTask>
  shoppingItems!:  Table<ShoppingItem>
  outbox!:         Table<OutboxEntry>

  constructor() {
    super('LifeAdminDB')
    this.version(1).stores({
      tasks:      'id, cat, due, done, effort, quad, createdAt',
      categories: 'id',
      goals:      'id, area',
      journal:    'id, date, kind',
      inbox:      'id, kind, processed',
      settings:   'id',
    })
    // Version 2 adds habit completion log for heatmap
    this.version(2).stores({
      tasks:      'id, cat, due, done, effort, quad, createdAt',
      categories: 'id',
      goals:      'id, area',
      journal:    'id, date, kind',
      inbox:      'id, kind, processed',
      settings:   'id',
      habitLog:   'id, taskId, date',
    })
    // Version 3 adds weekly review records
    this.version(3).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
    })
    // Version 4 adds isHabit index for first-class habit support
    this.version(4).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, isHabit',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
    })
    // Version 5 adds status index for Slow Productivity active-task cap
    this.version(5).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, isHabit, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
    })
    // Version 6 adds tombstone table for soft-delete / sync integrity
    this.version(6).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, isHabit, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
    })
    // Version 7 adds shopping list — separate store, no FK to tasks
    this.version(7).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, isHabit, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
    })
    // Version 8 — first-class habits table: migrate isHabit tasks → habits
    this.version(8).stores({
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
    }).upgrade(async tx => {
      // Move every task flagged as a habit into the new habits table
      const habitTasks: Task[] = await tx.table('tasks').filter((t: Task) => !!t.isHabit).toArray()
      if (habitTasks.length > 0) {
        const habits: Habit[] = habitTasks.map(t => ({
          id:        t.id,
          title:     t.title,
          cat:       t.cat,
          frequency: t.recurring ?? 'daily',
          streak:    t.streak ?? 0,
          done:      t.done ?? false,
          notes:     t.notes,
          time:      t.time,
          createdAt: t.createdAt ?? Date.now(),
          updatedAt: t.updatedAt ?? Date.now(),
        }))
        await tx.table('habits').bulkAdd(habits)
        await tx.table('tasks').bulkDelete(habitTasks.map(t => t.id))
      }
    })
    // Version 9 — outbox table for reliable, deduplicated async sync
    this.version(9).stores({
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
      // key = `${table}:${recordId}` so the same record only has one pending entry
      outbox:        'key, table, queuedAt, nextRetryAt',
    })
  }
}

export const db = new MightyBananaQuestDB()

// ── Seed on first run ─────────────────────────────────────────────────────────
db.on('ready', async () => {
  const count = await db.settings.count()
  if (count > 0) return  // already seeded

  await db.transaction('rw', [db.settings, db.categories, db.tasks, db.goals, db.journal, db.inbox], async () => {
    await db.settings.add(DEFAULT_SETTINGS)
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    await db.tasks.bulkAdd(SEED_TASKS)
    await db.goals.bulkAdd(SEED_GOALS)
    await db.journal.bulkAdd(SEED_JOURNAL)
    await db.inbox.bulkAdd(SEED_INBOX)
  })
})

// ── Helper: calculate next occurrence date for a recurring rule ───────────────
function nextOccurrenceISO(currentDue: string, recurring: string): string {
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

// ── Helper: complete a task (award XP + update streak + log habit) ──────────
export async function completeTask(taskId: string): Promise<number> {
  const task = await db.tasks.get(taskId)
  if (!task || task.done) return 0
  const gained = EFFORT[task.effort]?.xp ?? 8

  // For recurring tasks, increment per-task streak
  const newStreak = task.recurring ? (task.streak ?? 0) + 1 : task.streak ?? 0
  await db.tasks.update(taskId, { done: true, streak: newStreak, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
    const newSettings = await db.settings.get(1)
    if (newSettings) enqueueUpsert('settings', String(newSettings.id), newSettings)
  }

  // Log completion for recurring tasks (habits now live in their own table)
  if (task.recurring) {
    const today = new Date().toISOString().slice(0, 10)
    await logHabitCompletion(taskId, today)
  }

  // For recurring tasks: create a fresh copy with the next occurrence date
  if (task.recurring) {
    const nextDue = nextOccurrenceISO(task.due, task.recurring)
    const copy: Task = {
      ...task,
      id: `t${Date.now()}`,
      done: false,
      streak: newStreak,
      due: nextDue,
      sub: task.sub.map(s => ({ ...s, done: false })),
      updatedAt: Date.now(),
    }
    await db.tasks.add(copy)
    enqueueUpsert('tasks', copy.id, copy)
  }

  return gained
}

// ── Helper: reset recurring tasks that weren't completed today ───────────────
// Call on app start (after auth). Finds recurring/habit tasks that are done=true
// but have no habitLog entry for today — meaning they were completed on a prior
// day and should be reset so the user can complete them again today.
export async function resetRecurringTasks(): Promise<void> {
  const today    = new Date().toISOString().slice(0, 10)
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
  await db.habitLog.put({ id, taskId, date })
}

// ── Habit CRUD ────────────────────────────────────────────────────────────────

export async function addHabit(habit: Omit<Habit, 'createdAt' | 'updatedAt'>): Promise<Habit> {
  const now = Date.now()
  const full: Habit = { ...habit, createdAt: now, updatedAt: now }
  await db.habits.add(full)
  return full
}

export async function updateHabit(habitId: string, patch: Partial<Habit>) {
  await db.habits.update(habitId, { ...patch, updatedAt: Date.now() })
}

export async function deleteHabit(habitId: string) {
  await db.habits.delete(habitId)
  // Clean up log entries for this habit
  const logs = await db.habitLog.where('taskId').equals(habitId).toArray()
  if (logs.length > 0) await db.habitLog.bulkDelete(logs.map(l => l.id))
}

// ── Helper: complete a habit (award XP, update streak, log) ──────────────────
export async function completeHabit(habitId: string): Promise<number> {
  const habit = await db.habits.get(habitId)
  if (!habit || habit.done) return 0
  const gained  = 8   // flat XP per habit check-in
  const newStreak = (habit.streak ?? 0) + 1
  await db.habits.update(habitId, { done: true, streak: newStreak, updatedAt: Date.now() })

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
    const newSettings = await db.settings.get(1)
    if (newSettings) enqueueUpsert('settings', String(newSettings.id), newSettings)
  }

  const today = new Date().toISOString().slice(0, 10)
  await db.habitLog.put({ id: `${habitId}:${today}`, taskId: habitId, date: today })
  return gained
}

// ── Helper: reset habits that weren't completed today ─────────────────────────
// Call alongside resetRecurringTasks on app start.
export async function resetHabits(): Promise<void> {
  const today     = new Date().toISOString().slice(0, 10)
  const doneHabits = await db.habits.filter(h => h.done).toArray()
  const toReset: string[] = []
  for (const habit of doneHabits) {
    const log = await db.habitLog.get(`${habit.id}:${today}`)
    if (!log) toReset.push(habit.id)
  }
  if (toReset.length > 0) {
    await Promise.all(toReset.map(id => db.habits.update(id, { done: false, updatedAt: Date.now() })))
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
  await db.deletedTasks.put({ id: taskId, deletedAt: Date.now() })
  await db.tasks.delete(taskId)
  enqueueDelete('tasks', taskId)
}

// ── Helper: delete multiple tasks ────────────────────────────────────────────
export async function deleteTasks(taskIds: string[]) {
  const now = Date.now()
  await db.deletedTasks.bulkPut(taskIds.map(id => ({ id, deletedAt: now })))
  await db.tasks.bulkDelete(taskIds)
  taskIds.forEach(id => enqueueDelete('tasks', id))
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
  await db.journal.put(entry)
  enqueueUpsert('journal', entry.id, entry)
}

// ── Helper: save an inbox item ────────────────────────────────────────────────
export async function saveInboxItem(item: InboxItem) {
  await db.inbox.put(item)
  enqueueUpsert('inbox', item.id, item)
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

// ── Helper: nuclear reset — wipe everything and re-seed ──────────────────────
export async function resetAllData() {
  await db.transaction('rw', [db.settings, db.categories, db.tasks, db.habits, db.goals, db.journal, db.inbox, db.habitLog, db.deletedTasks, db.outbox], async () => {
    await db.settings.clear()
    await db.categories.clear()
    await db.tasks.clear()
    await db.habits.clear()
    await db.goals.clear()
    await db.journal.clear()
    await db.inbox.clear()
    await db.habitLog.clear()
    await db.deletedTasks.clear()
    await db.outbox.clear()
    await db.settings.add(DEFAULT_SETTINGS)
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    await db.tasks.bulkAdd(SEED_TASKS)
    await db.goals.bulkAdd(SEED_GOALS)
    await db.journal.bulkAdd(SEED_JOURNAL)
    await db.inbox.bulkAdd(SEED_INBOX)
  })
  // Push reset state to Supabase (full push after nuclear reset)
  const { pushAllLocal } = await import('../lib/sync')
  await pushAllLocal()
}
