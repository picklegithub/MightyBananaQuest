/**
 * App.tsx — Auth gate, settings, theme, and shell selector.
 *
 * Responsibilities (only these):
 *   - Supabase auth session + sign-in/sign-out handling
 *   - Settings + theme application
 *   - Desktop vs. mobile detection
 *   - Notifications setup
 *   - Periodic sync, reconnect sync, visibility sync
 *   - Routing to: SplashScreen (loading) | AuthScreen | DesktopLayout | MobileLayout
 *
 * Everything mobile-specific (FAB, sheets, screen rendering, nav context)
 * lives in MobileLayout.tsx.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useLiveQuery }  from 'dexie-react-hooks'
import { useNavigate }   from 'react-router-dom'
import { db }            from './data/db'
import { supabase }      from './lib/supabase'
import {
  startRealtime, stopRealtime, setCachedUserId,
} from './lib/sync'
import {
  resetRecurringTasks, resetHabits, pruneStaleDeletedTasks,
} from './data/db'
import { setSyncState }          from './lib/syncState'
import { useNotifications }                            from './lib/useNotifications'
import { registerPushToken, deregisterCurrentToken,
         unregisterPushListeners }                     from './lib/pushNotifications'
import { setPetStyle }                                 from './components/ui/Icons'
import { triggerSync }            from './components/SyncStatusBar'
import { AuthScreen }            from './screens/AuthScreen'
import { SplashScreen }          from './screens/SplashScreen'
import { AppLayout }             from './components/layout/AppLayout'
import { SharedReviewScreen }    from './screens/SharedReviewScreen'
import type { AppSettings, Category } from './types'

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(settings: AppSettings) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')

  const p = settings.palette ?? 'warm'
  if (p === 'custom') {
    root.setAttribute('data-palette', 'custom')
    root.style.setProperty('--custom-hue', String(settings.customPaletteHue ?? 215))
  } else if (p !== 'warm') {
    root.setAttribute('data-palette', p)
    root.style.removeProperty('--custom-hue')
  } else {
    root.removeAttribute('data-palette')
    root.style.removeProperty('--custom-hue')
  }
  root.setAttribute('data-intensity', settings.intensity)
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'authed' | 'unauthed'

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // useNavigate must be called inside the HashRouter (provided by main.tsx).
  // We need it here only for handleLogout (navigate to '/' after sign-out).
  const routerNavigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [isOnline,  setIsOnline]  = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  // Deduplicate handleSignIn: getSession + onAuthStateChange both fire SIGNED_IN
  // for the same userId on initial load. Without this guard, startRealtime gets
  // called twice → tears down the channel mid-drain → 30s timeout.
  const _lastSignedInUserId = useRef<string | null>(null)
  // Throttle visibility syncs — 1s debounce alone isn't enough; tab-switch
  // storms can queue many syncs. Enforce a 60s minimum between visibility syncs.
  const _lastVisibilitySyncAt = useRef<number>(0)
  const settings   = useLiveQuery(() => db.settings.get(1), [])
  const categories = useLiveQuery(() => db.categories.toArray(), []) as Category[] | undefined

  // ── Theme ──────────────────────────────────────────────────────────────────
  useEffect(() => { if (settings) applyTheme(settings) }, [settings])
  useEffect(() => { if (settings?.petIcon) setPetStyle(settings.petIcon) }, [settings?.petIcon])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (settings) applyTheme(settings) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings])

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleSignIn = useCallback(async (userId: string) => {
    // Deduplicate: getSession() + onAuthStateChange(SIGNED_IN) both fire for
    // the same userId on page load. Skip if we already initialised for this user.
    if (_lastSignedInUserId.current === userId) return
    _lastSignedInUserId.current = userId

    setAuthState('authed')
    setCachedUserId(userId)
    try {
      await triggerSync()
      startRealtime(userId)
      resetRecurringTasks().catch(e => console.warn('[recurring] reset failed', e))
      resetHabits().catch(e => console.warn('[habits] reset failed', e))
      pruneStaleDeletedTasks().catch(e => console.warn('[db] tombstone prune failed', e))
      registerPushToken().catch(e => console.warn('[push] register failed', e))
    } catch (e) {
      console.warn('[sync] initial sync failed', e)
      setSyncState({ phase: 'error', errorMsg: e instanceof Error ? e.message : 'Sync failed' })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleSignIn(session.user.id)
      else setAuthState('unauthed')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) await handleSignIn(session.user.id)
        else if (event === 'SIGNED_OUT') {
          _lastSignedInUserId.current = null
          stopRealtime()
          setCachedUserId(null)
          setAuthState('unauthed')
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [handleSignIn])

  // ── Notifications ──────────────────────────────────────────────────────────
  useNotifications(settings, authState !== 'loading')

  // ── Periodic background pull (every 5 min) ─────────────────────────────────
  useEffect(() => {
    if (authState !== 'authed') return
    const id = setInterval(() => {
      if (navigator.onLine) triggerSync().catch(e => console.warn('[sync] periodic pull', e))
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [authState])

  // ── Pull on reconnect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== 'authed') return
    const handler = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) startRealtime(session.user.id)
      triggerSync().catch(e => console.warn('[sync] online pull', e))
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [authState])

  // ── PWA foreground resume ──────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== 'authed') return
    let debounce: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (document.visibilityState !== 'visible') return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        const now = Date.now()
        // Throttle: skip if last visibility sync was less than 60s ago
        if (now - _lastVisibilitySyncAt.current < 60_000) return
        _lastVisibilitySyncAt.current = now
        triggerSync().catch(e => console.warn('[sync] visibility sync', e))
      }, 1000)
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      if (debounce) clearTimeout(debounce)
    }
  }, [authState])

  // ── Service Worker push-click → deep-link ─────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_CLICK') return
      const taskId: string | undefined = event.data.taskId
      window.dispatchEvent(new CustomEvent('mbq:push-click', { detail: { taskId } }))
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // ── Online/offline state ───────────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // ── Logout ─────────────────────────────────────────────────────────────────
  function handleLogout() {
    deregisterCurrentToken().catch(e => console.warn('[push] deregister failed', e))
    unregisterPushListeners()
    stopRealtime()
    setCachedUserId(null)
    setAuthState('unauthed')
    routerNavigate('/', { replace: true })
  }

  // ── Public routes (no auth required) ──────────────────────────────────────
  const hashPath = window.location.hash.replace(/^#/, '')
  const shareMatch = hashPath.match(/^\/review\/([0-9a-f-]{36})$/)
  if (shareMatch) return <SharedReviewScreen token={shareMatch[1]} />

  // ── Auth gates ─────────────────────────────────────────────────────────────
  if (authState === 'loading') return <SplashScreen onDone={() => {}} />
  if (authState === 'unauthed') return <AuthScreen />

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <AppLayout
      settings={settings}
      categories={categories}
      authState={authState}
      isOnline={isOnline}
      onLogout={handleLogout}
    />
  )
}

