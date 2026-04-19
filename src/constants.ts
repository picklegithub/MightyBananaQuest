import type { EffortKey, EffortDef, QuadKey, Category } from './types'

// ── Effort tiers ─────────────────────────────────────────────────────────────
export const EFFORT: Record<EffortKey, EffortDef> = {
  xs:  { label: 'Micro',      mins: 3,    xp: 3,   glyph: '●',       range: '1–5 min',    bar: 1 },
  s:   { label: 'Small',      mins: 15,   xp: 8,   glyph: '●●',      range: '6–30 min',   bar: 2 },
  m:   { label: 'Medium',     mins: 45,   xp: 18,  glyph: '●●●',     range: '31–60 min',  bar: 3 },
  l:   { label: 'Long',       mins: 150,  xp: 45,  glyph: '●●●●',    range: '1–4 hours',  bar: 4 },
  xl:  { label: 'Mammoth',    mins: 360,  xp: 90,  glyph: '●●●●●',   range: '4–8+ hrs',   bar: 5 },
  xxl: { label: 'Gargantuan', mins: 1440, xp: 220, glyph: '●●●●●●',  range: '1+ days',    bar: 6 },
}

export const EFFORT_ORDER: EffortKey[] = ['xs', 's', 'm', 'l', 'xl', 'xxl']

// ── Priority quadrants ───────────────────────────────────────────────────────
export const QUAD: Record<QuadKey, { label: string; short: string }> = {
  q1: { label: 'Urgent · Important',     short: 'Do' },
  q2: { label: 'Important · Not urgent', short: 'Schedule' },
  q3: { label: 'Urgent · Not important', short: 'Delegate' },
  q4: { label: 'Neither',               short: 'Drop' },
}

// ── Default categories ───────────────────────────────────────────────────────
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'home',     name: 'Home',     icon: 'home',      hue: 35  },
  { id: 'work',     name: 'Work',     icon: 'briefcase', hue: 240 },
  { id: 'health',   name: 'Health',   icon: 'heart',     hue: 145 },
  { id: 'finance',  name: 'Finance',  icon: 'dollar',    hue: 90  },
  { id: 'learning', name: 'Learning', icon: 'book',      hue: 280 },
  { id: 'family',   name: 'Family',   icon: 'family',    hue: 15  },
]

// ── Default settings ─────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  id: 1 as const,
  theme: 'light' as const,
  variant: 'warm' as const,
  intensity: 'loud' as const,
  defaultPomodoroMins: 25,
  notifications: {
    due: true, overdue: false, pom: true,
    journal: false, streak: true, weekly: true, quiet: true,
  },
  onboarded: false,
  xp: 0,
  streak: 0,
}
