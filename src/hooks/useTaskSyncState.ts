/**
 * useTaskSyncState — reactive per-task outbox state (E-3 visual indicator).
 *
 * Returns:
 *   'pending'  — task has a live outbox entry waiting to push
 *   'failed'   — task outbox entry is dead-lettered (gave up after max retries)
 *   'synced'   — no outbox entry; task is clean
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'

export type TaskSyncStatus = 'pending' | 'failed' | 'synced'

export function useTaskSyncState(taskId: string): TaskSyncStatus {
  const entry = useLiveQuery(() => db.outbox.get(`tasks:${taskId}`), [taskId])

  if (!entry) return 'synced'
  if (entry.deadLettered) return 'failed'
  return 'pending'
}
