/**
 * dailyPlan.ts — DailyPlan ritual helpers.
 */

import type { DailyPlan } from '../types'
import { db } from './schema'
import { enqueueUpsert } from '../lib/sync'
import { localDateISO } from '../lib/useCurrentDate'

/** Returns today's ISO date string, e.g. '2026-04-27'. */
export function todayISO(): string {
  return localDateISO()
}

/**
 * Fetch the DailyPlan row for today, or null if the ritual hasn't started.
 * Check `plan.completedAt !== null` to test whether it's fully done.
 */
export async function getTodayPlan(): Promise<DailyPlan | null> {
  return (await db.dailyPlans.get(todayISO())) ?? null
}

/**
 * Persist (create or overwrite) the plan row for today.
 * Merges the patch with any existing row.
 */
export async function saveDailyPlan(patch: Partial<Omit<DailyPlan, 'date'>>): Promise<void> {
  const date     = todayISO()
  const existing = await db.dailyPlans.get(date)
  const next: DailyPlan = {
    date,
    pickedIds:    [],
    top3Ids:      [],
    reckonings:   [],
    calBudgetMin: 0,
    completedAt:  null,
    ...existing,
    ...patch,
  }
  await db.dailyPlans.put(next)
  enqueueUpsert('daily_plans', next.date, next)
}

/**
 * Returns true if today's ritual has been completed.
 * Safe to call on every app open — returns false when no row exists.
 */
export async function isTodayPlanComplete(): Promise<boolean> {
  const plan = await getTodayPlan()
  return plan !== null && plan.completedAt !== null
}
