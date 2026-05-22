import { localDateISO } from './useCurrentDate'
import type { Category, EffortKey } from '../types'

export interface NLResult {
  title: string
  due?:      string
  time?:     string      // 'HH:MM' extracted from "at 3pm" etc.
  catId?:    string
  effort?:   EffortKey
  recurring?: string     // extracted recurring pattern
}

// ── Day-of-week helpers ───────────────────────────────────────────────────────
const DOW: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
}
const DOW_NAMES = Object.keys(DOW).join('|')

/** Next occurrence of a weekday — always at least 1 day away */
function isoNextDOW(name: string, forceNextWeek = false): string {
  const target = DOW[name.toLowerCase()]
  if (target === undefined) return ''
  const now  = new Date()
  const curr = now.getDay()
  let diff   = target - curr
  // forceNextWeek = true → "next Friday" skips this week's Friday
  if (forceNextWeek) {
    if (diff <= 0) diff += 7
    else diff += 7
  } else {
    if (diff <= 0) diff += 7
  }
  const d = new Date(now)
  d.setDate(d.getDate() + diff)
  return localDateISO(d)
}

function isoToday()    { return localDateISO() }
function isoTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return localDateISO(d) }
function isoInDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return localDateISO(d) }
function isoInWeeks(n: number) { return isoInDays(n * 7) }
function isoNextWeek()  { return isoInDays(7) }
function isoNextMonth() { const d = new Date(); d.setMonth(d.getMonth() + 1); return localDateISO(d) }
function isoEndOfWeek() {
  const d = new Date()
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + daysUntilSunday)
  return localDateISO(d)
}

// ── Time parsing ──────────────────────────────────────────────────────────────
/** Parse "3pm", "3:30pm", "15:00", "9am" → 'HH:MM' or null */
function parseTime(text: string): { time: string; match: string } | null {
  // "at 3:30pm", "at 9am", "at 15:00"
  const re = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  const m  = text.match(re)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toLowerCase()
  if (ampm === 'pm' && h < 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return {
    time:  `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`,
    match: m[0],
  }
}

// ── Recurring patterns ────────────────────────────────────────────────────────
/** Extract recurring phrase, return { recurring, match } or null */
function parseRecurring(text: string): { recurring: string; match: string } | null {
  // "every other week on Tuesday" / "every other week"
  const everyOther = text.match(/\bevery other week(?:\s+on\s+(\w+))?\b/i)
  if (everyOther) {
    const day = everyOther[1] ? ` on ${everyOther[1]}` : ''
    return { recurring: `every other week${day}`, match: everyOther[0] }
  }
  // "every week on Tuesday" / "every Tuesday"
  const everyDow = text.match(new RegExp(`\\bevery(?:\\s+week)?\\s+(${DOW_NAMES})\\b`, 'i'))
  if (everyDow) return { recurring: `every ${everyDow[1].toLowerCase()}`, match: everyDow[0] }
  // "every day" / "daily"
  if (/\bevery day\b|\bdaily\b/i.test(text)) {
    const m = text.match(/\bevery day\b|\bdaily\b/i)!
    return { recurring: 'daily', match: m[0] }
  }
  // "every weekday" / "weekdays"
  if (/\bevery weekday\b|\bweekdays\b/i.test(text)) {
    const m = text.match(/\bevery weekday\b|\bweekdays\b/i)!
    return { recurring: 'weekdays', match: m[0] }
  }
  // "every weekend" / "weekends"
  if (/\bevery weekend\b|\bweekends\b/i.test(text)) {
    const m = text.match(/\bevery weekend\b|\bweekends\b/i)!
    return { recurring: 'weekends', match: m[0] }
  }
  // "every month" / "monthly"
  if (/\bevery month\b|\bmonthly\b/i.test(text)) {
    const m = text.match(/\bevery month\b|\bmonthly\b/i)!
    return { recurring: 'monthly', match: m[0] }
  }
  // "every week" / "weekly"
  if (/\bevery week\b|\bweekly\b/i.test(text)) {
    const m = text.match(/\bevery week\b|\bweekly\b/i)!
    return { recurring: 'weekly', match: m[0] }
  }
  return null
}

// ── Effort keyword map ────────────────────────────────────────────────────────
const EFFORT_KW: Array<[RegExp, EffortKey]> = [
  [/\b(micro|xs|~?1-?5\s*m(in)?s?|~?[1-5]m)\b/i,       'xs'],
  [/\b(small|quick|~?15\s*m(in)?s?|~?15m)\b/i,          's'],
  [/\b(medium|med|~?1\s*h(r|our)?s?|~?1h)\b/i,          'm'],
  [/\b(long|~?2\s*h(r|our)?s?|~?2h)\b/i,                'l'],
  [/\b(mammoth|xl|~?6\s*h(r|our)?s?|~?6h)\b/i,          'xl'],
  [/\b(giant|xxl|~?1\s*d(ay)?s?|full.?day)\b/i,         'xxl'],
]

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseNL(raw: string, categories: Category[]): NLResult {
  let text = raw

  // ── Area: #areaname ────────────────────────────────────────────────────────
  let catId: string | undefined
  const hashMatch = text.match(/#(\w+)/)
  if (hashMatch) {
    const slug = hashMatch[1].toLowerCase()
    const found = categories.find(
      c => c.name.toLowerCase() === slug || c.id.toLowerCase() === slug || c.name.toLowerCase().startsWith(slug)
    )
    if (found) { catId = found.id; text = text.replace(hashMatch[0], '').trim() }
  }

  // ── Time: "at 3pm" — extract before date so "Friday at 3pm" works ─────────
  let time: string | undefined
  const timeParsed = parseTime(text)
  if (timeParsed) { time = timeParsed.time; text = text.replace(timeParsed.match, '').trim() }

  // ── Recurring: "every other week on Tuesday" etc. ─────────────────────────
  let recurring: string | undefined
  const recurParsed = parseRecurring(text)
  if (recurParsed) { recurring = recurParsed.recurring; text = text.replace(recurParsed.match, '').trim() }

  // ── Due date ──────────────────────────────────────────────────────────────
  let due: string | undefined
  type DuePat = [RegExp, (m: RegExpMatchArray) => string]
  const duePats: DuePat[] = [
    // "in 3 days" / "in 2 weeks"
    [/\bin\s+(\d+)\s+days?\b/i,   (m) => isoInDays(parseInt(m[1], 10))],
    [/\bin\s+(\d+)\s+weeks?\b/i,  (m) => isoInWeeks(parseInt(m[1], 10))],
    [/\bin\s+a\s+week\b/i,        ()  => isoInDays(7)],
    [/\bin\s+a\s+month\b/i,       ()  => isoNextMonth()],
    // "end of week"
    [/\bend\s+of\s+(?:the\s+)?week\b/i, () => isoEndOfWeek()],
    // "next [weekday]" — force skip to the following week's occurrence
    [new RegExp(`\\bnext\\s+(${DOW_NAMES})\\b`, 'i'), (m) => isoNextDOW(m[1], true)],
    // "next week"
    [/\bnext week\b/i,             () => isoNextWeek()],
    // "next month"
    [/\bnext month\b/i,            () => isoNextMonth()],
    // bare day-of-week → nearest future occurrence
    [new RegExp(`\\b(${DOW_NAMES})\\b`, 'i'), (m) => isoNextDOW(m[1], false)],
    // "today" / "tonight"
    [/\b(today|tonight)\b/i,       () => isoToday()],
    // "tomorrow"
    [/\btomorrow\b/i,              () => isoTomorrow()],
    // ISO "2025-12-31"
    [/\b(\d{4}-\d{2}-\d{2})\b/,   (m) => m[1]],
    // slash/dash date "31/12" or "31/12/25"
    [/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/, (m) => {
      const year = m[3]
        ? (m[3].length === 2 ? '20' + m[3] : m[3])
        : new Date().getFullYear().toString()
      return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    }],
  ]
  for (const [re, fn] of duePats) {
    const m = text.match(re)
    if (m) {
      const val = fn(m)
      if (val) { due = val; text = text.replace(m[0], '').trim(); break }
    }
  }

  // ── Effort ────────────────────────────────────────────────────────────────
  let effort: EffortKey | undefined
  for (const [re, key] of EFFORT_KW) {
    if (re.test(text)) {
      effort = key
      text = text.replace(re, '').trim()
      break
    }
  }

  // ── Clean up leftover punctuation / whitespace ────────────────────────────
  const title = text.replace(/\s{2,}/g, ' ').replace(/^[\s,\-·]+|[\s,\-·]+$/g, '').trim()

  return { title: title || raw.trim(), due, time, catId, effort, recurring }
}

// ── Summary line for UI feedback ──────────────────────────────────────────────
export function nlSummary(r: NLResult, categories: Category[]): string {
  const parts: string[] = []
  if (r.due)       parts.push(r.due)
  if (r.time)      parts.push(r.time)
  if (r.recurring) parts.push(r.recurring)
  if (r.catId)     parts.push(categories.find(c => c.id === r.catId)?.name ?? r.catId)
  if (r.effort) {
    const labels: Record<EffortKey, string> = { xs: '5m', s: '15m', m: '1h', l: '2h', xl: '6h', xxl: '1d' }
    parts.push(labels[r.effort])
  }
  return parts.join(' · ')
}
