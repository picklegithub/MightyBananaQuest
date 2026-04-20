import Dexie, { type Table } from 'dexie'
import type { Task, Category, Goal, JournalEntry, InboxItem, AppSettings } from '../types'
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

export class LifeAdminDB extends Dexie {
  tasks!:      Table<Task>
  categories!: Table<Category>
  goals!:      Table<Goal>
  journal!:    Table<JournalEntry>
  inbox!:      Table<InboxItem>
  settings!:   Table<AppSettings>

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

// ── Helper: complete a task (award XP + update streak) ──────────────────────
export async function completeTask(taskId: string): Promise<number> {
  const task = await db.tasks.get(taskId)
  if (!task || task.done) return 0
  const gained = EFFORT[task.effort]?.xp ?? 8
  await db.tasks.update(taskId, { done: true })
  const updated = await db.tasks.get(taskId)
  if (updated) pushTask(updated)
  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
    const newSettings = await db.settings.get(1)
    if (newSettings) pushSettings(newSettings)
  }
  return gained
}

// ── Helper: toggle a subtask ─────────────────────────────────────────────────
export async function toggleSubTask(taskId: string, index: number) {
  const task = await db.tasks.get(taskId)
  if (!task) return
  const sub = task.sub.map((s, i) => i === index ? { ...s, d: !s.d } : s)
  await db.tasks.update(taskId, { sub })
  const updated = await db.tasks.get(taskId)
  if (updated) pushTask(updated)
}

// ── Helper: add a task ───────────────────────────────────────────────────────
export async function addTask(task: Task) {
  const toAdd = { ...task, createdAt: Date.now() }
  await db.tasks.add(toAdd)
  pushTask(toAdd)
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
  await db.transaction('rw', [db.settings, db.categories, db.tasks, db.goals, db.journal, db.inbox], async () => {
    await db.settings.clear()
    await db.categories.clear()
    await db.tasks.clear()
    await db.goals.clear()
    await db.journal.clear()
    await db.inbox.clear()
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
