/**
 * journal.ts — JournalEntry CRUD.
 */

import type { JournalEntry } from '../types'
import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'
import { recordDailyActivity } from './settings'

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  const existing = await db.journal.get(entry.id)
  let toSave     = entry

  // Award +5 XP once per entry when it first has substantive content
  if (!existing?.xpAwarded) {
    const hasContent = entry.kind === 'morning'
      ? !!(entry.intention?.trim() || entry.priorities?.some(p => p?.trim()))
      : !!(entry.win?.trim() || entry.diff?.trim())

    if (hasContent) {
      const settings = await db.settings.get(1)
      if (settings) {
        await db.settings.update(1, { xp: (settings.xp ?? 0) + 5 })
        const updated = await db.settings.get(1)
        if (updated) enqueueUpsert('settings', String(updated.id), updated)
      }
      toSave = { ...entry, xpAwarded: true }
    }
  } else {
    toSave = { ...entry, xpAwarded: true }
  }

  await db.journal.put(toSave)
  enqueueUpsert('journal', toSave.id, toSave)
  await recordDailyActivity()
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  await db.journal.delete(entryId)
  enqueueDelete('journal', entryId)
}
