/**
 * tasks.ts — Task domain: CRUD, completion, recurring reset, subtasks.
 */

import type { Task } from '../types'
import { EFFORT } from '../constants'
import { makeId } from '../lib/makeId'
import { localDateISO } from '../lib/useCurrentDate'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'
import { pushTombstoneToServer } from '../lib/sync'
import { db } from './schema'
import { logHabitCompletion, removeHabitLog } from './habitLog'
import { recordDailyActivity } from './settings'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stamps missing ids onto sub-tasks so field-level sync merge works. */
function stampSubIds(subs: Task['sub']): Task['sub'] {
  return subs.map(s => s.id ? s : { ...s, id: makeId() })
}

/**
 * Calculate the next occurrence date for a recurring rule.
 * Returns an ISO 'YYYY-MM-DD' string.
 */
export function nextOccurrenceISO(currentDue: string, recurring: string): string {
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
  } else if (r === 'yearly' || r === 'annually') {
    base.setFullYear(base.getFullYear() + 1)
  } else {
    const m = r.match(/every (\d+) (day|days|week|weeks|month|months|year|years)/)
    if (m) {
      const n = parseInt(m[1], 10)
      const unit = m[2]
      if (unit.startsWith('day'))        base.setDate(base.getDate() + n)
      else if (unit.startsWith('week'))  base.setDate(base.getDate() + n * 7)
      else if (unit.startsWith('month')) base.setMonth(base.getMonth() + n)
      else if (unit.startsWith('year'))  base.setFullYear(base.getFullYear() + n)
    } else {
      base.setDate(base.getDate() + 1)
    }
  }

  const y  = base.getFullYear()
  const mo = String(base.getMonth() + 1).padStart(2, '0')
  const d  = String(base.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function addTask(task: Task): Promise<void> {
  const now   = Date.now()
  const toAdd = { ...task, sub: stampSubIds(task.sub ?? []), createdAt: now, updatedAt: now }
  await db.tasks.add(toAdd)
  enqueueUpsert('tasks', toAdd.id, toAdd)
}

/** Always stamps updatedAt; syncs to Supabase outbox. */
export async function updateTask(taskId: string, patch: Partial<Task>): Promise<void> {
  const stamped = patch.sub !== undefined ? { ...patch, sub: stampSubIds(patch.sub) } : patch
  await db.tasks.update(taskId, { ...stamped, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)
}

export async function deleteTask(taskId: string): Promise<void> {
  const snapshot = await db.tasks.get(taskId)
  await db.deletedTasks.put({ id: taskId, deletedAt: Date.now() })
  await db.completedTasks.delete(taskId)
  await db.tasks.delete(taskId)
  enqueueDelete('tasks', taskId, snapshot ?? undefined)
  pushTombstoneToServer(taskId).catch(() => {})
}

export async function deleteTasks(taskIds: string[]): Promise<void> {
  const now       = Date.now()
  const snapshots = await db.tasks.bulkGet(taskIds)
  await db.deletedTasks.bulkPut(taskIds.map(id => ({ id, deletedAt: now })))
  await db.completedTasks.bulkDelete(taskIds)
  await db.tasks.bulkDelete(taskIds)
  taskIds.forEach((id, i) => enqueueDelete('tasks', id, snapshots[i] ?? undefined))
  taskIds.forEach(id => pushTombstoneToServer(id).catch(() => {}))
}

export async function toggleSubTask(taskId: string, index: number): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task) return
  const sub = task.sub.map((s, i) => i === index ? { ...s, d: !s.d } : s)
  await db.tasks.update(taskId, { sub, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)
}

export async function getTombstoneIds(): Promise<Set<string>> {
  const tombstones = await db.deletedTasks.toArray()
  return new Set(tombstones.map(t => t.id))
}

export async function countActiveTasks(): Promise<number> {
  return db.tasks.where('status').equals('active').filter(t => !t.done).count()
}

// ── Completion ────────────────────────────────────────────────────────────────

/**
 * Complete a task — awards XP, updates streak, logs habit if recurring.
 * Returns { xp, nextDue } where nextDue is the next-occurrence ISO string for
 * recurring tasks, or null for one-offs.
 */
export async function completeTask(taskId: string): Promise<{ xp: number; nextDue: string | null }> {
  const task = await db.tasks.get(taskId)
  if (!task || task.done) return { xp: 0, nextDue: null }

  const gained      = EFFORT[task.effort]?.xp ?? 15
  const newStreak   = task.recurring ? (task.streak ?? 0) + 1 : task.streak ?? 0
  const completedAt = Date.now()

  // Atomic read-modify-write: task + XP in a single IDB transaction to prevent
  // double-award on rapid taps or concurrent completions.
  let updatedTask: Task | undefined
  let updatedSettings: import('../types').AppSettings | undefined
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
  if (updatedTask)     enqueueUpsert('tasks',    updatedTask.id, updatedTask)
  if (updatedSettings) enqueueUpsert('settings', String(updatedSettings.id), updatedSettings)

  if (task.recurring) {
    await logHabitCompletion(taskId, localDateISO())
  }

  // Recurring tasks: reset in-place with next occurrence date
  let nextDue: string | null = null
  if (task.recurring) {
    nextDue = nextOccurrenceISO(task.due, task.recurring)
    const resetPatch = {
      done: false, due: nextDue, streak: newStreak,
      sub:  task.sub.map(s => ({ ...s, done: false })),
      updatedAt: Date.now(),
    }
    await db.tasks.update(taskId, resetPatch)
    const reset = await db.tasks.get(taskId)
    if (reset) enqueueUpsert('tasks', taskId, reset)
  }

  await recordDailyActivity()
  return { xp: gained, nextDue }
}

/** Reverse a task completion — deducts XP, resets done, removes habit log. */
export async function uncompleteTask(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task || !task.done) return

  const gained    = EFFORT[task.effort]?.xp ?? 15
  const newStreak = task.recurring ? Math.max(0, (task.streak ?? 0) - 1) : task.streak ?? 0
  await db.tasks.update(taskId, { done: false, streak: newStreak, updatedAt: Date.now() })
  const updated = await db.tasks.get(taskId)
  if (updated) enqueueUpsert('tasks', updated.id, updated)

  await db.completedTasks.delete(taskId)

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: Math.max(0, (settings.xp ?? 0) - gained) })
  }

  if (task.recurring) {
    await removeHabitLog(taskId, localDateISO())
  }
}

// ── Reset helpers ─────────────────────────────────────────────────────────────

/**
 * Reset recurring tasks that weren't completed today.
 * Call on app start (after auth). Finds recurring tasks with done=true but no
 * habitLog entry for today — they were completed on a prior day.
 */
export async function resetRecurringTasks(): Promise<void> {
  const today     = localDateISO()
  const recurring = await db.tasks.filter(t => !!t.recurring && t.done).toArray()
  if (recurring.length === 0) return

  const resetIds: string[] = []
  for (const task of recurring) {
    const log = await db.habitLog.get(`${task.id}:${today}`)
    if (!log) resetIds.push(task.id)
  }
  if (resetIds.length > 0) {
    await Promise.all(resetIds.map(id => {
      const task = recurring.find(t => t.id === id)
      // Keep original updatedAt so remote completions (with newer stamps) can
      // win on next pull.
      return db.tasks.update(id, { done: false, updatedAt: task?.updatedAt ?? Date.now() })
    }))
    const updatedTasks = await db.tasks.bulkGet(resetIds)
    updatedTasks.forEach(t => { if (t) enqueueUpsert('tasks', t.id, t) })
  }
}

/** Prune deleted-task tombstones older than 90 days. */
export async function pruneStaleDeletedTasks(): Promise<void> {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  await db.deletedTasks.where('deletedAt').below(cutoff).delete()
}
