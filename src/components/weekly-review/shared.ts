import { localDateISO } from '../../lib/useCurrentDate'
import { db } from '../../data/db'
import { EFFORT } from '../../constants'
import type { GoalPulseStatus } from '../../types'

// ── Week helpers ──────────────────────────────────────────────────────────────

export function getMondayISO(d: Date): string {
  const day  = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon  = new Date(d)
  mon.setDate(d.getDate() + diff)
  return localDateISO(mon)
}

export function getSundayISO(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return localDateISO(d)
}

export function displayRange(start: string, end: string): string {
  const s   = new Date(start + 'T00:00:00')
  const e   = new Date(end   + 'T00:00:00')
  const fmt = (d: Date, y?: boolean) =>
    d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) })
  return `${fmt(s)} – ${fmt(e, true)}`
}

export function isoOffsetFrom(base: Date, offsetDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() - offsetDays)
  return localDateISO(d)
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface WeekStats {
  tasksCompleted: number
  xpGained:       number
  journalDays:    number
  habitsDone:     number
  partial:        boolean
}

export async function computeStats(weekStart: string, weekEnd: string): Promise<WeekStats> {
  const startMs  = new Date(weekStart + 'T00:00:00').getTime()
  const endMs    = new Date(weekEnd   + 'T23:59:59').getTime()
  const todayISO = localDateISO()

  const allTasks  = await db.tasks.toArray()
  const completed = allTasks.filter(
    t => t.done && t.updatedAt != null && t.updatedAt >= startMs && t.updatedAt <= endMs
  )

  const xpGained = completed.reduce((s, t) => s + (EFFORT[t.effort]?.xp ?? 0), 0)

  const entries     = await db.journal.toArray()
  const journalDays = new Set(
    entries.filter(e => e.date >= weekStart && e.date <= weekEnd).map(e => e.date)
  ).size

  const habitLogs  = await db.habitLog.where('date').between(weekStart, weekEnd, true, true).toArray()
  const habitsDone = habitLogs.length

  return { tasksCompleted: completed.length, xpGained, journalDays, habitsDone, partial: todayISO < weekEnd }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const STEP_LABELS = ['Your week', 'Mood', 'Goals', 'Prompts']

export const PULSE_OPTIONS: { status: GoalPulseStatus; label: string; emoji: string }[] = [
  { status: 'on-track',        label: 'On Track',        emoji: '✅' },
  { status: 'needs-attention', label: 'Needs Attention', emoji: '⚠️' },
  { status: 'pausing',         label: 'Pausing',         emoji: '⏸️' },
]

export function generateInsight(stats: WeekStats, streak: number): string {
  if (stats.tasksCompleted === 0 && stats.journalDays === 0) return 'A quiet week — next week is a fresh start.'
  if (streak >= 7) return `${streak}-day streak — momentum is real. Don't break the chain.`
  if (stats.journalDays >= 6) return 'Six days of journalling — your self-awareness is compounding.'
  if (stats.tasksCompleted >= 10) return `${stats.tasksCompleted} tasks done — that's a productive week.`
  if (stats.habitsDone >= 14) return 'Habits held strong — consistency beats intensity every time.'
  if (stats.partial) return 'Week still in progress — you have time to finish strong.'
  return 'Every week you show up is a week that counts.'
}
