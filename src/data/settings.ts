/**
 * settings.ts — AppSettings helpers, daily streak, wipe utilities.
 */

import type { AppSettings } from '../types'
import { DEFAULT_SETTINGS } from '../constants'
import { db } from './schema'
import { enqueueUpsert } from '../lib/sync'
import { localDateISO } from '../lib/useCurrentDate'

// ── Get settings (always returns a value) ─────────────────────────────────────
export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(1)) ?? DEFAULT_SETTINGS
}

// ── Record daily activity — maintains global app streak ───────────────────────
// Increments settings.streak when called on a new calendar day; resets to 1 if
// a day was skipped. Idempotent — multiple calls on the same day are no-ops.
// Call from completeTask, completeHabit, saveJournalEntry.
export async function recordDailyActivity(): Promise<void> {
  const today    = localDateISO()
  const settings = await db.settings.get(1)
  if (!settings) return
  const last = settings.lastActiveDate ?? null
  if (last === today) return  // already recorded today

  let newStreak: number
  if (last === null) {
    newStreak = 1
  } else {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    newStreak = last === localDateISO(yesterday) ? (settings.streak ?? 0) + 1 : 1
  }

  await db.settings.update(1, { streak: newStreak, lastActiveDate: today })
  const updated = await db.settings.get(1)
  if (updated) enqueueUpsert('settings', String(updated.id), updated)
}

// ── Wipe streak history — habits kept, streaks + logs reset ──────────────────
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

// ── Wipe tasks only ───────────────────────────────────────────────────────────
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

// ── Wipe goals only ───────────────────────────────────────────────────────────
export async function wipeGoals(): Promise<void> {
  await db.transaction('rw', [db.goals, db.outbox], async () => {
    await db.goals.clear()
    const keys = await db.outbox.where('table').equals('goals').primaryKeys()
    await db.outbox.bulkDelete(keys as string[])
  })
}

// ── Wipe everything — no re-seed, clears pull watermarks ─────────────────────
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

// ── Wipe and prepare for full server re-pull ─────────────────────────────────
// Adds a minimal settings placeholder so the seed guard doesn't re-populate
// with demo data after the wipe.
export async function resetLocalForResync(): Promise<void> {
  await wipeAllData()
  await db.settings.add({ ...DEFAULT_SETTINGS })
}
