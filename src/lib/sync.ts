/**
 * sync.ts — Supabase ↔ Dexie hybrid sync
 *
 * Strategy:
 *  - All writes go to Dexie first (instant local feedback)
 *  - Then mirror to Supabase (fire-and-forget, retried on next pull)
 *  - On sign-in / app start: pull all remote rows, merge with last-write-wins
 *  - Realtime subscriptions push remote changes back into Dexie
 */

import { supabase } from './supabase'
import { db } from '../data/db'
import type { Task, Goal, JournalEntry, InboxItem, Category, AppSettings } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString() }

export async function getUserIdAsync(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// ── Task serialisation ────────────────────────────────────────────────────────

function taskToRow(task: Task, userId: string) {
  return {
    id:            task.id,
    user_id:       userId,
    cat:           task.cat,
    title:         task.title,
    effort:        task.effort,
    due:           task.due,
    streak:        task.streak,
    ctx:           task.ctx,
    quad:          task.quad,
    recurring:     task.recurring,
    done:          task.done,
    sub:           task.sub,
    pomodoro_mins: task.pomodoroMins ?? null,
    time:          task.time ?? null,
    notes:         task.notes ?? null,
    created_at:    task.createdAt ?? null,
    // Use local updatedAt when available so LWW works correctly in both directions
    updated_at:    task.updatedAt ? new Date(task.updatedAt).toISOString() : now(),
  }
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id:           row.id as string,
    cat:          (row.cat as string) ?? '',
    title:        (row.title as string) ?? '',
    effort:       (row.effort as Task['effort']) ?? 's',
    due:          (row.due as string) ?? 'Today',
    streak:       (row.streak as number) ?? 0,
    ctx:          (row.ctx as string) ?? '',
    quad:         (row.quad as Task['quad']) ?? 'q2',
    recurring:    (row.recurring as string | null) ?? null,
    done:         (row.done as boolean) ?? false,
    sub:          (row.sub as Task['sub']) ?? [],
    pomodoroMins: (row.pomodoro_mins as number | undefined) ?? undefined,
    time:         (row.time as string | undefined) ?? undefined,
    notes:        (row.notes as string | undefined) ?? undefined,
    createdAt:    (row.created_at as number | undefined) ?? undefined,
    updatedAt:    row.updated_at ? new Date(row.updated_at as string).getTime() : undefined,
  }
}

// ── Goal serialisation ────────────────────────────────────────────────────────

function goalToRow(goal: Goal, userId: string) {
  return {
    id:         goal.id,
    user_id:    userId,
    title:      goal.title,
    area:       goal.area,
    horizon:    goal.horizon,
    progress:   goal.progress,
    why:        goal.why,
    linked:     goal.linked,
    updated_at: now(),
  }
}

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id:       row.id as string,
    title:    (row.title as string) ?? '',
    area:     (row.area as string) ?? '',
    horizon:  (row.horizon as string) ?? '',
    progress: (row.progress as number) ?? 0,
    why:      (row.why as string) ?? '',
    linked:   (row.linked as string[]) ?? [],
  }
}

// ── Journal serialisation ─────────────────────────────────────────────────────

function journalToRow(entry: JournalEntry, userId: string) {
  return {
    id:         entry.id,
    user_id:    userId,
    date:       entry.date,
    kind:       entry.kind,
    gratitude:  entry.gratitude ?? null,
    intention:  entry.intention ?? null,
    priorities: entry.priorities ?? null,
    win:        entry.win ?? null,
    diff:       entry.diff ?? null,
    lesson:     entry.lesson ?? null,
    tomorrow:   entry.tomorrow ?? null,
    updated_at: now(),
  }
}

function rowToJournal(row: Record<string, unknown>): JournalEntry {
  return {
    id:         row.id as string,
    date:       (row.date as string) ?? '',
    kind:       (row.kind as JournalEntry['kind']) ?? 'morning',
    gratitude:  (row.gratitude as string[] | undefined) ?? undefined,
    intention:  (row.intention as string | undefined) ?? undefined,
    priorities: (row.priorities as string[] | undefined) ?? undefined,
    win:        (row.win as string | undefined) ?? undefined,
    diff:       (row.diff as string | undefined) ?? undefined,
    lesson:     (row.lesson as string | undefined) ?? undefined,
    tomorrow:   (row.tomorrow as string | undefined) ?? undefined,
  }
}

// ── Inbox serialisation ───────────────────────────────────────────────────────

function inboxToRow(item: InboxItem, userId: string) {
  return {
    id:         item.id,
    user_id:    userId,
    kind:       item.kind,
    source:     item.source ?? null,
    text:       item.text,
    when_ts:    item.when,
    processed:  item.processed,
    updated_at: now(),
  }
}

function rowToInbox(row: Record<string, unknown>): InboxItem {
  return {
    id:        row.id as string,
    kind:      (row.kind as InboxItem['kind']) ?? 'capture',
    source:    (row.source as string | undefined) ?? undefined,
    text:      (row.text as string) ?? '',
    when:      (row.when_ts as string) ?? '',
    processed: (row.processed as boolean) ?? false,
  }
}

// ── Category serialisation ────────────────────────────────────────────────────

function categoryToRow(cat: Category, userId: string) {
  return {
    id:         cat.id,
    user_id:    userId,
    name:       cat.name,
    icon:       cat.icon,
    hue:        cat.hue,
    updated_at: now(),
  }
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id:   row.id as string,
    name: (row.name as string) ?? '',
    icon: (row.icon as string) ?? '',
    hue:  (row.hue as number) ?? 200,
  }
}

// ── Settings serialisation ────────────────────────────────────────────────────

function settingsToRow(s: AppSettings, userId: string) {
  return {
    user_id:               userId,
    theme:                 s.theme,
    variant:               s.variant,
    intensity:             s.intensity,
    default_pomodoro_mins: s.defaultPomodoroMins,
    notifications:         s.notifications,
    onboarded:             s.onboarded,
    xp:                    s.xp,
    streak:                s.streak,
    updated_at:            now(),
  }
}

function rowToSettings(row: Record<string, unknown>): Partial<AppSettings> {
  return {
    theme:               (row.theme as AppSettings['theme']) ?? 'auto',
    variant:             (row.variant as AppSettings['variant']) ?? 'warm',
    intensity:           (row.intensity as AppSettings['intensity']) ?? 'balanced',
    defaultPomodoroMins: (row.default_pomodoro_mins as number) ?? 25,
    notifications:       (row.notifications as AppSettings['notifications']),
    onboarded:           (row.onboarded as boolean) ?? false,
    xp:                  (row.xp as number) ?? 0,
    streak:              (row.streak as number) ?? 0,
  }
}

// ── Full pull (on sign-in or app start) ───────────────────────────────────────

export async function pullAll(): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return

  const [
    { data: remoteTasks },
    { data: remoteGoals },
    { data: remoteJournal },
    { data: remoteInbox },
    { data: remoteCategories },
    { data: remoteSettings },
  ] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('goals').select('*').eq('user_id', userId),
    supabase.from('journal').select('*').eq('user_id', userId),
    supabase.from('inbox').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
  ])

  // Tasks
  if (remoteTasks && remoteTasks.length > 0) {
    const localTasks = await db.tasks.toArray()
    const localMap = new Map(localTasks.map(t => [t.id, t]))
    const toUpsert: Task[] = []

    for (const row of remoteTasks) {
      const local = localMap.get(row.id as string)
      const remoteTime = new Date(row.updated_at as string).getTime()
      const localTime = (local as (Task & { updatedAt?: number }) | undefined)?.updatedAt ?? 0
      if (!local || remoteTime > localTime) {
        toUpsert.push(rowToTask(row as Record<string, unknown>))
      }
    }
    if (toUpsert.length > 0) await db.tasks.bulkPut(toUpsert)
  }

  // Goals
  if (remoteGoals && remoteGoals.length > 0) {
    const localGoals = await db.goals.toArray()
    const localMap = new Map(localGoals.map(g => [g.id, g]))
    const toUpsert: Goal[] = []
    for (const row of remoteGoals) {
      const local = localMap.get(row.id as string)
      const remoteTime = new Date(row.updated_at as string).getTime()
      const localTime = (local as (Goal & { updatedAt?: number }) | undefined)?.updatedAt ?? 0
      if (!local || remoteTime > localTime) {
        toUpsert.push(rowToGoal(row as Record<string, unknown>))
      }
    }
    if (toUpsert.length > 0) await db.goals.bulkPut(toUpsert)
  }

  // Journal
  if (remoteJournal && remoteJournal.length > 0) {
    const localJournal = await db.journal.toArray()
    const localMap = new Map(localJournal.map(j => [j.id, j]))
    const toUpsert: JournalEntry[] = []
    for (const row of remoteJournal) {
      const local = localMap.get(row.id as string)
      const remoteTime = new Date(row.updated_at as string).getTime()
      const localTime = (local as (JournalEntry & { updatedAt?: number }) | undefined)?.updatedAt ?? 0
      if (!local || remoteTime > localTime) {
        toUpsert.push(rowToJournal(row as Record<string, unknown>))
      }
    }
    if (toUpsert.length > 0) await db.journal.bulkPut(toUpsert)
  }

  // Inbox
  if (remoteInbox && remoteInbox.length > 0) {
    const localInbox = await db.inbox.toArray()
    const localMap = new Map(localInbox.map(i => [i.id, i]))
    const toUpsert: InboxItem[] = []
    for (const row of remoteInbox) {
      const local = localMap.get(row.id as string)
      const remoteTime = new Date(row.updated_at as string).getTime()
      const localTime = (local as (InboxItem & { updatedAt?: number }) | undefined)?.updatedAt ?? 0
      if (!local || remoteTime > localTime) {
        toUpsert.push(rowToInbox(row as Record<string, unknown>))
      }
    }
    if (toUpsert.length > 0) await db.inbox.bulkPut(toUpsert)
  }

  // Categories
  if (remoteCategories && remoteCategories.length > 0) {
    const toUpsert = remoteCategories.map(r => rowToCategory(r as Record<string, unknown>))
    await db.categories.bulkPut(toUpsert)
  }

  // Settings (single row)
  if (remoteSettings) {
    const patch = rowToSettings(remoteSettings as Record<string, unknown>)
    await db.settings.update(1, patch)
  }
}

// ── Push individual records ───────────────────────────────────────────────────

export async function pushTask(task: Task): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('tasks').upsert(taskToRow(task, userId), { onConflict: 'id' })
}

export async function pushTaskDelete(taskId: string): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId)
}

export async function pushTasksDelete(taskIds: string[]): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('tasks').delete().in('id', taskIds).eq('user_id', userId)
}

export async function pushGoal(goal: Goal): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('goals').upsert(goalToRow(goal, userId), { onConflict: 'id' })
}

export async function pushGoalDelete(goalId: string): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('goals').delete().eq('id', goalId).eq('user_id', userId)
}

export async function pushJournal(entry: JournalEntry): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('journal').upsert(journalToRow(entry, userId), { onConflict: 'id' })
}

export async function pushInbox(item: InboxItem): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('inbox').upsert(inboxToRow(item, userId), { onConflict: 'id' })
}

export async function pushCategory(cat: Category): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('categories').upsert(categoryToRow(cat, userId), { onConflict: 'id' })
}

export async function pushCategoryDelete(catId: string): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('categories').delete().eq('id', catId).eq('user_id', userId)
}

export async function pushSettings(settings: AppSettings): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return
  await supabase.from('settings').upsert(settingsToRow(settings, userId), { onConflict: 'user_id' })
}

export async function pushAllLocal(): Promise<void> {
  const userId = await getUserIdAsync()
  if (!userId) return

  const [tasks, goals, journal, inbox, categories, settings] = await Promise.all([
    db.tasks.toArray(),
    db.goals.toArray(),
    db.journal.toArray(),
    db.inbox.toArray(),
    db.categories.toArray(),
    db.settings.get(1),
  ])

  await Promise.all([
    tasks.length     ? supabase.from('tasks').upsert(tasks.map(t => taskToRow(t, userId)), { onConflict: 'id' }) : null,
    goals.length     ? supabase.from('goals').upsert(goals.map(g => goalToRow(g, userId)), { onConflict: 'id' }) : null,
    journal.length   ? supabase.from('journal').upsert(journal.map(j => journalToRow(j, userId)), { onConflict: 'id' }) : null,
    inbox.length     ? supabase.from('inbox').upsert(inbox.map(i => inboxToRow(i, userId)), { onConflict: 'id' }) : null,
    categories.length ? supabase.from('categories').upsert(categories.map(c => categoryToRow(c, userId)), { onConflict: 'id' }) : null,
    settings          ? supabase.from('settings').upsert(settingsToRow(settings, userId), { onConflict: 'user_id' }) : null,
  ])
}

// ── Realtime subscriptions ────────────────────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

export function startRealtime(userId: string): void {
  if (realtimeChannel) return  // already subscribed

  realtimeChannel = supabase
    .channel(`mbq-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.tasks.delete((payload.old as { id: string }).id)
        } else {
          const task = rowToTask(payload.new as Record<string, unknown>)
          await db.tasks.put(task)
        }
      }
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.goals.delete((payload.old as { id: string }).id)
        } else {
          await db.goals.put(rowToGoal(payload.new as Record<string, unknown>))
        }
      }
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'journal', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          await db.journal.delete((payload.old as { id: string }).id)
        } else {
          await db.journal.put(rowToJournal(payload.new as Record<string, unknown>))
        }
      }
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (payload.eventType !== 'DELETE') {
          const patch = rowToSettings(payload.new as Record<string, unknown>)
          await db.settings.update(1, patch)
        }
      }
    )
    .subscribe()
}

export function stopRealtime(): void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}
