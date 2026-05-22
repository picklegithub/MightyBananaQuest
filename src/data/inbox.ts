/**
 * inbox.ts — InboxItem CRUD (active capture inbox).
 */

import type { InboxItem } from '../types'
import { makeId } from '../lib/makeId'
import { db } from './schema'
import { enqueueUpsert } from '../lib/sync'

export async function createInboxItem(
  partial: Pick<InboxItem, 'text' | 'source'> & { sourceMeta?: InboxItem['sourceMeta'] }
): Promise<InboxItem> {
  const now  = Date.now()
  const item: InboxItem = {
    id:         makeId(),
    text:       partial.text,
    source:     partial.source,
    sourceMeta: partial.sourceMeta,
    createdAt:  now,
    updatedAt:  now,
    status:     'inbox',
  }
  await db.inboxItems.add(item)
  enqueueUpsert('inbox_items', item.id, item)
  return item
}

export async function countInbox(): Promise<number> {
  return db.inboxItems.where('status').equals('inbox').count()
}

export async function processInboxItem(
  id: string,
  status: 'converted' | 'someday' | 'archived',
  convertedTaskId?: string
): Promise<void> {
  const now   = Date.now()
  const patch: Partial<InboxItem> = { status, processedAt: now, updatedAt: now }
  if (convertedTaskId) patch.convertedTaskId = convertedTaskId
  await db.inboxItems.update(id, patch)
  const updated = await db.inboxItems.get(id)
  if (updated) enqueueUpsert('inbox_items', id, updated)
}

export async function revertInboxItem(id: string, status: 'inbox'): Promise<void> {
  const now = Date.now()
  await db.inboxItems.update(id, { status, updatedAt: now })
  // Use modify() to actually delete the optional fields — update() ignores undefined
  await db.inboxItems.where('id').equals(id).modify(item => {
    delete item.processedAt
    delete item.convertedTaskId
  })
  const updated = await db.inboxItems.get(id)
  if (updated) enqueueUpsert('inbox_items', id, updated)
}
