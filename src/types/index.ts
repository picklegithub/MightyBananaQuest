// ── Effort ──────────────────────────────────────────────────────────────────
export type EffortKey = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'

export interface EffortDef {
  label: string
  mins: number
  xp: number
  glyph: string
  range: string
  bar: number
}

// ── Priority quadrant (7 Habits / Eisenhower) ────────────────────────────────
export type QuadKey = 'q1' | 'q2' | 'q3' | 'q4'

// ── Sub-task ─────────────────────────────────────────────────────────────────
export interface SubTask {
  t: string   // title
  d: boolean  // done
}

// ── Task ─────────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  cat: string
  title: string
  effort: EffortKey
  due: string
  streak: number
  ctx: string
  quad: QuadKey
  recurring: string | null
  done: boolean
  sub: SubTask[]
  pomodoroMins?: number
  time?: string
  notes?: string
  createdAt?: number
  updatedAt?: number
}

// ── Category ─────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  icon: string
  hue: number
}

// ── Goal ─────────────────────────────────────────────────────────────────────
export interface Goal {
  id: string
  title: string
  area: string
  horizon: string
  progress: number
  why: string
  linked: string[]
}

// ── Journal entry ────────────────────────────────────────────────────────────
export interface JournalEntry {
  id: string
  date: string
  kind: 'morning' | 'evening'
  // morning
  gratitude?: string[]
  intention?: string
  priorities?: string[]
  // evening
  win?: string
  diff?: string
  lesson?: string
  tomorrow?: string
}

// ── Inbox item ───────────────────────────────────────────────────────────────
export interface InboxItem {
  id: string
  kind: 'capture' | 'rss' | 'email'
  source?: string
  text: string
  when: string
  processed: boolean
}

// ── Settings ─────────────────────────────────────────────────────────────────
export interface NotificationPrefs {
  due: boolean
  overdue: boolean
  pom: boolean
  journal: boolean
  streak: boolean
  weekly: boolean
  quiet: boolean
}

export interface AppSettings {
  id: 1  // singleton row
  theme: 'light' | 'dark' | 'auto'
  variant: 'warm' | 'strict'
  intensity: 'subtle' | 'balanced' | 'loud'
  defaultPomodoroMins: number
  notifications: NotificationPrefs
  onboarded: boolean
  xp: number
  streak: number
}

// ── Weekly Review ────────────────────────────────────────────────────────────
export type GoalPulseStatus = 'on-track' | 'needs-attention' | 'pausing'

export interface GoalPulse {
  goalId: string
  status: GoalPulseStatus
}

export interface WeeklyReview {
  id: string
  weekStart: string   // ISO 'YYYY-MM-DD' Monday
  weekEnd: string     // ISO 'YYYY-MM-DD' Sunday
  // Stats snapshotted at review time
  tasksCompleted: number
  xpGained: number
  journalDays: number
  quadCounts: { q1: number; q2: number; q3: number; q4: number }
  // User inputs
  wins: string[]
  goalPulse: GoalPulse[]
  nextWeekThing: string
  // Meta
  completedAt?: number
  updatedAt?: number
}

// ── Navigation ───────────────────────────────────────────────────────────────
export type Screen =
  | { name: 'splash' }
  | { name: 'onboarding' }
  | { name: 'dashboard' }
  | { name: 'category'; catId: string }
  | { name: 'task'; taskId: string }
  | { name: 'add' }
  | { name: 'schedule'; taskId: string }
  | { name: 'progress' }
  | { name: 'calendar' }
  | { name: 'review' }
  | { name: 'goals' }
  | { name: 'journal'; phase?: 'morning' | 'evening' | 'history' }
  | { name: 'all-tasks' }
  | { name: 'inbox' }
  | { name: 'settings' }
