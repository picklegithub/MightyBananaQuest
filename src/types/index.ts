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

// QuadKey kept for database backward-compatibility — no longer shown in UI
export type QuadKey = 'q1' | 'q2' | 'q3' | 'q4'

// ── Sub-task ─────────────────────────────────────────────────────────────────
export interface SubTask {
  id?: string  // stable UUID for CRDT set-merge across devices
  t: string    // title
  d: boolean   // done
}

// ── Task ─────────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  cat: string
  title: string
  effort: EffortKey
  due: string
  streak: number
  quad: QuadKey
  recurring: string | null
  done: boolean
  sub: SubTask[]
  pomodoroMins?: number
  time?: string
  notes?: string
  isHabit?: boolean   // first-class habit flag — logs to habitLog on completion
  status?: 'backlog' | 'someday' | 'active'  // Slow Productivity workflow state (undefined = backlog)
  goalId?: string        // linked goal — surface its why on Task Detail
  reminderMin?: number  // minutes before due/time to notify; 0=on-time, 5/30/60/1440=early; undefined=none
  completedAt?: number  // ms timestamp when task was completed
  createdAt?: number
  updatedAt?: number
  deletedAt?: number  // soft-delete timestamp; present → record is a tombstone
  syncedAt?:  number  // server synced_at reflected back (used only for diagnostics)
}

// ── Habit (first-class — separate table from tasks) ──────────────────────────
// Recurring tasks stay in the tasks table. Habits are behavioural routines
// tracked by streak and daily/weekly check-in, never assigned a due date.
export interface Habit {
  id: string
  title: string
  cat?: string          // area — optional; habits without an area are ungrouped
  frequency: string     // 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'weekly on Mon' | etc.
  streak: number
  bestStreak: number    // all-time highest streak — preserved on reset, never decrements
  done: boolean         // completed today — reset daily by resetHabits()
  notes?: string
  time?: string         // optional reminder time 'HH:MM'
  strength?: number     // EMA adherence score 0.0–1.0; updated on each completion / miss
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime'  // time-of-day segment
  isArchived?: boolean  // paused without losing streak history
  why?: string          // personal intention — "Why this habit matters to me"
  goalId?: string       // optional link to a goal — surfaces "Building toward: [goal]" on completion
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
  priorityTaskIds?: (string | null)[]  // parallel to priorities[]; null = free-text slot
  // evening
  win?: string
  diff?: string          // "What got in the way?"
  diffFollowOn?: string  // "One thing I'd do differently."
  reframe?: string       // "One thing I'm thinking differently about after today…"
  lesson?: string
  tomorrow?: string
  energy?: 1 | 2 | 3        // 1=Low 2=Okay 3=Strong — powers Sustainability score
  impact?: 1 | 2 | 3 | 4    // 1=Minimal 2=Some 3=Solid 4=High — powers Productivity score
  // shared free-form notes
  notes?: string
  morningMood?: 'steady' | 'tired' | 'charged'  // mood tap at top of morning form
  xpAwarded?: boolean  // idempotency flag — XP awarded once per entry
}

// ── Inbox item ───────────────────────────────────────────────────────────────
export interface InboxItem {
  id: string
  text: string
  source: 'voice' | 'capture' | 'share' | 'email'
  sourceMeta?: {
    audioBlobId?: string
    transcriptConfidence?: number
    url?: string
  }
  createdAt: number
  updatedAt?: number
  processedAt?: number
  status: 'inbox' | 'converted' | 'someday' | 'archived'
  convertedTaskId?: string
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
  quietStart: number  // hour 0–23, default 22
  quietEnd:   number  // hour 0–23, default 7
}

export interface AppSettings {
  id: 1  // singleton row
  theme: 'light' | 'dark' | 'auto'
  // 'warm' and 'mono' are fixed palettes; 'custom' uses customPaletteHue (0–360)
  palette: 'warm' | 'mono' | 'custom'
  customPaletteHue?: number  // 0–360, only used when palette === 'custom'
  intensity: 'subtle' | 'balanced' | 'loud'
  defaultPomodoroMins: number
  notifications: NotificationPrefs
  onboarded: boolean
  xp: number
  streak: number
  lastActiveDate?: string   // ISO 'YYYY-MM-DD' — used to compute daily streak
  petIcon?: 'classic' | 'face' | 'paw'  // which pet icon style to use in areas
  showPlanYourDay?: boolean
  showInboxBadge?: boolean
  voiceCaptureToInbox?: boolean
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

// ── Daily Plan Ritual ─────────────────────────────────────────────────────────

/** Decision made about a leftover task in Step 1 (Yesterday's Reckoning). */
export interface Reckoning {
  taskId:         string
  action:         'today' | 'reschedule' | 'drop'
  rescheduledTo?: string   // ISO 'YYYY-MM-DD' — only present when action === 'reschedule'
}

/**
 * One row per calendar date, keyed on ISO date string ('YYYY-MM-DD').
 * Written when the user taps "Start the day" in Step 4.
 */
// ── Coping cards ─────────────────────────────────────────────────────────────
export type CopingCategory = 'anxiety' | 'social' | 'low-mood' | 'grounding' | 'values' | 'crisis' | 'mindfulness' | 'self-compassion'

export interface CopingCard {
  id: string
  title: string
  content: string
  category: CopingCategory
  isDefault: boolean   // true = shipped with app; false = user-created
  isPinned?: boolean   // the one card surfaced in Journal overlay
  createdAt: number
  updatedAt: number
}

export interface DailyPlan {
  date:          string        // primary key — 'YYYY-MM-DD'
  mood?:         'steady' | 'tired' | 'charged' | null  // Step 0 mood tap
  pickedIds:     string[]      // task IDs chosen in Step 3
  top3Ids:       string[]      // up to 3 IDs from Step 4 — pinned to Today
  reckonings:    Reckoning[]   // Step 1 decisions
  calBudgetMin:  number        // free minutes computed in Step 2 for the time bar
  completedAt:   number | null // ms timestamp when "Start the day" was tapped; null = in-progress
}

// ── Navigation ───────────────────────────────────────────────────────────────
export type Screen =
  | { name: 'splash' }
  | { name: 'onboarding' }
  | { name: 'dashboard' }
  | { name: 'daily-plan' }
  | { name: 'category'; catId: string }
  | { name: 'task'; taskId: string }
  | { name: 'goal'; goalId: string }
  | { name: 'calendar' }
  | { name: 'review' }
  | { name: 'goals' }
  | { name: 'journal'; phase?: 'morning' | 'evening' | 'history' }
  | { name: 'all-tasks' }
  | { name: 'all-habits' }
  | { name: 'habit-analytics' }
  | { name: 'inbox' }
  | { name: 'settings' }
  | { name: 'coping-cards' }
  | { name: 'progress' }
