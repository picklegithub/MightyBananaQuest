/**
 * categories.ts — Category (Area) CRUD.
 */

import type { Category } from '../types'
import { db } from './schema'
import { enqueueUpsert, enqueueDelete } from '../lib/sync'

export async function addCategory(cat: Category): Promise<void> {
  await db.categories.add(cat)
  enqueueUpsert('categories', cat.id, cat)
}

export async function updateCategory(catId: string, patch: Partial<Category>): Promise<void> {
  await db.categories.update(catId, patch)
  const updated = await db.categories.get(catId)
  if (updated) enqueueUpsert('categories', updated.id, updated)
}

export async function deleteCategory(catId: string): Promise<void> {
  await db.categories.delete(catId)
  enqueueDelete('categories', catId)
}
