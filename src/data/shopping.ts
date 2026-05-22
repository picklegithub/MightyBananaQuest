/**
 * shopping.ts — ShoppingItem CRUD.
 */

import type { ShoppingItem } from '../types'
import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'

export async function addShoppingItem(
  item: Omit<ShoppingItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ShoppingItem> {
  const now  = Date.now()
  const full: ShoppingItem = { ...item, id: `s${now}`, createdAt: now, updatedAt: now }
  await db.shoppingItems.add(full)
  enqueueUpsert('shopping_items', full.id, full)
  return full
}

export async function updateShoppingItem(id: string, patch: Partial<ShoppingItem>): Promise<void> {
  const updatedAt = Date.now()
  await db.shoppingItems.update(id, { ...patch, updatedAt })
  const updated = await db.shoppingItems.get(id)
  if (updated) enqueueUpsert('shopping_items', updated.id, updated)
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await db.shoppingItems.delete(id)
  enqueueDelete('shopping_items', id)
}

export async function deleteCheckedShoppingItems(): Promise<void> {
  const checked = await db.shoppingItems.filter(i => i.checked).primaryKeys()
  await db.shoppingItems.bulkDelete(checked)
  ;(checked as string[]).forEach(id => enqueueDelete('shopping_items', id))
}
