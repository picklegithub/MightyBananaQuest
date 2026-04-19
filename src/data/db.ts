import Dexie, { type Table } from 'dexie'
import type { Task, Category, Goal, JournalEntry, InboxItem, AppSettings } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, EFFORT } from '../constants'
import { SEED_TASKS, SEED_GOALS, SEED_JOURNAL, SEED_INBOX } from './seeds'

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
  const settings = await db.settings.get(1)
  if (settings) await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
  return gained
}

// ── Helper: toggle a subtask ─────────────────────────────────────────────────
export async function toggleSubTask(taskId: string, index: number) {
  const task = await db.tasks.get(taskId)
  if (!task) return
  const sub = task.sub.map((s, i) => i === index ? { ...s, d: !s.d } : s)
  await db.tasks.update(taskId, { sub })
}

// ── Helper: add a task ───────────────────────────────────────────────────────
export async function addTask(task: Task) {
  await db.tasks.add({ ...task, createdAt: Date.now() })
}

// ── Helper: get settings (always returns something) ──────────────────────────
export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(1)) ?? DEFAULT_SETTINGS
}
