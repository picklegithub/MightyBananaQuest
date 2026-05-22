/**
 * moodEntries.ts — CRUD for the moodEntries table.
 *
 * Primary store for the Phase 4 mood tracker (5-point scale + energy +
 * influences + emotions + note). One entry per source per date for journal
 * sources; multiple entries allowed for 'standalone'.
 */

import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'
import type { MoodEntry, MoodSource } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Save / upsert ─────────────────────────────────────────────────────────────

/**
 * Upsert a mood entry.
 * - For journal sources (morning-journal / evening-journal): one per date per source.
 *   If a matching entry already exists its id is reused so edits stay idempotent.
 * - For 'standalone': always inserts (multiple allowed per day).
 */
export async function saveMoodEntry(entry: MoodEntry): Promise<MoodEntry> {
  const now = Date.now()
  const record: MoodEntry = { ...entry, updatedAt: now, time: entry.time || nowHHMM() }
  await db.moodEntries.put(record)
  enqueueUpsert('mood_entries', record.id, record)
  return record
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Get the single mood entry for a journal source on a given date. */
export async function getMoodEntryForSource(
  date: string,
  source: Exclude<MoodSource, 'standalone'>,
): Promise<MoodEntry | undefined> {
  return db.moodEntries
    .where('[date+source]')
    .equals([date, source])
    .first()
}

/** Get all mood entries for a date (includes multiple standalone entries). */
export async function getMoodEntriesForDate(date: string): Promise<MoodEntry[]> {
  return db.moodEntries.where('date').equals(date).sortBy('time')
}

/** Get mood entries in a date range, sorted oldest first. */
export async function getMoodEntriesInRange(start: string, end: string): Promise<MoodEntry[]> {
  return db.moodEntries.where('date').between(start, end, true, true).sortBy('date')
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteMoodEntry(id: string): Promise<void> {
  const record = await db.moodEntries.get(id)
  await db.moodEntries.delete(id)
  enqueueDelete('mood_entries', id, record)
}
