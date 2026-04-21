import type { Category, EffortKey, QuadKey } from '../types'

export interface NLResult {
  title: string
  due?:    string
  catId?:  string
  quad?:   QuadKey
  effort?: EffortKey
}

// ── Day-of-week helpers ───────────────────────────────────────────────────────
const DOW: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
}

function isoFromDOW(name: string): string {
  const target = DOW[name.toLowerCase()]
  if (target === undefined) return ''
  const now  = new Date()
  const curr = now.getDay()
  let diff   = target - curr
  if (diff <= 0) diff += 7
  const d = new Date(now)
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function isoToday()    { return new Date().toISOString().slice(0, 10) }
function isoTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
function isoNextWeek() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) }

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

  // ── Area: #areaname or #area ─────────────────────────────────────────────
  let catId: string | undefined
  const hashMatch = text.match(/#(\w+)/)
  if (hashMatch) {
    const slug = hashMatch[1].toLowerCase()
    const found = categories.find(
      c => c.name.toLowerCase() === slug || c.id.toLowerCase() === slug || c.name.toLowerCase().startsWith(slug)
    )
    if (found) { catId = found.id; text = text.replace(hashMatch[0], '').trim() }
  }

  // ── Due date ─────────────────────────────────────────────────────────────
  let due: string | undefined
  type DuePat = [RegExp, (m: RegExpMatchArray) => string]
  const duePats: DuePat[] = [
    [/\btoday\b/i,               () => 'Today'],
    [/\btomorrow\b/i,            () => 'Tomorrow'],
    [/\bnext week\b/i,           () => isoNextWeek()],
    [/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
                                 (m) => isoFromDOW(m[1]) || ''],
    [/\b(\d{4}-\d{2}-\d{2})\b/, (m) => m[1]],
    [/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/,
      (m) => {
        const parts = m[1].split(/[\/\-]/)
        const year  = parts[2] ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : new Date().getFullYear().toString()
        return `${year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
      }
    ],
  ]
  for (const [re, fn] of duePats) {
    const m = text.match(re)
    if (m) {
      const val = fn(m)
      if (val) { due = val; text = text.replace(m[0], '').trim(); break }
    }
  }

  // ── Priority: ! or urgency keywords → q1; "plan" or "schedule" → q2 ──────
  let quad: QuadKey | undefined
  if (/\b(!|urgent|asap|critical|now)\b/i.test(text)) {
    quad = 'q1'
    text = text.replace(/\b(!|urgent|asap|critical|now)\b/gi, '').trim()
  } else if (/\b(plan|schedule|important)\b/i.test(text)) {
    quad = 'q2'
    text = text.replace(/\b(plan|schedule|important)\b/gi, '').trim()
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

  return { title: title || raw.trim(), due, catId, quad, effort }
}

// ── Summary line for UI feedback ─────────────────────────────────────────────
export function nlSummary(r: NLResult, categories: Category[]): string {
  const parts: string[] = []
  if (r.due)    parts.push(r.due)
  if (r.catId)  parts.push(categories.find(c => c.id === r.catId)?.name ?? r.catId)
  if (r.quad === 'q1') parts.push('Urgent')
  if (r.quad === 'q2') parts.push('Important')
  if (r.effort) {
    const labels: Record<EffortKey, string> = { xs: '5m', s: '15m', m: '1h', l: '2h', xl: '6h', xxl: '1d' }
    parts.push(labels[r.effort])
  }
  return parts.join(' · ')
}
