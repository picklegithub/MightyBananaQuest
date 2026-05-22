/**
 * analyticsQueries.ts — Reusable async query functions for mood, energy,
 * and habit analytics.
 *
 * Primary data source: moodEntries table (Phase 4 — 5-point scale).
 * Backward compat: also reads legacy DailyPlan.mood and JournalEntry fields
 * so historical data before the Phase 4 migration still surfaces.
 */

import { db } from '../data/db'
import { localDateISO } from './useCurrentDate'
import type { MoodScore, MoodEnergy } from '../types'

// ── Shared types ──────────────────────────────────────────────────────────────

export type { MoodScore, MoodEnergy }

/** @deprecated use MoodScore (1-5) going forward */
export type MoodState = 'steady' | 'tired' | 'charged'

export type EnergyLevel = 1 | 2 | 3   // legacy numeric — still used in EnergyStats
export type ImpactLevel = 1 | 2 | 3 | 4

/** One row per calendar date */
export interface DayMoodEnergy {
  date:             string
  // ── New Phase 4 fields (from moodEntries table) ──
  moodScore:        MoodScore | null   // 1–5
  energyLevel:      MoodEnergy | null  // 'tired' | 'steady' | 'charged'
  moodSource:       string | null      // which source logged it
  // ── Legacy fields (from DailyPlan + JournalEntry — kept for backward compat) ──
  planMood:         MoodState | null
  morningMood:      MoodState | null
  energy:           EnergyLevel | null
  impact:           ImpactLevel | null
  // ── Counts ──
  habitsCompleted:  number
  tasksCompleted:   number
  hadMorningJournal: boolean
  hadEveningJournal: boolean
}

/** 5-point mood distribution */
export interface MoodDistribution5 {
  1: number; 2: number; 3: number; 4: number; 5: number
  unknown: number
  total: number
}

/** Legacy 3-state distribution — kept for backward compat consumers */
export interface MoodDistribution {
  steady:  number
  tired:   number
  charged: number
  unknown: number
  total:   number
}

export interface EnergyStats {
  avg:          number
  trend:        'up' | 'down' | 'stable' | 'insufficient'
  distribution: { tired: number; steady: number; charged: number }
  daysWithData: number
}

export interface HabitByMood {
  mood:       MoodState
  avgRate:    number
  sampleDays: number
}

export interface ProductivityByEnergy {
  energy:     MoodEnergy
  avgTasks:   number
  avgImpact:  number
  sampleDays: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoOffset(base: Date, offsetDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() - offsetDays)
  return localDateISO(d)
}

function dateRange(days: number): string[] {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => isoOffset(now, days - 1 - i))
}

/** Convert 5-point score → legacy 3-state for backward compat queries. */
function scoreToState(score: MoodScore): MoodState {
  if (score <= 2) return 'tired'
  if (score === 3) return 'steady'
  return 'charged'
}

/** Convert energy string → legacy numeric. */
function energyToNum(e: MoodEnergy): EnergyLevel {
  if (e === 'tired')  return 1
  if (e === 'steady') return 2
  return 3
}

// ── getMoodEnergyHistory ──────────────────────────────────────────────────────

export async function getMoodEnergyHistory(days = 30): Promise<DayMoodEnergy[]> {
  const range = dateRange(days)
  const [start, end] = [range[0], range[range.length - 1]]

  const [journalEntries, dailyPlans, habitLogs, tasks, moodEntries] = await Promise.all([
    db.journal.where('date').between(start, end, true, true).toArray(),
    db.dailyPlans.where('date').between(start, end, true, true).toArray(),
    db.habitLog.where('date').between(start, end, true, true).toArray(),
    db.tasks.where('done').equals(1 as any).toArray(),
    db.moodEntries.where('date').between(start, end, true, true).toArray(),
  ])

  const morningByDate = new Map<string, typeof journalEntries[0]>()
  const eveningByDate = new Map<string, typeof journalEntries[0]>()
  for (const e of journalEntries) {
    if (e.kind === 'morning') morningByDate.set(e.date, e)
    if (e.kind === 'evening') eveningByDate.set(e.date, e)
  }

  const planByDate = new Map(dailyPlans.map(p => [p.date, p]))

  const habitCountByDate = new Map<string, number>()
  for (const l of habitLogs) {
    habitCountByDate.set(l.date, (habitCountByDate.get(l.date) ?? 0) + 1)
  }

  const taskCountByDate = new Map<string, number>()
  for (const t of tasks) {
    if (!t.completedAt) continue
    const iso = localDateISO(new Date(t.completedAt))
    if (iso >= start && iso <= end) {
      taskCountByDate.set(iso, (taskCountByDate.get(iso) ?? 0) + 1)
    }
  }

  // Index new moodEntries by date — prefer morning-journal, fallback to standalone/daily-plan
  const moodEntryByDate = new Map<string, { score: MoodScore; energy: MoodEnergy | null; source: string }>()
  const energyEntryByDate = new Map<string, MoodEnergy>()
  for (const me of moodEntries) {
    if (!me._deleted) {
      // For mood: prefer morning-journal > daily-plan > standalone
      const existing = moodEntryByDate.get(me.date)
      const priority = me.source === 'morning-journal' ? 3 : me.source === 'daily-plan' ? 2 : 1
      const existingPriority = existing?.source === 'morning-journal' ? 3 : existing?.source === 'daily-plan' ? 2 : 1
      if (!existing || priority >= existingPriority) {
        moodEntryByDate.set(me.date, { score: me.mood, energy: me.energy, source: me.source })
      }
      // For energy: prefer evening-journal
      if (me.source === 'evening-journal' && me.energy) {
        energyEntryByDate.set(me.date, me.energy)
      } else if (!energyEntryByDate.has(me.date) && me.energy) {
        energyEntryByDate.set(me.date, me.energy)
      }
    }
  }

  return range.map(date => {
    const morning    = morningByDate.get(date)
    const evening    = eveningByDate.get(date)
    const plan       = planByDate.get(date)
    const newMood    = moodEntryByDate.get(date)
    const newEnergy  = energyEntryByDate.get(date) ?? null

    // Legacy energy numeric: prefer new string energy, fall back to old numeric
    const legacyEnergy = newEnergy
      ? energyToNum(newEnergy)
      : (evening?.energy ?? null) as EnergyLevel | null

    return {
      date,
      // New fields
      moodScore:         newMood?.score ?? null,
      energyLevel:       newEnergy,
      moodSource:        newMood?.source ?? null,
      // Legacy fields
      planMood:          plan?.mood ?? null,
      morningMood:       morning?.morningMood ?? null,
      energy:            legacyEnergy,
      impact:            (evening?.impact ?? null) as ImpactLevel | null,
      habitsCompleted:   habitCountByDate.get(date) ?? 0,
      tasksCompleted:    taskCountByDate.get(date) ?? 0,
      hadMorningJournal: !!morning,
      hadEveningJournal: !!evening,
    }
  })
}

// ── getMoodDistribution5 — new 5-point ────────────────────────────────────────

export async function getMoodDistribution5(days = 30): Promise<MoodDistribution5> {
  const history = await getMoodEnergyHistory(days)
  const dist: MoodDistribution5 = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unknown: 0, total: days }

  for (const d of history) {
    if (d.moodScore) {
      dist[d.moodScore]++
    } else {
      // Fall back to legacy 3-state → approximate score
      const legacy = d.planMood ?? d.morningMood
      if (legacy === 'tired')   { dist[2]++; continue }
      if (legacy === 'steady')  { dist[3]++; continue }
      if (legacy === 'charged') { dist[4]++; continue }
      dist.unknown++
    }
  }

  return dist
}

/** Legacy 3-state distribution — kept for WeeklyReview, ProgressScreen. */
export async function getMoodDistribution(days = 30): Promise<MoodDistribution> {
  const history = await getMoodEnergyHistory(days)
  const dist: MoodDistribution = { steady: 0, tired: 0, charged: 0, unknown: 0, total: days }

  for (const d of history) {
    let state: MoodState | null = null
    if (d.moodScore) {
      state = scoreToState(d.moodScore)
    } else {
      state = d.planMood ?? d.morningMood
    }
    if (state === 'steady')  { dist.steady++; continue }
    if (state === 'tired')   { dist.tired++;  continue }
    if (state === 'charged') { dist.charged++; continue }
    dist.unknown++
  }

  return dist
}

// ── getEnergyStats ────────────────────────────────────────────────────────────

export async function getEnergyStats(days = 30): Promise<EnergyStats> {
  const history = await getMoodEnergyHistory(days)

  const distribution = { tired: 0, steady: 0, charged: 0 }
  const levelsForAvg: number[] = []

  for (const d of history) {
    if (d.energyLevel) {
      distribution[d.energyLevel]++
      levelsForAvg.push(energyToNum(d.energyLevel))
    } else if (d.energy) {
      // Legacy fallback
      if (d.energy === 1) distribution.tired++
      else if (d.energy === 2) distribution.steady++
      else distribution.charged++
      levelsForAvg.push(d.energy)
    }
  }

  const avg = levelsForAvg.length > 0
    ? levelsForAvg.reduce((s, v) => s + v, 0) / levelsForAvg.length
    : NaN

  let trend: EnergyStats['trend'] = 'insufficient'
  if (levelsForAvg.length >= 7) {
    const last7  = levelsForAvg.slice(-7)
    const prior7 = levelsForAvg.slice(-14, -7)
    if (prior7.length >= 3) {
      const avgLast  = last7.reduce((s, v) => s + v, 0) / last7.length
      const avgPrior = prior7.reduce((s, v) => s + v, 0) / prior7.length
      const delta    = avgLast - avgPrior
      trend = delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'stable'
    } else {
      trend = 'stable'
    }
  }

  return { avg, trend, distribution, daysWithData: levelsForAvg.length }
}

// ── getHabitCompletionByMood ──────────────────────────────────────────────────

export async function getHabitCompletionByMood(days = 90): Promise<HabitByMood[]> {
  const [history, habits] = await Promise.all([
    getMoodEnergyHistory(days),
    db.habits.filter(h => !h.isArchived).toArray(),
  ])

  const totalHabits = habits.length
  if (totalHabits === 0) return []

  const buckets: Record<MoodState, { rateSum: number; count: number }> = {
    steady:  { rateSum: 0, count: 0 },
    tired:   { rateSum: 0, count: 0 },
    charged: { rateSum: 0, count: 0 },
  }

  for (const d of history) {
    // Prefer new 5-point → 3-state mapping; fall back to legacy
    let state: MoodState | null = null
    if (d.moodScore) {
      state = scoreToState(d.moodScore)
    } else {
      state = d.planMood ?? d.morningMood
    }
    if (!state) continue
    const rate = Math.min(d.habitsCompleted / totalHabits, 1)
    buckets[state].rateSum += rate
    buckets[state].count++
  }

  return (Object.entries(buckets) as [MoodState, { rateSum: number; count: number }][])
    .map(([mood, { rateSum, count }]) => ({
      mood,
      avgRate:    count > 0 ? rateSum / count : 0,
      sampleDays: count,
    }))
    .sort((a, b) => a.mood.localeCompare(b.mood))
}

// ── getProductivityByEnergy ───────────────────────────────────────────────────

export async function getProductivityByEnergy(days = 90): Promise<ProductivityByEnergy[]> {
  const history = await getMoodEnergyHistory(days)

  const buckets: Record<string, { taskSum: number; impactSum: number; impactCount: number; count: number }> = {
    tired:   { taskSum: 0, impactSum: 0, impactCount: 0, count: 0 },
    steady:  { taskSum: 0, impactSum: 0, impactCount: 0, count: 0 },
    charged: { taskSum: 0, impactSum: 0, impactCount: 0, count: 0 },
  }

  for (const d of history) {
    // Prefer new energyLevel string; fall back to legacy numeric
    const key: MoodEnergy | null = d.energyLevel
      ?? (d.energy === 1 ? 'tired' : d.energy === 2 ? 'steady' : d.energy === 3 ? 'charged' : null)
    if (!key) continue
    const b = buckets[key]
    b.taskSum += d.tasksCompleted
    b.count++
    if (d.impact !== null) { b.impactSum += d.impact!; b.impactCount++ }
  }

  return (['tired', 'steady', 'charged'] as MoodEnergy[]).map(energy => {
    const b = buckets[energy]
    return {
      energy,
      avgTasks:  b.count > 0 ? b.taskSum / b.count : 0,
      avgImpact: b.impactCount > 0 ? b.impactSum / b.impactCount : NaN,
      sampleDays: b.count,
    }
  })
}

// ── getSustainabilityScore ────────────────────────────────────────────────────

export async function getSustainabilityScore(days = 30): Promise<number> {
  const history = await getMoodEnergyHistory(days)

  const withEnergy = history.filter(d => d.energyLevel !== null || d.energy !== null)
  if (withEnergy.length < 3) return NaN

  // Average energy — normalise to 1–3 scale
  const avgEnergy = withEnergy.reduce((s, d) => {
    const v = d.energyLevel ? energyToNum(d.energyLevel) : d.energy!
    return s + v
  }, 0) / withEnergy.length
  const energyScore = ((avgEnergy - 1) / 2) * 100

  const journalDays = history.filter(d => d.hadEveningJournal).length
  const journalScore = (journalDays / days) * 100

  const moodDays = history.filter(d => d.moodScore !== null || d.planMood !== null || d.morningMood !== null)
  const tiredDays = moodDays.filter(d => {
    if (d.moodScore) return d.moodScore <= 2
    return (d.planMood ?? d.morningMood) === 'tired'
  }).length
  const moodScore2 = moodDays.length > 0
    ? ((moodDays.length - tiredDays) / moodDays.length) * 100
    : 50

  return Math.round(energyScore * 0.5 + journalScore * 0.3 + moodScore2 * 0.2)
}

// ── getJournalConsistency ─────────────────────────────────────────────────────

export async function getJournalConsistency(days = 30): Promise<number> {
  const range = dateRange(days)
  const [start, end] = [range[0], range[range.length - 1]]
  const entries = await db.journal.where('date').between(start, end, true, true).toArray()
  const daysWithEntries = new Set(entries.map(e => e.date)).size
  return Math.round((daysWithEntries / days) * 100)
}

// ── getWeeklyMoodSummary ──────────────────────────────────────────────────────

export interface WeekMoodSummary {
  weekStart:        string
  avgEnergy:        number | null
  moodDistribution: MoodDistribution
}

export async function getWeeklyMoodSummary(weeks = 8): Promise<WeekMoodSummary[]> {
  const history = await getMoodEnergyHistory(weeks * 7)
  const summaries: WeekMoodSummary[] = []

  for (let w = 0; w < weeks; w++) {
    const slice = history.slice(w * 7, (w + 1) * 7)
    const withEnergy = slice.filter(d => d.energyLevel !== null || d.energy !== null)
    const avgEnergy  = withEnergy.length > 0
      ? withEnergy.reduce((s, d) => {
          const v = d.energyLevel ? energyToNum(d.energyLevel) : d.energy!
          return s + v
        }, 0) / withEnergy.length
      : null

    const dist: MoodDistribution = { steady: 0, tired: 0, charged: 0, unknown: 0, total: 7 }
    for (const d of slice) {
      let state: MoodState | null = d.moodScore ? scoreToState(d.moodScore) : (d.planMood ?? d.morningMood)
      if (state === 'steady')  { dist.steady++;  continue }
      if (state === 'tired')   { dist.tired++;   continue }
      if (state === 'charged') { dist.charged++; continue }
      dist.unknown++
    }

    summaries.push({ weekStart: slice[0]?.date ?? '', avgEnergy, moodDistribution: dist })
  }

  return summaries
}
