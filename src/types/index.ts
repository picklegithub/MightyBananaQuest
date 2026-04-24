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
  isHabit?: boolean   // first-class habit flag — logs to habitLog on completion
  status?: 'backlog' | 'someday' | 'active'  // Slow Productivity workflow state (undefined = backlog)
  createdAt?: number
  updatedAt?: number
}

// ── Habit (first-class — separate table from tasks) ──────────────────────────
// Recurring tasks stay in the tasks table. Habits are behavioural routines
// tracked by streak and daily/weekly check-in, never assigned a due date.
export interface Habit {
  id: string
  title: string
  cat: string           // area
  frequency: string     // 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'weekly on Mon' | etc.
  streak: number
  done: boolean         // completed today — reset daily by resetHabits()
  notes?: string
  time?: string         // optional reminder time 'HH:MM'
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
  // shared free-form notes
  notes?: string
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
  petIcon?: 'classic' | 'face' | 'paw'  // which pet icon style to use in areas
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

// ── Shopping item ─────────────────────────────────────────────────────────────
export interface ShoppingItem {
  id: string
  title: string
  category: string   // user-defined grouping label (e.g. "Produce", "Dairy")
  checked: boolean
  quantity?: string  // free-form: "2", "500g", "a bunch of"
  notes?: string
  store?: string     // which shop this item is for (e.g. "Coles", "Aldi")
  createdAt: number
  updatedAt: number
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
  | { name: 'all-habits' }
  | { name: 'inbox' }
  | { name: 'settings' }
  | { name: 'shopping-list' }
