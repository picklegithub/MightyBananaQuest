import Dexie, { type Table } from 'dexie'
import type { Task, Category, Goal, JournalEntry, InboxItem, AppSettings, WeeklyReview } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, EFFORT } from '../constants'
import { SEED_TASKS, SEED_GOALS, SEED_JOURNAL, SEED_INBOX } from './seeds'
import {
  pushTask, pushTaskDelete, pushTasksDelete,
  pushGoal, pushGoalDelete,
  pushJournal,
  pushInbox,
  pushCategory,
  pushSettings,
} from '../lib/sync'

// ── Habit log entry ──────────────────────────────────────────────────────────
export interface HabitLog {
  id: string      // `${taskId}:${dateStr}`
  taskId: string
  date: string    // 'YYYY-MM-DD'
}

export class LifeAdminDB extends Dexie {
  tasks!:         Table<Task>
  categories!:    Table<Category>
  goals!:         Table<Goal>
  journal!:       Table<JournalEntry>
  inbox!:         Table<InboxItem>
  settings!:      Table<AppSettings>
  habitLog!:      Table<HabitLog>
  weeklyReviews!: Table<WeeklyReview>

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
  }
}

export const db = new LifeAdminDB()

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

// ── Helper: complete a task (award XP + update streak + log habit) ──────────
export async function completeTask(taskId: string): Promise<number> {
  const task = await db.tasks.get(taskId)
  if (!task || task.done) return 0
  const gained = EFFORT[task.effort]?.xp ?? 8

  // For recurring tasks, increment per-task streak
  const newStreak = task.recurring ? (task.streak ?? 0) + 1 : task.streak ?? 0
  await db.tasks.update(taskId, { done: true, streak: newStreak, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) pushTask(updated)

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
    const newSettings = await db.settings.get(1)
    if (newSettings) pushSettings(newSettings)
  }
  // Log habit completion for habits (isHabit flag) and recurring tasks
  if (task.isHabit || task.recurring) {
    const today = new Date().toISOString().slice(0, 10)
    await logHabitCompletion(taskId, today)
  }
  return gained
}

// ── Helper: reset recurring tasks that weren't completed today ───────────────
// Call on app start (after auth). Finds recurring/habit tasks that are done=true
// but have no habitLog entry for today — meaning they were completed on a prior
// day and should be reset so the user can complete them again today.
export async function resetRecurringTasks(): Promise<void> {
  const today    = new Date().toISOString().slice(0, 10)
  const recurring = await db.tasks.filter(t => (!!t.recurring || !!t.isHabit) && t.done).toArray()
  if (recurring.length === 0) return

  const resetIds: string[] = []
  for (const task of recurring) {
    const log = await db.habitLog.get(`${task.id}:${today}`)
    if (!log) resetIds.push(task.id)
  }
  if (resetIds.length > 0) {
    const now = Date.now()
    await Promise.all(resetIds.map(id => db.tasks.update(id, { done: false, updatedAt: now })))
    // Sync resets to Supabase in the background
    const updatedTasks = await db.tasks.bulkGet(resetIds)
    updatedTasks.forEach(t => { if (t) pushTask(t) })
  }
}

// ── Helper: log a habit completion ───────────────────────────────────────────
export async function logHabitCompletion(taskId: string, date: string) {
  const id = `${taskId}:${date}`
  await db.habitLog.put({ id, taskId, date })
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
  if (updated) pushTask(updated)
}

// ── Helper: add a task ───────────────────────────────────────────────────────
export async function addTask(task: Task) {
  const now = Date.now()
  const toAdd = { ...task, createdAt: now, updatedAt: now }
  await db.tasks.add(toAdd)
  pushTask(toAdd)
}

// ── Helper: update a task (always stamps updatedAt, syncs to Supabase) ───────
export async function updateTask(taskId: string, patch: Partial<Task>) {
  await db.tasks.update(taskId, { ...patch, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) pushTask(updated)
}

// ── Helper: get settings (always returns something) ──────────────────────────
export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(1)) ?? DEFAULT_SETTINGS
}

// ── Helper: delete a task ─────────────────────────────────────────────────────
export async function deleteTask(taskId: string) {
  await db.tasks.delete(taskId)
  pushTaskDelete(taskId)
}

// ── Helper: delete multiple tasks ────────────────────────────────────────────
export async function deleteTasks(taskIds: string[]) {
  await db.tasks.bulkDelete(taskIds)
  pushTasksDelete(taskIds)
}

// ── Helper: add a goal ────────────────────────────────────────────────────────
export async function addGoal(goal: Goal) {
  await db.goals.add(goal)
  pushGoal(goal)
}

// ── Helper: update a goal ─────────────────────────────────────────────────────
export async function updateGoal(goalId: string, patch: Partial<Goal>) {
  await db.goals.update(goalId, patch)
  const updated = await db.goals.get(goalId)
  if (updated) pushGoal(updated)
}

// ── Helper: delete a goal ─────────────────────────────────────────────────────
export async function deleteGoal(goalId: string) {
  await db.goals.delete(goalId)
  pushGoalDelete(goalId)
}

// ── Helper: add a custom area/category ───────────────────────────────────────
export async function addCategory(cat: Category) {
  await db.categories.add(cat)
  pushCategory(cat)
}

// ── Helper: delete a custom area/category ────────────────────────────────────
export async function deleteCategory(catId: string) {
  await db.categories.delete(catId)
  // Fire-and-forget sync — import lazily to avoid circular dep
  import('../lib/sync').then(({ pushCategoryDelete }) => pushCategoryDelete?.(catId)).catch(() => {})
}

// ── Helper: save a journal entry ─────────────────────────────────────────────
export async function saveJournalEntry(entry: JournalEntry) {
  await db.journal.put(entry)
  pushJournal(entry)
}

// ── Helper: save an inbox item ────────────────────────────────────────────────
export async function saveInboxItem(item: InboxItem) {
  await db.inbox.put(item)
  pushInbox(item)
}

// ── Helper: nuclear reset — wipe everything and re-seed ──────────────────────
export async function resetAllData() {
  await db.transaction('rw', [db.settings, db.categories, db.tasks, db.goals, db.journal, db.inbox, db.habitLog], async () => {
    await db.settings.clear()
    await db.categories.clear()
    await db.tasks.clear()
    await db.goals.clear()
    await db.journal.clear()
    await db.inbox.clear()
    await db.habitLog.clear()
    await db.settings.add(DEFAULT_SETTINGS)
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    await db.tasks.bulkAdd(SEED_TASKS)
    await db.goals.bulkAdd(SEED_GOALS)
    await db.journal.bulkAdd(SEED_JOURNAL)
    await db.inbox.bulkAdd(SEED_INBOX)
  })
  // Push reset state to Supabase
  const { pushAllLocal } = await import('../lib/sync')
  await pushAllLocal()
}
