/**
 * habits.ts — Habit domain: CRUD, completion, daily reset.
 */

import type { Habit } from '../types'
import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'
import { localDateISO } from '../lib/useCurrentDate'
import { logHabitCompletion } from './habitLog'
import { recordDailyActivity } from './settings'

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function addHabit(habit: Omit<Habit, 'createdAt' | 'updatedAt'>): Promise<Habit> {
  const now  = Date.now()
  const full: Habit = { ...habit, createdAt: now, updatedAt: now }
  await db.habits.add(full)
  enqueueUpsert('habits', full.id, full)
  return full
}

export async function updateHabit(habitId: string, patch: Partial<Habit>): Promise<void> {
  await db.habits.update(habitId, { ...patch, updatedAt: Date.now() })
  const updated = await db.habits.get(habitId)
  if (updated) enqueueUpsert('habits', updated.id, updated)
}

export async function deleteHabit(habitId: string): Promise<void> {
  await db.habits.delete(habitId)
  enqueueDelete('habits', habitId)
  const logs = await db.habitLog.where('taskId').equals(habitId).toArray()
  if (logs.length > 0) await db.habitLog.bulkDelete(logs.map(l => l.id))
}

// ── Completion ────────────────────────────────────────────────────────────────

/** Complete a habit — awards flat XP, updates streak + EMA strength, logs today. */
export async function completeHabit(habitId: string): Promise<number> {
  const habit = await db.habits.get(habitId)
  if (!habit || habit.done) return 0

  const gained      = 3   // flat XP per habit check-in
  const newStreak   = (habit.streak ?? 0) + 1
  const newBest     = Math.max(habit.bestStreak ?? 0, newStreak)
  // EMA strength: S = prev * 0.9 + 1.0 * 0.1  (completion = 1)
  const newStrength = Math.min(1.0, parseFloat(((habit.strength ?? 0.5) * 0.9 + 0.1).toFixed(4)))

  await db.habits.update(habitId, {
    done: true, streak: newStreak, bestStreak: newBest,
    strength: newStrength, updatedAt: Date.now(),
  })
  const updatedHabit = await db.habits.get(habitId)
  if (updatedHabit) enqueueUpsert('habits', updatedHabit.id, updatedHabit)

  const settings = await db.settings.get(1)
  if (settings) {
    await db.settings.update(1, { xp: (settings.xp ?? 0) + gained })
    const newSettings = await db.settings.get(1)
    if (newSettings) enqueueUpsert('settings', String(newSettings.id), newSettings)
  }

  await logHabitCompletion(habitId, localDateISO())
  await recordDailyActivity()
  return gained
}

// ── Daily reset ───────────────────────────────────────────────────────────────

const EMA_ALPHA = 0.1

/**
 * Reset habits that weren't completed today.
 * Call alongside resetRecurringTasks on app start.
 * Missed habits have their streak reset to 0 and EMA strength decayed.
 */
export async function resetHabits(): Promise<void> {
  const today      = localDateISO()
  const now        = Date.now()

  // ── Pass 1: habits flagged done but without a log entry for today ──────────
  // These were completed in a previous day's session (done flag stale), treat as missed.
  const doneHabits = await db.habits.filter(h => h.done && !h.isArchived).toArray()
  const toReset:   string[] = []

  for (const habit of doneHabits) {
    const log = await db.habitLog.get(`${habit.id}:${today}`)
    if (!log) toReset.push(habit.id)
  }

  if (toReset.length > 0) {
    // bestStreak intentionally preserved — only streak resets on a miss
    // EMA decay: S = prev * (1 - EMA_ALPHA)  (miss = 0)
    await Promise.all(toReset.map(id => {
      const habit           = doneHabits.find(h => h.id === id)
      const decayedStrength = Math.max(0, parseFloat(((habit?.strength ?? 0.5) * (1 - EMA_ALPHA)).toFixed(4)))
      return db.habits.update(id, {
        done: false, streak: 0, strength: decayedStrength, updatedAt: now,
      })
    }))
  }

  // ── Pass 2: habits not done and not archived — soft strength decay for a missed day ──
  // These are habits that simply weren't checked off. Streak stays 0 (already 0),
  // but strength decays gently to reflect the missed day.
  const missedHabits = await db.habits.filter(h => !h.done && !h.isArchived).toArray()
  if (missedHabits.length > 0) {
    await Promise.all(missedHabits.map(habit => {
      const decayedStrength = Math.max(0, parseFloat(((habit.strength ?? 0.5) * (1 - EMA_ALPHA)).toFixed(4)))
      return db.habits.update(habit.id, {
        strength: decayedStrength, updatedAt: now,
      })
    }))
  }
}
