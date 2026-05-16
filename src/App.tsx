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
import { CopingCardsScreen }      from './screens/CopingCardsScreen'
import { ProgressScreen }          from './screens/ProgressScreen'
import { CalendarScreen }          from './screens/CalendarScreen'
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
// Goals, inbox, all-tasks, review now live in the More sheet — no longer full tabs.
const NAV_SCREENS = new Set(['dashboard', 'journal', 'category', 'all-habits'])
function showsNav(screen: Screen): boolean { return NAV_SCREENS.has(screen.name) }
function activeTab(screen: Screen): string {
  if (screen.name === 'journal')    return 'journal'
  if (screen.name === 'all-habits') return 'all-habits'
  // Goals/inbox/progress/review surfaced via More sheet — highlight "more"
  if (screen.name === 'goals' || screen.name === 'inbox' ||
      screen.name === 'all-tasks' || screen.name === 'review' ||
      screen.name === 'progress' || screen.name === 'calendar') return 'more'
  // Screens that logically live under "Today"
  if (screen.name === 'dashboard' || screen.name === 'category' ||
      screen.name === 'task'       || screen.name === 'daily-plan') return 'dashboard'
  return ''
}

type AuthState = 'loading' | 'authed' | 'unauthed'
type FabSheet  = 'none' | 'capture' | 'task' | 'goal' | 'menu' | 'voice'

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screenStack, setScreenStack] = useState<Screen[]>([{ name: 'dashboard' }])
  const screen = screenStack[screenStack.length - 1]

  const [authState,    setAuthState]    = useState<AuthState>('loading')
  const [isOnline,     setIsOnline]     = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [fabSheet,     setFabSheet]     = useState<FabSheet>('none')
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [moreOpen,     setMoreOpen]     = useState(false)
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

  // ── PWA foreground resume — visibilitychange (S-4) ───────────────────────
  // Fires when the user switches back to the tab or unlocks their phone (PWA).
  // Debounced to 1 s so rapid focus/blur cycles don't spam the server.
  // Complements S-3 (Capacitor appStateChange) which covers native builds.
  useEffect(() => {
    if (authState !== 'authed') return
    let debounce: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (document.visibilityState !== 'visible') return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        triggerSync().catch(e => console.warn('[sync] visibility sync', e))
      }, 1000)
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      if (debounce) clearTimeout(debounce)
    }
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
          background: 'var(--warn)',
          color: 'var(--paper)',
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
          {screen.name === 'task'       && <TaskDetailScreen taskId={screen.taskId} navigate={navigate} back={back} />}
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
              screen={screen}
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
          {screen.name === 'review'       && <WeeklyReviewScreen navigate={navigate} back={() => navigateTab({ name: 'dashboard' })} />}
          {screen.name === 'progress'     && <ProgressScreen navigate={navigate} back={back} />}
          {screen.name === 'calendar'     && <CalendarScreen navigate={navigate} back={back} onAddTask={() => openAddTask()} />}
          {screen.name === 'coping-cards' && <CopingCardsScreen navigate={navigate} back={back} />}
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
          onMoreTap={() => setMoreOpen(true)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <MoreSheet
          onClose={() => setMoreOpen(false)}
          navigate={(s: Screen) => { setMoreOpen(false); navigate(s) }}
          navigateTab={(s: Screen) => { setMoreOpen(false); navigateTab(s) }}
          onAddGoal={() => { setMoreOpen(false); setFabSheet('goal') }}
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
          captureToInbox={settings?.voiceCaptureToInbox ?? true}
          onCaptured={() => { closeSheet(); navigate({ name: 'inbox' }) }}
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
          captureToInbox={settings?.voiceCaptureToInbox ?? true}
          onCaptured={() => { closeSheet(); navigate({ name: 'inbox' }) }}
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

// ── More sheet — Goals / Plan / Capture / Stats ───────────────────────────────
interface MoreSheetProps {
  onClose: () => void
  navigate: (s: Screen) => void
  navigateTab: (s: Screen) => void
  onAddGoal: () => void
}

function MoreSheet({ onClose, navigate, navigateTab, onAddGoal }: MoreSheetProps) {
  const today = new Date()
  const isSunday = today.getDay() === 0

  const sections: {
    label: string
    items: { icon: string; title: string; sub: string; onTap: () => void }[]
  }[] = [
    {
      label: 'GROW',
      items: [
        {
          icon: 'target',
          title: 'Goals',
          sub: 'Track what you\'re building toward',
          onTap: () => navigate({ name: 'goals' }),
        },

      ],
    },
    {
      label: 'PLAN',
      items: [
        {
          icon: 'check',
          title: 'Plan my day',
          sub: 'Morning ritual — mood, reckoning, top 3',
          onTap: () => navigate({ name: 'daily-plan' }),
        },
        {
          icon: 'bolt',
          title: 'Weekly Progress',
          sub: 'Reflect on the week, XP, and streaks',
          onTap: () => navigate({ name: 'review' }),
        },
        {
          icon: 'calendar',
          title: 'Calendar',
          sub: 'Tasks and habits by date',
          onTap: () => navigate({ name: 'calendar' }),
        },
      ],
    },
    {
      label: 'CAPTURE',
      items: [
        {
          icon: 'inbox',
          title: 'Inbox',
          sub: 'Quick captures waiting to be sorted',
          onTap: () => navigate({ name: 'inbox' }),
        },
        {
          icon: 'layers',
          title: 'All tasks',
          sub: 'Everything, everywhere',
          onTap: () => navigate({ name: 'all-tasks' }),
        },
      ],
    },
    {
      label: 'ACCOUNT',
      items: [
        {
          icon: 'settings',
          title: 'Settings',
          sub: 'Theme, sync, notifications',
          onTap: () => navigate({ name: 'settings' }),
        },
      ],
    },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--paper)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 430, margin: '0 auto',
        maxHeight: '80vh',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Explore</span>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', padding: 4 }}>
            <Icons.close size={18} />
          </button>
        </div>

        {/* Sections */}
        {sections.map(section => (
          <div key={section.label} style={{ padding: '12px 20px 0' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
              color: 'var(--ink-4)', marginBottom: 8,
            }}>
              {section.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map(item => {
                const I = (Icons as Record<string, React.FC<{ size?: number; stroke?: string }>>)[item.icon] ?? Icons.home
                return (
                  <button
                    key={item.title}
                    onClick={item.onTap}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '11px 14px', borderRadius: 12,
                      background: 'var(--paper-2)', textAlign: 'left',
                      border: '1px solid var(--rule)',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'var(--paper-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <I size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
                        {item.sub}
                      </div>
                    </div>
                    <Icons.arrow size={14} style={{ color: 'var(--ink-4)', flexShrink: 0, transform: 'rotate(-45deg)' }} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
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
      <img src={mascotUrl} alt="MBQ Mascot" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <div className="t-display" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>MightyBananaQuest</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        The small things, handled.
      </div>
    </div>
  )
}

