import React, { useEffect, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './data/db'
import { supabase } from './lib/supabase'
import { pullAll, startRealtime, stopRealtime, pushOnly, previewPull, applyPull } from './lib/sync'
import { resetRecurringTasks } from './data/db'
import { setSyncState } from './lib/syncState'
import { useNotifications } from './lib/useNotifications'
import { BottomNav }          from './components/layout/BottomNav'
import { GlobalPomodoro }     from './components/GlobalPomodoro'
import { QuickCaptureSheet }  from './components/QuickCaptureSheet'
import { AddTaskSheet }       from './components/AddTaskSheet'
import { AddGoalSheet }       from './components/AddGoalSheet'
import { FabMenu }            from './components/FabMenu'
import type { FabAction }     from './components/FabMenu'
import { Icons }              from './components/ui/Icons'
import SyncStatusBar, { triggerSync } from './components/SyncStatusBar'
import { DashboardScreen }    from './screens/DashboardScreen'
import { TaskDetailScreen }   from './screens/TaskDetailScreen'
import { CategoryScreen }     from './screens/CategoryScreen'
import { GoalsScreen }        from './screens/GoalsScreen'
import { JournalScreen }      from './screens/JournalScreen'
import { SettingsScreen }     from './screens/SettingsScreen'
import { CalendarScreen }     from './screens/CalendarScreen'
import { InboxScreen }        from './screens/InboxScreen'
import { AllTasksScreen }     from './screens/AllTasksScreen'
import { AllHabitsScreen }    from './screens/AllHabitsScreen'
import { ScheduleScreen }      from './screens/ScheduleScreen'
import { WeeklyReviewScreen }  from './screens/WeeklyReviewScreen'
import { ProgressScreen }      from './screens/ProgressScreen'
import { OnboardingScreen }    from './screens/OnboardingScreen'
import { AuthScreen }          from './screens/AuthScreen'
import { ShoppingListScreen }  from './screens/ShoppingListScreen'
import type { Screen, AppSettings, Category } from './types'

// ── Theme application ─────────────────────────────────────────────────────────
function applyTheme(settings: AppSettings) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  root.setAttribute('data-variant', settings.variant)
  root.setAttribute('data-intensity', settings.intensity)
}

// ── Nav screens that show BottomNav ───────────────────────────────────────────
const NAV_SCREENS = new Set(['dashboard', 'journal', 'goals', 'calendar', 'category', 'inbox'])
function showsNav(screen: Screen): boolean { return NAV_SCREENS.has(screen.name) }
function activeTab(screen: Screen): string {
  if (screen.name === 'journal')  return 'journal'
  if (screen.name === 'goals')    return 'goals'
  if (screen.name === 'calendar') return 'calendar'
  return 'dashboard'  // category + dashboard both highlight Today tab
}

type AuthState = 'loading' | 'authed' | 'unauthed'
type FabSheet  = 'none' | 'capture' | 'task' | 'goal' | 'menu'

// Label cache for breadcrumbs (populated as screens are pushed)
const crumbLabelCache = new Map<string, string>()

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screenStack, setScreenStack] = useState<Screen[]>([{ name: 'dashboard' }])
  const screen = screenStack[screenStack.length - 1]

  const [authState,  setAuthState]  = useState<AuthState>('loading')
  const [isOnline,   setIsOnline]   = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [fabSheet,    setFabSheet]    = useState<FabSheet>('none')
  const [taskPrefill, setTaskPrefill] = useState<{ title?: string; catId?: string; due?: string; isHabit?: boolean } | null>(null)

  const settings   = useLiveQuery(() => db.settings.get(1), [])
  const categories = useLiveQuery(() => db.categories.toArray(), []) as Category[] | undefined

  // Theme
  useEffect(() => { if (settings) applyTheme(settings) }, [settings])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (settings) applyTheme(settings) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings])

  // Auth — on sign-in: push, then pull (auto-apply, no confirmation on first sync)
  const handleSignIn = useCallback(async (userId: string) => {
    setAuthState('authed')
    setSyncState({ phase: 'pushing', pushProgress: 0, errorMsg: null })
    try {
      await pushOnly((done, total) => {
        setSyncState({ pushProgress: Math.round((done / total) * 100) })
      })
      setSyncState({ phase: 'previewing', pullProgress: 0 })
      const preview = await previewPull()
      setSyncState({ phase: 'pulling', pullProgress: 50 })
      await applyPull(preview)
      startRealtime(userId)
      setSyncState({ phase: 'done', pullProgress: 100, lastSyncAt: Date.now() })
      setTimeout(() => {
        setSyncState({ phase: 'idle' })
      }, 3000)
      // Reset recurring tasks that weren't completed today
      resetRecurringTasks().catch(e => console.warn('[recurring] reset failed', e))
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
      else if (event === 'SIGNED_OUT') { stopRealtime(); setAuthState('unauthed') }
    })
    return () => subscription.unsubscribe()
  }, [handleSignIn])

  // ── Notifications ─────────────────────────────────────────────────────────
  useNotifications(settings, authState === 'authed')

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

  // Navigation
  function navigate(s: Screen) {
    // Cache task titles for breadcrumb display
    if (s.name === 'task') {
      db.tasks.get(s.taskId).then(t => {
        if (t) crumbLabelCache.set(t.id, t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title)
      }).catch(() => {})
    }
    setScreenStack(prev => [...prev, s])
    window.scrollTo(0, 0)
  }
  function back()                 { setScreenStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev); window.scrollTo(0, 0) }
  function navigateTab(s: Screen) { setScreenStack([s]); window.scrollTo(0, 0) }

  // ── FAB logic ─────────────────────────────────────────────────────────────
  function handleFabTap() {
    if (screen.name === 'category') {
      // Inside an Area — open quick capture pre-filled with that area
      openAddTask({ catId: screen.catId })
      return
    }
    if (screen.name === 'inbox') {
      setFabSheet('capture')
      return
    }
    const tab = activeTab(screen)
    if (tab === 'goals')   { setFabSheet('goal') }
    else if (tab === 'journal') {
      if (screen.name !== 'journal') navigate({ name: 'journal' })
    }
    else { setFabSheet('capture') }  // dashboard, calendar
  }

  function handleFabLongPress() { setFabSheet('menu') }

  function handleFabMenuSelect(action: FabAction) {
    // Always transition away from 'menu' state — onClose is NOT called by FabMenu items
    if (action === 'task')     { setTaskPrefill(null); setFabSheet('task') }
    else if (action === 'goal')     { setFabSheet('goal') }
    else if (action === 'habit')    { setTaskPrefill({ isHabit: true }); setFabSheet('task') }
    else if (action === 'journal')  { setFabSheet('none'); navigate({ name: 'journal' }) }
    else if (action === 'pomodoro') { setFabSheet('none'); window.dispatchEvent(new CustomEvent('pom:expand')) }
    else                            { setFabSheet('none') }
  }

  // Open full task sheet (called from screens that had navigate({name:'add'}))
  function openAddTask(prefill?: { title?: string; catId?: string; due?: string; isHabit?: boolean }) {
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
  if (authState === 'unauthed') return <AuthScreen onAuth={() => {}} />

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

        {/* ── Crumb bar — visible when stack depth > 1 ── */}
        {screenStack.length > 1 && (
          <CrumbBar
            stack={screenStack}
            categories={categories ?? []}
            onNavigateTo={idx => {
              setScreenStack(prev => prev.slice(0, idx + 1))
              window.scrollTo(0, 0)
            }}
          />
        )}

        {/* Screen mount area — flex: 1 so crumb bar takes its space first */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {screen.name === 'dashboard'  && <DashboardScreen navigate={navigate} />}
          {screen.name === 'task'       && <TaskDetailScreen taskId={screen.taskId} navigate={navigate} back={back} />}
          {screen.name === 'category'   && (
            <CategoryScreen
              catId={screen.catId}
              navigate={navigate}
              back={back}
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
          {screen.name === 'journal'    && <JournalScreen navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} phase={screen.phase} />}
          {screen.name === 'settings'   && <SettingsScreen navigate={navigate} back={back} />}
          {screen.name === 'calendar'   && (
            <CalendarScreen
              navigate={navigate}
              back={() => navigateTab({ name: 'dashboard' })}
              onAddTask={(due?: string) => openAddTask(due ? { due } : undefined)}
            />
          )}
          {screen.name === 'inbox'      && (
            <InboxScreen
              navigate={navigate}
              back={back}
              onAddTask={(title?: string) => openAddTask(title ? { title } : undefined)}
            />
          )}
          {screen.name === 'all-tasks'  && (
            <AllTasksScreen
              navigate={navigate}
              back={back}
              onAddTask={() => openAddTask()}
            />
          )}
          {screen.name === 'all-habits' && (
            <AllHabitsScreen navigate={navigate} back={back} />
          )}
          {screen.name === 'schedule'   && <ScheduleScreen taskId={screen.taskId} navigate={navigate} back={back} />}
          {screen.name === 'progress'   && <ProgressScreen navigate={navigate} back={back} />}
          {screen.name === 'review'         && <WeeklyReviewScreen navigate={navigate} back={back} />}
          {screen.name === 'shopping-list'  && <ShoppingListScreen back={back} navigate={navigate} />}
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
        />
      )}

      {/* ── Sheets / modals ────────────────────────────────────────────────── */}
      {fabSheet === 'menu' && (
        <FabMenu
          onSelect={handleFabMenuSelect}
          onClose={closeSheet}
        />
      )}

      {fabSheet === 'capture' && (
        <QuickCaptureSheet
          onClose={closeSheet}
          onExpand={title => { setTaskPrefill({ title, catId: currentCatId }); setFabSheet('task') }}
          defaultCatId={currentCatId}
        />
      )}

      {fabSheet === 'task' && (
        <AddTaskSheet
          onClose={closeSheet}
          defaultTitle={taskPrefill?.title}
          defaultCatId={taskPrefill?.catId}
          defaultDue={taskPrefill?.due}
          defaultIsHabit={taskPrefill?.isHabit}
        />
      )}

      {fabSheet === 'goal' && categories && (
        <AddGoalSheet
          categories={categories}
          onClose={closeSheet}
        />
      )}
    </div>
  )
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
      <img src="/mascot.png" alt="MBQ Mascot" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <div className="t-display" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>MightyBananaQuest</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Life admin, gamified
      </div>
    </div>
  )
}

// ── Crumb bar ─────────────────────────────────────────────────────────────────
function crumbLabel(s: Screen, cats: Category[]): string {
  switch (s.name) {
    case 'dashboard':  return 'Today'
    case 'category':   return cats.find(c => c.id === (s as { catId: string }).catId)?.name ?? 'Area'
    case 'task':       return crumbLabelCache.get((s as { taskId: string }).taskId) ?? 'Task'
    case 'goals':      return 'Goals'
    case 'journal':    return 'Journal'
    case 'calendar':   return 'Calendar'
    case 'inbox':      return 'Inbox'
    case 'all-tasks':      return 'All Tasks'
    case 'all-habits':     return 'All Habits'
    case 'shopping-list':  return 'Shopping List'
    case 'settings':       return 'Settings'
    case 'progress':   return 'Progress'
    case 'schedule':   return 'Schedule'
    case 'review':     return 'Review'
    default:           return s.name
  }
}

function CrumbBar({
  stack, categories, onNavigateTo,
}: {
  stack: Screen[]
  categories: Category[]
  onNavigateTo: (idx: number) => void
}) {
  // Show all ancestors (not the current screen — it shows in its own header)
  const ancestors = stack.slice(0, -1)
  if (ancestors.length === 0) return null

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 18px',
      height: 30,
      background: 'var(--paper-2)',
      borderBottom: '1px solid var(--rule)',
      gap: 4,
      overflowX: 'auto',
    }}>
      {ancestors.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 10, flexShrink: 0 }}>›</span>
          )}
          <button
            onClick={() => onNavigateTo(i)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              color: 'var(--ink-3)', whiteSpace: 'nowrap', flexShrink: 0,
              padding: '2px 4px', borderRadius: 4,
              transition: 'color .1s',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--ink)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--ink-3)' }}
          >
            {crumbLabel(s, categories)}
          </button>
        </React.Fragment>
      ))}
      {/* Current screen label (non-tappable) */}
      <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 10, flexShrink: 0 }}>›</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {crumbLabel(stack[stack.length - 1], categories)}
      </span>
    </div>
  )
}

// ── Stub ──────────────────────────────────────────────────────────────────────
function StubScreen({ title, back }: { title: string; back: () => void }) {
  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
        <button onClick={back} style={{ color: 'var(--ink-2)' }}>
          <Icons.back size={20} />
        </button>
        <span className="t-display" style={{ fontSize: 20 }}>{title}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 36 }}>🚧</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em' }}>COMING SOON</div>
      </div>
    </div>
  )
}
