import type { EffortKey, EffortDef, QuadKey, Category } from './types'

// ── Effort tiers ─────────────────────────────────────────────────────────────
export const EFFORT: Record<EffortKey, EffortDef> = {
  xs:  { label: 'Micro',      mins: 5,    xp: 3,   glyph: '●',       range: '1–5 min',    bar: 1 },
  s:   { label: 'Small',      mins: 15,   xp: 8,   glyph: '●●',      range: '6–30 min',   bar: 2 },
  m:   { label: 'Medium',     mins: 60,   xp: 18,  glyph: '●●●',     range: '31–60 min',  bar: 3 },
  l:   { label: 'Long',       mins: 120,  xp: 45,  glyph: '●●●●',    range: '1–4 hours',  bar: 4 },
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
  { id: 'health',          name: 'Health',          icon: 'heart',     hue: 145 },
  { id: 'finances',        name: 'Finances',        icon: 'dollar',    hue: 90  },
  { id: 'hobbies',         name: 'Hobbies',         icon: 'star',      hue: 280 },
  { id: 'personal-growth', name: 'Personal Growth', icon: 'book',      hue: 200 },
  { id: 'career-work',     name: 'Career / Work',   icon: 'briefcase', hue: 240 },
  { id: 'pets',            name: 'Pets',            icon: 'pet',       hue: 35  },
  { id: 'home',            name: 'Home',            icon: 'home',      hue: 25  },
]

// ── Default settings ─────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  id: 1 as const,
  theme: 'light' as const,
  variant: 'warm' as const,
  intensity: 'loud' as const,
  defaultPomodoroMins: 25,
  notifications: {
    due: true, overdue: true, pom: true,
    journal: true, streak: true, weekly: true, quiet: false,
  },
  onboarded: false,
  xp: 0,
  streak: 0,
}
