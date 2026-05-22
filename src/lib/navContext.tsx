/**
 * navContext.tsx — App-wide navigation + sheet-open context.
 *
 * Provided by MobileLayout.tsx for all mobile screens.
 * DesktopLayout continues to pass navigate/back as explicit props —
 * screens accept both: prop takes precedence, context is the fallback.
 */

import { createContext, useContext } from 'react'
import type { Screen } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskPrefill = {
  title?:        string
  catId?:        string
  due?:          string
  isHabit?:      boolean
  linkToGoalId?: string
}

export type NavContextValue = {
  /** Push a screen onto the history stack. */
  navigate:     (s: Screen) => void
  /** Go back one step in browser history. */
  back:         () => void
  /** Replace the current history entry (used for tab switches). */
  navigateTab:  (s: Screen) => void
  /** Open the AddTask sheet, optionally pre-filled. */
  openAddTask:  (prefill?: TaskPrefill) => void
  /** Open the QuickCapture sheet. */
  openCapture:  () => void
  /** Open the AddTask sheet pre-filled for a new habit. */
  openAddHabit: () => void
  /** Sign the user out. */
  onLogout:     () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const noop = () => {}

/** Default value is no-ops — safe to call before the provider mounts. */
const defaults: NavContextValue = {
  navigate:     noop,
  back:         noop,
  navigateTab:  noop,
  openAddTask:  noop,
  openCapture:  noop,
  openAddHabit: noop,
  onLogout:     noop,
}

export const NavigationContext = createContext<NavContextValue>(defaults)

/** Consume the navigation context. Works in any component inside MobileLayout. */
export const useNav = () => useContext(NavigationContext)
