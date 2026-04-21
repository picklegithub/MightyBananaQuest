/**
 * parseDue.ts
 *
 * Parses a natural-language due/repeat string into a { due, recurring } pair.
 *
 * Examples:
 *   "tomorrow"                   → { due: 'Tomorrow', recurring: null }
 *   "every Monday"               → { due: next Monday ISO, recurring: 'Weekly on Mon' }
 *   "every Monday starting next week" → same, with starting date adjusted
 *   "every day"                  → { due: 'Today', recurring: 'Daily' }
 *   "every 3 weeks"              → { due: next in 3 weeks ISO, recurring: 'Every 3 weeks' }
 *   "next Friday"                → { due: ISO date, recurring: null }
 *   ""                           → { due: 'Today', recurring: null }
 */

import * as chrono from 'chrono-node'

export interface ParsedDue {
  due: string        // 'Today' | 'Tomorrow' | 'YYYY-MM-DD'
  recurring: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function isToday(d: Date): boolean {
  const t = new Date()
  return d.getFullYear() === t.getFullYear() &&
         d.getMonth() === t.getMonth() &&
         d.getDate() === t.getDate()
}

function isTomorrow(d: Date): boolean {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  return d.getFullYear() === t.getFullYear() &&
         d.getMonth() === t.getMonth() &&
         d.getDate() === t.getDate()
}

function dateLabel(d: Date): string {
  if (isToday(d))     return 'Today'
  if (isTomorrow(d))  return 'Tomorrow'
  return toISO(d)
}

// Day-of-week names
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function nextDow(dow: number): Date {
  const d = new Date()
  const diff = (dow - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}

// ── Recurrence pattern detection ──────────────────────────────────────────────
// Returns { recurring, startDate } if a recurrence pattern is detected, or null

interface RecurResult {
  recurring: string
  startDate: Date | null   // null = "use chrono / default"
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

function detectRecurrence(raw: string): RecurResult | null {
  const s = raw.toLowerCase().trim()

  // "every day" / "daily"
  if (/\b(every day|daily)\b/.test(s)) {
    return { recurring: 'Daily', startDate: new Date() }
  }

  // "weekdays" / "every weekday"
  if (/\b(every weekday|weekdays)\b/.test(s)) {
    return { recurring: 'Weekdays', startDate: null }
  }

  // "weekends" / "every weekend"
  if (/\b(every weekend|weekends)\b/.test(s)) {
    return { recurring: 'Weekends', startDate: nextDow(6) }
  }

  // "every week" / "weekly"
  if (/\b(every week(?:ly)?|weekly)\b/.test(s) && !/every \d/.test(s)) {
    return { recurring: 'Weekly', startDate: new Date() }
  }

  // "every month" / "monthly"
  if (/\b(every month(?:ly)?|monthly)\b/.test(s) && !/every \d/.test(s)) {
    return { recurring: 'Monthly', startDate: new Date() }
  }

  // "every Monday", "every Tuesday" etc. (with optional "starting …")
  const dowMatch = s.match(/every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/)
  if (dowMatch) {
    const dow = WEEKDAY_MAP[dowMatch[1]]
    const dayName = DOW[dow]
    const recurring = `Weekly on ${dayName}`

    // Look for "starting …"
    const startingMatch = s.match(/starting\s+(.+)$/)
    let startDate: Date | null = null
    if (startingMatch) {
      const parsed = chrono.parseDate(startingMatch[1])
      startDate = parsed ?? nextDow(dow)
    } else {
      startDate = nextDow(dow)
    }
    return { recurring, startDate }
  }

  // "every biweek" / "biweekly" / "fortnightly"
  if (/\b(biweekly|bi-weekly|fortnightly|every two weeks|every 2 weeks)\b/.test(s)) {
    return { recurring: 'Biweekly', startDate: null }
  }

  // "every N days/weeks/months"
  const customMatch = s.match(/every\s+(\d+)\s+(day|days|week|weeks|month|months)\b/)
  if (customMatch) {
    const n = parseInt(customMatch[1], 10)
    const unit = customMatch[2].replace(/s$/, '') + (n === 1 ? '' : 's') // "day" or "days"
    const recurring = `Every ${n} ${unit}`

    // start date
    let startDate = new Date()
    const startingMatch = s.match(/starting\s+(.+)$/)
    if (startingMatch) {
      const parsed = chrono.parseDate(startingMatch[1])
      if (parsed) startDate = parsed
    }
    return { recurring, startDate }
  }

  return null
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseDue(raw: string): ParsedDue {
  const trimmed = raw.trim()

  if (!trimmed) {
    return { due: 'Today', recurring: null }
  }

  // Check for recurrence first
  const recur = detectRecurrence(trimmed)
  if (recur) {
    const due = recur.startDate ? dateLabel(recur.startDate) : 'Today'
    return { due, recurring: recur.recurring }
  }

  // No recurrence — try chrono for one-off date
  const parsed = chrono.parseDate(trimmed)
  if (parsed) {
    return { due: dateLabel(parsed), recurring: null }
  }

  // Fallback — return as-is label
  return { due: trimmed, recurring: null }
}

// ── Human-readable summary for UI preview ────────────────────────────────────

export function dueSummary(due: string, recurring: string | null): string {
  const parts: string[] = []
  if (due && due !== 'Today') parts.push(due)
  if (recurring)              parts.push(recurring)
  if (parts.length === 0)     return 'Today'
  return parts.join(' · ')
}

// ── Format ISO or label for display ──────────────────────────────────────────

export function formatDueLabel(due: string): string {
  if (!due || due === 'Today' || due === 'Tomorrow') return due || 'Today'
  try {
    return new Date(due + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  } catch {
    return due
  }
}
