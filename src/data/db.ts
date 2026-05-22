/**
 * db.ts — re-export barrel.
 *
 * All 42 importers use `from '../data/db'` — this file preserves those paths
 * by re-exporting everything from domain modules.
 *
 * To add new functionality: create or extend a domain module, then re-export here.
 */

// ── Schema + DB singleton ─────────────────────────────────────────────────────
export { db, MightyBananaQuestDB } from './schema'
export type { HabitLog, DeletedTask, CompletedTask, OutboxEntry } from './schema'

// ── Domain modules ────────────────────────────────────────────────────────────
export {
  addTask, updateTask, deleteTask, deleteTasks,
  completeTask, uncompleteTask,
  resetRecurringTasks, pruneStaleDeletedTasks,
  countActiveTasks, toggleSubTask, getTombstoneIds,
  nextOccurrenceISO,
} from './tasks'

export {
  addHabit, updateHabit, deleteHabit,
  completeHabit, resetHabits,
} from './habits'

export { logHabitCompletion, removeHabitLog } from './habitLog'

export { saveJournalEntry, deleteJournalEntry } from './journal'

export { addGoal, updateGoal, deleteGoal } from './goals'

export { addCategory, updateCategory, deleteCategory } from './categories'

export {
  createInboxItem, countInbox,
  processInboxItem, revertInboxItem,
} from './inbox'

export {
  addShoppingItem, updateShoppingItem,
  deleteShoppingItem, deleteCheckedShoppingItems,
} from './shopping'

export {
  todayISO, getTodayPlan, saveDailyPlan, isTodayPlanComplete,
} from './dailyPlan'

export {
  getAllCopingCards, getPinnedCard,
  addCopingCard, updateCopingCard, deleteCopingCard, pinCopingCard,
} from './copingCards'

export {
  getSettings, recordDailyActivity,
  wipeStreaks, wipeTasks, wipeGoals, wipeAllData, resetLocalForResync,
} from './settings'

export {
  saveMoodEntry, getMoodEntryForSource,
  getMoodEntriesForDate, getMoodEntriesInRange, deleteMoodEntry,
} from './moodEntries'
