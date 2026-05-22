/**
 * goals.ts — Goal CRUD.
 */

import type { Goal } from '../types'
import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'

export async function addGoal(goal: Goal): Promise<void> {
  const now = Date.now()
  const withTs: Goal = { createdAt: now, updatedAt: now, ...goal }
  await db.goals.add(withTs)
  enqueueUpsert('goals', withTs.id, withTs)
}

export async function updateGoal(goalId: string, patch: Partial<Goal>): Promise<void> {
  await db.goals.update(goalId, patch)
  const updated = await db.goals.get(goalId)
  if (updated) enqueueUpsert('goals', updated.id, updated)
}

export async function deleteGoal(goalId: string): Promise<void> {
  await db.goals.delete(goalId)
  enqueueDelete('goals', goalId)
}
