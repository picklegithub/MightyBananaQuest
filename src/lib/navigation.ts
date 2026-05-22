/**
 * navigation.ts — Screen ↔ URL path mapping for react-router-dom.
 *
 * The rest of the app speaks in `Screen` objects (from types/index.ts).
 * This module is the sole translation layer between those objects and URL paths.
 *
 * Hash routing is used (`#/path`) so the app works on:
 *   - Capacitor Android/iOS (file:// URLs — no server to handle HTML5 history)
 *   - PWA in browsers (full history API works, but hash keeps parity)
 */

import type { Screen } from '../types'

// ── Screen → URL path ─────────────────────────────────────────────────────────

export function screenToPath(s: Screen): string {
  switch (s.name) {
    // System
    case 'splash':              return '/splash'
    case 'onboarding':          return '/onboarding'
    // CORE nav
    case 'today':               return '/'
    case 'dashboard':           return '/'             // legacy alias
    case 'inbox':               return '/inbox'
    case 'all-tasks':           return s.initialStatus ? `/all-tasks?status=${s.initialStatus}` : '/all-tasks'
    case 'all-habits':          return '/all-habits'
    case 'journal':             return s.phase ? `/journal?phase=${s.phase}` : '/journal'
    case 'mood-energy':         return '/mood-energy'
    case 'goals':               return '/goals'
    // Detail screens
    case 'task':                return `/task/${s.taskId}`
    case 'goal':                return `/goal/${s.goalId}`
    case 'category':            return `/category/${s.catId}`
    case 'habit-analytics':     return '/habit-analytics'
    case 'daily-plan':          return '/daily-plan'
    // GROW / Exercises
    case 'cbt-toolkit':         return '/cbt-toolkit'
    case 'coping-cards':        return '/cbt-toolkit'  // legacy redirect
    case 'mindfulness':         return '/mindfulness'
    case 'positive-psychology': return '/positive-psychology'
    case 'neuroplasticity':     return '/neuroplasticity'
    // GROW / Tools
    case 'pomodoro':            return '/pomodoro'
    case 'flashcards':          return '/flashcards'
    case 'resources':           return '/resources'
    // PROGRESS
    case 'review':              return '/review'
    case 'insights':            return '/insights'
    case 'progress':            return '/progress'     // legacy
    // Phase 4 detail (deep-link only)
    case 'mood-tracking':       return '/mood-tracking'
    case 'energy-score':        return '/energy-score'
    // SYSTEM
    case 'settings':            return '/settings'
    case 'calendar':            return '/calendar'
    default:                    return '/'
  }
}

// ── URL path → Screen ─────────────────────────────────────────────────────────

export function locationToScreen(pathname: string, search: string): Screen {
  const p  = pathname
  const qs = new URLSearchParams(search)

  if (p === '/' || p === '')        return { name: 'today' }
  if (p === '/inbox')               return { name: 'inbox' }
  if (p === '/all-tasks') {
    const status = qs.get('status') as 'active' | 'someday' | 'backlog' | null
    return { name: 'all-tasks', initialStatus: status ?? undefined }
  }
  if (p === '/all-habits')          return { name: 'all-habits' }
  if (p === '/journal') {
    const phase = qs.get('phase') as 'morning' | 'evening' | 'history' | null
    return { name: 'journal', phase: phase ?? undefined }
  }
  if (p === '/mood-energy')         return { name: 'mood-energy' }
  if (p === '/goals')               return { name: 'goals' }
  // Detail
  if (p === '/habit-analytics')     return { name: 'habit-analytics' }
  if (p === '/daily-plan')          return { name: 'daily-plan' }
  // GROW
  if (p === '/cbt-toolkit')         return { name: 'cbt-toolkit' }
  if (p === '/coping-cards')        return { name: 'cbt-toolkit' }  // legacy redirect
  if (p === '/mindfulness')         return { name: 'mindfulness' }
  if (p === '/positive-psychology') return { name: 'positive-psychology' }
  if (p === '/neuroplasticity')     return { name: 'neuroplasticity' }
  if (p === '/pomodoro')            return { name: 'pomodoro' }
  if (p === '/flashcards')          return { name: 'flashcards' }
  if (p === '/resources')           return { name: 'resources' }
  // PROGRESS
  if (p === '/review')              return { name: 'review' }
  if (p === '/insights')            return { name: 'insights' }
  if (p === '/progress')            return { name: 'progress' }     // legacy
  // Phase 4 detail
  if (p === '/mood-tracking')       return { name: 'mood-tracking' }
  if (p === '/energy-score')        return { name: 'energy-score' }
  // SYSTEM
  if (p === '/settings')            return { name: 'settings' }
  if (p === '/calendar')            return { name: 'calendar' }
  if (p === '/onboarding')          return { name: 'onboarding' }
  if (p === '/splash')              return { name: 'splash' }

  // Parameterised routes
  const taskMatch     = p.match(/^\/task\/(.+)$/)
  if (taskMatch)     return { name: 'task',     taskId:  taskMatch[1] }

  const categoryMatch = p.match(/^\/category\/(.+)$/)
  if (categoryMatch) return { name: 'category', catId:   categoryMatch[1] }

  const goalMatch     = p.match(/^\/goal\/(.+)$/)
  if (goalMatch)     return { name: 'goal',     goalId:  goalMatch[1] }

  // Unknown path — default to today
  return { name: 'today' }
}
