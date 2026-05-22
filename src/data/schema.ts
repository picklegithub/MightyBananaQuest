/**
 * schema.ts — Dexie class, all migration versions, db singleton, seed.
 *
 * Keep this file focused on:
 *   - Table declarations
 *   - Version history + upgrade callbacks
 *   - The `db` singleton
 *   - The 'ready' seed callback
 *
 * Business logic lives in domain modules: tasks.ts, habits.ts, etc.
 */

import Dexie, { type Table } from 'dexie'
import type {
  Task, Habit, Category, Goal, JournalEntry, InboxItem,
  AppSettings, WeeklyReview, ShoppingItem, DailyPlan, CopingCard, MoodEntry,
  Workspace, WorkspaceMember,
} from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../constants'
import { SEED_TASKS, SEED_GOALS, SEED_JOURNAL, SEED_COPING_CARDS } from './seeds'

// ── Interface types exported for use by domain modules ────────────────────────

/** Habit check-in log — one row per (habit, date) */
export interface HabitLog {
  id:     string   // `${taskId}:${dateStr}`
  taskId: string
  date:   string   // 'YYYY-MM-DD'
}

/** Soft-delete tombstone — tracks deleted tasks so pulls don't resurrect them */
export interface DeletedTask {
  id:        string
  deletedAt: number
}

/**
 * Completion tombstone — protects completed tasks from being re-opened by a
 * stale server pull that arrives before done=true drains from the outbox.
 * Written by completeTask(); checked in the pull LWW guard in sync.ts.
 */
export interface CompletedTask {
  id:          string
  completedAt: number
}

/**
 * Outbox entry — pending sync operation.
 * key = `${table}:${recordId}` — PK ensures automatic dedup so rapid edits
 * to the same record only produce a single outbox entry.
 */
export interface OutboxEntry {
  key:            string               // `${table}:${recordId}`
  table:          string
  recordId:       string
  op:             'upsert' | 'delete'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?:          any                  // full local record for upsert
  queuedAt:       number
  attempts:       number
  nextRetryAt:    number
  lastError?:     string
  idempotencyKey: string              // UUID — prevents duplicate server writes on retry
  deadLettered?:  boolean             // true after MAX_OUTBOX_ATTEMPTS — stops retrying
  changedFields?: string[]            // fields modified in this edit (for field-level LWW merge)
}

// ── DB class ──────────────────────────────────────────────────────────────────

export class MightyBananaQuestDB extends Dexie {
  tasks!:             Table<Task>
  habits!:            Table<Habit>
  categories!:        Table<Category>
  goals!:             Table<Goal>
  journal!:           Table<JournalEntry>
  inboxItems!:        Table<InboxItem>
  settings!:          Table<AppSettings>
  habitLog!:          Table<HabitLog>
  weeklyReviews!:     Table<WeeklyReview>
  deletedTasks!:      Table<DeletedTask>
  completedTasks!:    Table<CompletedTask>
  shoppingItems!:     Table<ShoppingItem>
  outbox!:            Table<OutboxEntry>
  dailyPlans!:        Table<DailyPlan>
  copingCards!:       Table<CopingCard>
  moodEntries!:       Table<MoodEntry>
  workspaces!:        Table<Workspace>
  workspaceMembers!:  Table<WorkspaceMember>

  constructor() {
    // ── Version history ───────────────────────────────────────────────────────
    // v1–v11 accumulated during development; collapsed into v12 since the app
    // has not launched publicly. Dev installs on v1–v11: open DevTools →
    // Application → IndexedDB → delete "MightyBananaQuestDB", then refresh.
    super('MightyBananaQuestDB')

    // ── v12 — canonical pre-launch schema ────────────────────────────────────
    this.version(12).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
    }).upgrade(async tx => {
      // Absorbed from v8: migrate isHabit tasks → habits table
      const habitTasks: Task[] = await tx.table('tasks').filter((t: Task) => !!t.isHabit).toArray()
      if (habitTasks.length > 0) {
        const habits: Habit[] = habitTasks.map(t => ({
          id:         t.id,
          title:      t.title,
          cat:        t.cat,
          frequency:  t.recurring ?? 'daily',
          streak:     t.streak ?? 0,
          bestStreak: t.streak ?? 0,
          done:       t.done ?? false,
          notes:      t.notes,
          time:       t.time,
          createdAt:  t.createdAt ?? Date.now(),
          updatedAt:  t.updatedAt ?? Date.now(),
        }))
        await tx.table('habits').bulkAdd(habits)
        await tx.table('tasks').bulkDelete(habitTasks.map((t: Task) => t.id))
      }
      // Absorbed from v11: rename settings.variant → settings.palette
      const s = await tx.table('settings').get(1)
      if (s && s.variant && !s.palette) {
        const palette = s.variant === 'strict' ? 'mono' : 'warm'
        await tx.table('settings').update(1, { palette, variant: undefined })
      }
      // Seed bestStreak for habits that didn't have it
      const existingHabits: Habit[] = await tx.table('habits').toArray()
      for (const h of existingHabits) {
        if (h.bestStreak === undefined) {
          await tx.table('habits').update(h.id, { bestStreak: h.streak ?? 0 })
        }
      }
    })

    // ── v13 — strength/timeOfDay/isArchived on habits ────────────────────────
    this.version(13).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status, availableFrom',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
    }).upgrade(async tx => {
      const habits: Habit[] = await tx.table('habits').toArray()
      for (const h of habits) {
        if (h.strength === undefined) {
          await tx.table('habits').update(h.id, { strength: 0.5 })
        }
      }
    })

    // ── v14 — adds copingCards table ─────────────────────────────────────────
    this.version(14).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status, availableFrom',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id',
    })

    // ── v15 — removes availableFrom index from tasks ─────────────────────────
    this.version(15).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id',
    })

    // ── v16 — copingCards: singleton → deck ──────────────────────────────────
    this.version(16).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id, category, isPinned',
    }).upgrade(async tx => {
      await tx.table('copingCards').clear()
      await tx.table('copingCards').bulkAdd(SEED_COPING_CARDS)
    })

    // ── v17 — tasks: add completedAt index ───────────────────────────────────
    this.version(17).stores({
      tasks:         'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:    'id',
      goals:         'id, area',
      journal:       'id, date, kind',
      inbox:         'id, kind, processed',
      settings:      'id',
      habitLog:      'id, taskId, date',
      weeklyReviews: 'id, weekStart, completedAt',
      deletedTasks:  'id, deletedAt',
      shoppingItems: 'id, category, createdAt',
      habits:        'id, cat, done, createdAt, isArchived',
      outbox:        'key, table, queuedAt, nextRetryAt',
      dailyPlans:    'date, completedAt',
      copingCards:   'id, category, isPinned',
    })

    // ── v18 — add completedTasks tombstone table ──────────────────────────────
    this.version(18).stores({
      tasks:          'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      inbox:          'id, kind, processed',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
    })

    // ── v19 — add inboxItems table ────────────────────────────────────────────
    this.version(19).stores({
      tasks:          'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      inbox:          'id, kind, processed',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
      inboxItems:     'id, status, createdAt, source',
    })

    // ── v20 — drop legacy inbox table (replaced by inboxItems) ───────────────
    this.version(20).stores({
      tasks:          'id, cat, due, done, effort, quad, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      inbox:          null,
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
      inboxItems:     'id, status, createdAt, source',
    })

    // ── v21 — drop `quad` from tasks index (field kept for backward compat) ─────
    // The Eisenhower Matrix was removed from the UI. `quad` is now optional on
    // Task and is no longer set by any creator. Existing data preserves whatever
    // quad value is stored; new tasks omit the field entirely. The index is
    // dropped because no query in the codebase uses it.
    this.version(21).stores({
      tasks:          'id, cat, due, done, effort, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
      inboxItems:     'id, status, createdAt, source',
    })

    // ── v22 — JournalEntry.moodScore (Phase 4: optional 1–10 mood score) ─────
    // No new Dexie index needed — field is stored in the journal object.
    // Version bump registers the type extension so the upgrade path is clean.
    this.version(22).stores({
      tasks:          'id, cat, due, done, effort, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
      inboxItems:     'id, status, createdAt, source',
    })

    // ── v23 — moodEntries table (Phase 4 mood tracker: 5-point scale) ────────
    // Replaces morningMood on JournalEntry and energy/moodScore fields.
    // Compound index [date+source] enables O(1) journal source lookups.
    this.version(23).stores({
      tasks:          'id, cat, due, done, effort, createdAt, status, completedAt',
      categories:     'id',
      goals:          'id, area',
      journal:        'id, date, kind',
      settings:       'id',
      habitLog:       'id, taskId, date',
      weeklyReviews:  'id, weekStart, completedAt',
      deletedTasks:   'id, deletedAt',
      completedTasks: 'id, completedAt',
      shoppingItems:  'id, category, createdAt',
      habits:         'id, cat, done, createdAt, isArchived',
      outbox:         'key, table, queuedAt, nextRetryAt',
      dailyPlans:     'date, completedAt',
      copingCards:    'id, category, isPinned',
      inboxItems:     'id, status, createdAt, source',
      moodEntries:    'id, date, source, mood, energy, createdAt, [date+source]',
    })

    // v24 — tasks gain workspaceId index; outbox schema unchanged (changedFields in data)
    this.version(24).stores({
      tasks: 'id, cat, due, done, effort, createdAt, status, completedAt, workspaceId',
    })

    // v25 — workspaces + workspace_members tables
    this.version(25).stores({
      workspaces:       'id, ownerId, createdAt',
      workspaceMembers: '[workspaceId+userId], workspaceId, userId',
    })
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
export const db = new MightyBananaQuestDB()

// ── Seed on first run ─────────────────────────────────────────────────────────
db.on('ready', async () => {
  const count = await db.settings.count()
  if (count > 0) return  // already seeded

  await db.transaction('rw', [db.settings, db.categories, db.tasks, db.goals, db.journal, db.copingCards], async () => {
    await db.settings.add(DEFAULT_SETTINGS)
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    await db.tasks.bulkAdd(SEED_TASKS)
    await db.goals.bulkAdd(SEED_GOALS)
    await db.journal.bulkAdd(SEED_JOURNAL)
    await db.copingCards.bulkAdd(SEED_COPING_CARDS)
  })
})
