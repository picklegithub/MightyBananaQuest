import React, { useEffect, useState, useCallback } from 'react'
import mascotUrl from '/mascot.png'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './data/db'
import { supabase } from './lib/supabase'
import { startRealtime, stopRealtime, setCachedUserId } from './lib/sync'
import { resetRecurringTasks, resetHabits } from './data/db'
import { setSyncState } from './lib/syncState'
import { useNotifications } from './lib/useNotifications'
import { BottomNav }          from './components/layout/BottomNav'
import { DesktopLayout }      from './components/layout/DesktopLayout'
import { GlobalPomodoro }     from './components/GlobalPomodoro'
import { QuickCaptureSheet }  from './components/QuickCaptureSheet'
import { AddTaskSheet }       from './components/AddTaskSheet'
import { AddGoalSheet }       from './components/AddGoalSheet'
import { FabMenu }            from './components/FabMenu'
import type { FabAction }     from './components/FabMenu'
import { Icons, setPetStyle } from './components/ui/Icons'
import SyncStatusBar, { triggerSync } from './components/SyncStatusBar'
import { DashboardScreen }    from './screens/DashboardScreen'
import { TaskDetailScreen }   from './screens/TaskDetailScreen'
import { CategoryScreen }     from './screens/CategoryScreen'
import { GoalsScreen }        from './screens/GoalsScreen'
import { GoalDetailScreen }   from './screens/GoalDetailScreen'
import { JournalScreen }      from './screens/JournalScreen'
import { SettingsScreen }     from './screens/SettingsScreen'
import { InboxScreen }        from './screens/InboxScreen'
import { AllTasksScreen }     from './screens/AllTasksScreen'
import { AllHabitsScreen }    from './screens/AllHabitsScreen'
import { WeeklyReviewScreen }  from './screens/WeeklyReviewScreen'
import { OnboardingScreen }    from './screens/OnboardingScreen'
import { AuthScreen }          from './screens/AuthScreen'
import { DailyPlanRitualScreen }    from './screens/DailyPlanRitualScreen'
import { HabitAnalyticsScreen }    from './screens/HabitAnalyticsScreen'
import { VoiceCapture }             from './components/VoiceCapture'
import { SearchSheet }             from './components/SearchSheet'
import type { Screen, AppSettings, Category } from './types'

// ── Theme application ─────────────────────────────────────────────────────────
function applyTheme(settings: AppSettings) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')

  // palette: 'warm' is the :root default — omit the attribute to keep it clean
  // 'ocean'/'dusk'/'sage' are kept for data compat but no CSS rules → fall through to warm
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

// ── Nav screens that show BottomNav ───────────────────────────────────────────
const NAV_SCREENS = new Set(['dashboard', 'journal', 'goals', 'category', 'inbox', 'all-tasks', 'all-habits', 'review'])
function showsNav(screen: Screen): boolean { return NAV_SCREENS.has(screen.name) }
function activeTab(screen: Screen): string {
  if (screen.name === 'journal')    return 'journal'
  if (screen.name === 'goals')      return 'goals'
  if (screen.name === 'all-habits') return 'all-habits'
  // Screens that logically live under "Today"
  if (screen.name === 'dashboard' || screen.name === 'category' ||
      screen.name === 'task'       || screen.name === 'daily-plan') return 'dashboard'
  // All other NAV_SCREENS (inbox, all-tasks, review) are standalone — no bottom tab should light up
  return ''
}

type AuthState = 'loading' | 'authed' | 'unauthed'
type FabSheet  = 'none' | 'capture' | 'task' | 'goal' | 'menu' | 'voice'

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screenStack, setScreenStack] = useState<Screen[]>([{ name: 'dashboard' }])
  const screen = screenStack[screenStack.length - 1]

  const [authState,  setAuthState]  = useState<AuthState>('loading')
  const [isOnline,   setIsOnline]   = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [fabSheet,    setFabSheet]    = useState<FabSheet>('none')
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [taskPrefill, setTaskPrefill] = useState<{ title?: string; catId?: string; due?: string; isHabit?: boolean; linkToGoalId?: string } | null>(null)
  const [isDesktop,  setIsDesktop]  = useState(() => window.innerWidth >= 960)

  const settings   = useLiveQuery(() => db.settings.get(1), [])
  const categories = useLiveQuery(() => db.categories.toArray(), []) as Category[] | undefined

  // Desktop detection
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 960)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Theme
  useEffect(() => { if (settings) applyTheme(settings) }, [settings])

  // Pet icon style — update the module-level variable so Icons.pet renders the right variant
  useEffect(() => { if (settings?.petIcon) setPetStyle(settings.petIcon) }, [settings?.petIcon])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (settings) applyTheme(settings) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings])

  // Auth — on sign-in: push everything, then pull all tables
  const handleSignIn = useCallback(async (userId: string) => {
    setAuthState('authed')
    setCachedUserId(userId)  // cache so push functions skip repeated auth calls
    try {
      await triggerSync()
      startRealtime(userId)
      // Reset recurring tasks that weren't completed today
      resetRecurringTasks().catch(e => console.warn('[recurring] reset failed', e))
      resetHabits().catch(e => console.warn('[habits] reset failed', e))
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) await handleSignIn(session.user.id)
      else if (event === 'SIGNED_OUT') { stopRealtime(); setCachedUserId(null); setAuthState('unauthed') }
    })
    return () => subscription.unsubscribe()
  }, [handleSignIn])

  // ── Notifications ─────────────────────────────────────────────────────────
  useNotifications(settings, authState !== 'loading')

  // ── Periodic background pull (every 5 min while authed + online) ─────────
  useEffect(() => {
    if (authState !== 'authed') return
    const id = setInterval(() => {
      if (navigator.onLine) triggerSync().catch(e => console.warn('[sync] periodic pull', e))
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [authState])

  // ── Pull on reconnect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== 'authed') return
    const handler = () => triggerSync().catch(e => console.warn('[sync] online pull', e))
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [authState])

  // ── Offline / online banner ────────────────────────────────────────────────
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

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    stopRealtime()
    setCachedUserId(null)
    setAuthState('unauthed')
    setScreenStack([{ name: 'dashboard' }])
  }

  // Navigation
  function navigate(s: Screen) {
    setScreenStack(prev => [...prev, s])
    window.scrollTo(0, 0)
  }
  function back()                 { setScreenStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev); window.scrollTo(0, 0) }
  function navigateTab(s: Screen) { setScreenStack([s]); window.scrollTo(0, 0) }

  // ── FAB logic ─────────────────────────────────────────────────────────────
  function handleFabTap() {
    if (screen.name === 'category') {
      openAddTask({ catId: screen.catId })
      return
    }
    if (screen.name === 'all-habits') {
      setTaskPrefill({ isHabit: true })
      setFabSheet('task')
      return
    }
    // All other screens → quick capture (long-press for full menu)
    setFabSheet('capture')
  }

  // Long-press shows the trimmed menu: New Task / Voice Capture / Pomodoro
  function handleFabLongPress() { setFabSheet('menu') }

  function handleFabMenuSelect(action: FabAction) {
    // Always transition away from 'menu' state — onClose is NOT called by FabMenu items
    if (action === 'task')          { setTaskPrefill(null); setFabSheet('task') }
    else if (action === 'pomodoro') { setFabSheet('none'); window.dispatchEvent(new CustomEvent('pom:expand')) }
    else if (action === 'voice')    { setFabSheet('voice') }
    else                            { setFabSheet('none') }
  }

  // Open full task sheet
  function openAddTask(prefill?: { title?: string; catId?: string; due?: string; isHabit?: boolean; linkToGoalId?: string }) {
    setTaskPrefill(prefill ?? null)
    setFabSheet('task')
  }

  function closeSheet() {
    setFabSheet('none')
    setTaskPrefill(null)
  }

  // ── Context-aware FAB for non-tab screens ────────────────────────────────
  // (shows as small floating button bottom-right)
  const currentCatId = screen.name === 'category' ? screen.catId : undefined

  if (authState === 'loading') return <SplashScreen onDone={() => {}} />
  if (authState === 'unauthed') return <AuthScreen />

  function renderMobileStack() {
    return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Sync status bar */}
      {authState === 'authed' && <SyncStatusBar />}

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
          padding: '6px 16px',
          background: 'hsl(38, 90%, 52%)',
          color: 'white',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
          textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span>&#9888;</span> Working offline &mdash; changes will sync when you reconnect
        </div>
      )}

      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Screen mount area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {screen.name === 'dashboard'  && <DashboardScreen navigate={navigate} />}
          {screen.name === 'task'       && <TaskDetailScreen taskId={screen.taskId} navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} />}
          {screen.name === 'category'   && (
            <CategoryScreen
              catId={screen.catId}
              allCatIds={categories?.map(c => c.id) ?? []}
              navigate={navigate}
              back={() => navigateTab({ name: 'dashboard' })}
              onAddTask={() => openAddTask({ catId: screen.catId })}
            />
          )}
          {screen.name === 'goals'      && (
            <GoalsScreen
              navigate={navigate}
              back={() => navigateTab({ name: 'dashboard' })}
              onAddTask={() => openAddTask()}
            />
          )}
          {screen.name === 'goal'       && (
            <GoalDetailScreen
              goalId={screen.goalId}
              navigate={navigate}
              back={back}
            />
          )}
          {screen.name === 'journal'    && <JournalScreen navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} phase={screen.phase} />}
          {screen.name === 'settings'   && <SettingsScreen navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} onLogout={handleLogout} />}
          {screen.name === 'inbox'      && (
            <InboxScreen
              navigate={navigate}
              back={() => navigateTab({ name: 'dashboard' })}
            />
          )}
          {screen.name === 'all-tasks'  && (
            <AllTasksScreen
              navigate={navigate}
              back={() => navigateTab({ name: 'dashboard' })}
              onAddTask={() => openAddTask()}
            />
          )}
          {screen.name === 'all-habits' && (
            <AllHabitsScreen
              navigate={navigate}
              back={() => navigateTab({ name: 'dashboard' })}
              onAddHabit={() => { setTaskPrefill({ isHabit: true }); setFabSheet('task') }}
            />
          )}
          {screen.name === 'habit-analytics' && (
            <HabitAnalyticsScreen navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} />
          )}
          {screen.name === 'review'     && <WeeklyReviewScreen navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} />}
          {screen.name === 'daily-plan' && <DailyPlanRitualScreen navigate={navigate} back={back} />}
          {screen.name === 'onboarding'     && <OnboardingScreen onDone={() => navigateTab({ name: 'dashboard' })} />}
          {screen.name === 'splash'         && <SplashScreen onDone={() => navigateTab(settings?.onboarded ? { name: 'dashboard' } : { name: 'onboarding' })} />}
        </div>
      </div>

      {/* Global Pomodoro */}
      <GlobalPomodoro workMins={settings?.defaultPomodoroMins ?? 25} />

      {/* Floating FAB for non-tab screens (replaces old QuickCapture FAB) */}
      {!showsNav(screen) && (
        <button
          onClick={() => setFabSheet('capture')}
          aria-label="Quick capture"
          style={{
            position: 'fixed',
            bottom: 'calc(20px + env(safe-area-inset-bottom))',
            right: 20, zIndex: 50,
            width: 46, height: 46, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-pop)',
            border: '2px solid var(--paper)',
          }}
        >
          <Icons.plus size={18} />
        </button>
      )}

      {/* Bottom nav (tab screens only) */}
      {showsNav(screen) && (
        <BottomNav
          active={activeTab(screen)}
          navigate={navigate}
          navigateTab={navigateTab}
          onFabTap={handleFabTap}
          onFabLongPress={handleFabLongPress}
          onSearchTap={() => setSearchOpen(true)}
        />
      )}

      {/* ── Sheets / modals ────────────────────────────────────────────────── */}
      {searchOpen && (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          navigate={navigate}
        />
      )}

      {fabSheet === 'menu' && (
        <FabMenu
          onSelect={handleFabMenuSelect}
          onClose={closeSheet}
        />
      )}

      {fabSheet === 'capture' && (
        <QuickCaptureSheet
          onClose={closeSheet}
          onExpand={title => { setTaskPrefill({ title, catId: currentCatId ?? 'inbox' }); setFabSheet('task') }}
          defaultCatId={currentCatId ?? 'inbox'}
        />
      )}

      {fabSheet === 'task' && (
        <AddTaskSheet
          onClose={closeSheet}
          defaultTitle={taskPrefill?.title}
          defaultCatId={taskPrefill?.catId}
          defaultDue={taskPrefill?.due}
          defaultIsHabit={taskPrefill?.isHabit}
          linkToGoalId={taskPrefill?.linkToGoalId}
        />
      )}

      {fabSheet === 'goal' && categories && (
        <AddGoalSheet
          categories={categories}
          onClose={closeSheet}
        />
      )}

      {fabSheet === 'voice' && (
        <VoiceCapture
          onClose={closeSheet}
          onExpand={parsed => {
            setTaskPrefill({ title: parsed.title, catId: parsed.catId ?? undefined, due: parsed.due ?? undefined })
            setFabSheet('task')
          }}
        />
      )}
    </div>
  )
  }

  // Desktop: phone-width wrapper — DesktopLayout frozen for v2
  if (isDesktop) return (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', background: 'var(--paper-3)' }}>
      <div style={{ width: '100%', maxWidth: 430, position: 'relative', background: 'var(--paper)', boxShadow: '0 0 40px rgba(0,0,0,0.12)' }}>
        {renderMobileStack()}
      </div>
    </div>
  )

  return renderMobileStack()
}

// ── Splash ────────────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', color: 'var(--paper)',
      gap: 12,
    }}>
      <img src={mascotUrl} alt="MBQ Mascot" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <div className="t-display" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>MightyBananaQuest</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        The small things, handled.
      </div>
    </div>
  )
}

