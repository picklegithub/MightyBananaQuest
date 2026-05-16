import type { EffortKey, EffortDef, Category } from './types'

// ── Effort tiers — 6-tier system ─────────────────────────────────────────────
export const EFFORT: Record<EffortKey, EffortDef> = {
  xs:  { label: 'Micro',      mins: 5,    xp: 5,  glyph: '●',       range: '1–5m',  bar: 1 },
  s:   { label: 'Small',      mins: 15,   xp: 10, glyph: '●●',      range: '15m',   bar: 1 },
  m:   { label: 'Medium',     mins: 60,   xp: 15, glyph: '●●●',     range: '1h',    bar: 2 },
  l:   { label: 'Long',       mins: 120,  xp: 25, glyph: '●●●●',    range: '2h',    bar: 3 },
  xl:  { label: 'Mammoth',    mins: 360,  xp: 40, glyph: '●●●●●',   range: '6h',    bar: 4 },
  xxl: { label: 'Gargantuan', mins: 480,  xp: 60, glyph: '●●●●●●',  range: '1d+',   bar: 5 },
}

// All 6 tiers shown in UI
export const EFFORT_ORDER: EffortKey[] = ['xs', 's', 'm', 'l', 'xl', 'xxl']
export const EFFORT_LABELS: Record<string, string> = {
  xs: 'Micro', s: 'Small', m: 'Medium', l: 'Long', xl: 'Mammoth', xxl: 'Gargantuan',
}

// ── Default categories ───────────────────────────────────────────────────────
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'health',   name: 'Health',   icon: 'heart',   hue: 145 },
  { id: 'finances', name: 'Finances', icon: 'dollar',  hue: 90  },
  { id: 'home',     name: 'Home',     icon: 'home',    hue: 25  },
  { id: 'hobbies',  name: 'Hobbies',  icon: 'star',    hue: 280 },
  { id: 'wellness', name: 'Wellness', icon: 'leaf',    hue: 160 },
]

// ── Default settings ─────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  id: 1 as const,
  theme: 'light' as const,
  palette: 'warm' as const,
  customPaletteHue: 215,       // only used when palette === 'custom'
  intensity: 'balanced' as const,
  defaultPomodoroMins: 25,
  petIcon: 'paw' as const,
  notifications: {
    due: true, overdue: true, pom: true,
    journal: true, streak: true, weekly: true,
    quiet: true, quietStart: 22, quietEnd: 7,
  },
  onboarded: false,
  xp: 0,
  streak: 0,
  showPlanYourDay: true,
  showInboxBadge: true,
  voiceCaptureToInbox: true,
}
