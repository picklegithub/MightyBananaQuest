/**
 * habitLog.ts — log a single habit check-in.
 *
 * Kept separate so both tasks.ts (recurring task completion) and habits.ts
 * (standalone habit completion) can import without creating a circular dep.
 */

import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'

export async function logHabitCompletion(taskId: string, date: string): Promise<void> {
  const id    = `${taskId}:${date}`
  const entry = { id, taskId, date }
  await db.habitLog.put(entry)
  enqueueUpsert('habit_log', id, entry)
}

export async function removeHabitLog(taskId: string, date: string): Promise<void> {
  const id = `${taskId}:${date}`
  await db.habitLog.delete(id)
  enqueueDelete('habit_log', id)
}
