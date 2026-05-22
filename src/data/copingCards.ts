/**
 * copingCards.ts — CopingCard CRUD.
 */

import type { CopingCard, CopingCategory } from '../types'
import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'

export async function getAllCopingCards(category?: CopingCategory): Promise<CopingCard[]> {
  if (category) return db.copingCards.where('category').equals(category).toArray()
  return db.copingCards.toArray()
}

export async function getPinnedCard(): Promise<CopingCard | null> {
  const pinned = await db.copingCards.where('isPinned').equals(1).first()
  return pinned ?? null
}

export async function addCopingCard(card: Omit<CopingCard, 'createdAt' | 'updatedAt'>): Promise<void> {
  const now  = Date.now()
  const full = { ...card, createdAt: now, updatedAt: now }
  await db.copingCards.add(full)
  if (!card.isDefault) enqueueUpsert('coping_cards', card.id, full)
}

export async function updateCopingCard(id: string, patch: Partial<CopingCard>): Promise<void> {
  const now = Date.now()
  await db.copingCards.update(id, { ...patch, updatedAt: now })
  const updated = await db.copingCards.get(id)
  if (updated && !updated.isDefault) enqueueUpsert('coping_cards', id, updated)
}

export async function deleteCopingCard(id: string): Promise<void> {
  const card = await db.copingCards.get(id)
  await db.copingCards.delete(id)
  if (card && !card.isDefault) enqueueDelete('coping_cards', id)
}

export async function pinCopingCard(id: string): Promise<void> {
  const now       = Date.now()
  const allPinned = await db.copingCards.where('isPinned').equals(1).toArray()
  await Promise.all(allPinned.map(c => db.copingCards.update(c.id, { isPinned: false, updatedAt: now })))
  await db.copingCards.update(id, { isPinned: true, updatedAt: now })

  for (const c of allPinned) {
    const updated = await db.copingCards.get(c.id)
    if (updated && !updated.isDefault) enqueueUpsert('coping_cards', c.id, updated)
  }
  const pinned = await db.copingCards.get(id)
  if (pinned && !pinned.isDefault) enqueueUpsert('coping_cards', id, pinned)
}
