/**
 * MobileLayout.tsx — The complete mobile shell.
 *
 * Owns:
 *   - URL → Screen derivation
 *   - NavigationContext provision (navigate, back, navigateTab, openAddTask, …)
 *   - All overlay chrome: SyncStatusBar, offline banner, cap-exceeded toast
 *   - FAB + all sheets (QuickCapture, AddTask, AddGoal, Voice, FabMenu, Search)
 *   - BottomNav + MoreSheet
 *   - GlobalPomodoro
 *   - Lazy screen rendering via Suspense
 *
 * App.tsx is left with only: auth, settings, theme, desktop detection.
 */

import React, {
  useState, useCallback, useMemo, useEffect, lazy, Suspense,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { screenToPath, locationToScreen } from '../../lib/navigation'
import {
  NavigationContext,
  type TaskPrefill,
} from '../../lib/navContext'
import { BottomNav }           from './BottomNav'
import { GlobalPomodoro }      from '../GlobalPomodoro'
import { QuickCaptureSheet }   from '../QuickCaptureSheet'
import { AddTaskSheet }        from '../AddTaskSheet'
import { AddGoalSheet }        from '../AddGoalSheet'
import { FabMenu }             from '../FabMenu'
import type { FabAction }      from '../FabMenu'
import { Icons }               from '../ui/Icons'
import { ScreenErrorBoundary } from '../ui/ScreenErrorBoundary'
import SyncStatusBar           from '../SyncStatusBar'
import { VoiceCapture }        from '../VoiceCapture'
import { SearchSheet }         from '../SearchSheet'
import { SplashScreen }        from '../../screens/SplashScreen'
import { OnboardingScreen }    from '../../screens/OnboardingScreen'
import type { Screen, AppSettings, Category } from '../../types'

// ── Lazy screens ──────────────────────────────────────────────────────────────
const DashboardScreen       = lazy(() => import('../../screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })))
const TaskDetailScreen      = lazy(() => import('../../screens/TaskDetailScreen').then(m => ({ default: m.TaskDetailScreen })))
const CategoryScreen        = lazy(() => import('../../screens/CategoryScreen').then(m => ({ default: m.CategoryScreen })))
const GoalsScreen           = lazy(() => import('../../screens/GoalsScreen').then(m => ({ default: m.GoalsScreen })))
const GoalDetailScreen      = lazy(() => import('../../screens/GoalDetailScreen').then(m => ({ default: m.GoalDetailScreen })))
const JournalScreen         = lazy(() => import('../../screens/JournalScreen').then(m => ({ default: m.JournalScreen })))
const SettingsScreen        = lazy(() => import('../../screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })))
const InboxScreen           = lazy(() => import('../../screens/InboxScreen').then(m => ({ default: m.InboxScreen })))
const AllTasksScreen        = lazy(() => import('../../screens/AllTasksScreen').then(m => ({ default: m.AllTasksScreen })))
const AllHabitsScreen       = lazy(() => import('../../screens/AllHabitsScreen').then(m => ({ default: m.AllHabitsScreen })))
const WeeklyReviewScreen    = lazy(() => import('../../screens/WeeklyReviewScreen').then(m => ({ default: m.WeeklyReviewScreen })))
const DailyPlanRitualScreen = lazy(() => import('../../screens/DailyPlanRitualScreen').then(m => ({ default: m.DailyPlanRitualScreen })))
const HabitAnalyticsScreen  = lazy(() => import('../../screens/HabitAnalyticsScreen').then(m => ({ default: m.HabitAnalyticsScreen })))
const CopingCardsScreen     = lazy(() => import('../../screens/CopingCardsScreen').then(m => ({ default: m.CopingCardsScreen })))
const ProgressScreen        = lazy(() => import('../../screens/ProgressScreen').then(m => ({ default: m.ProgressScreen })))
const CalendarScreen        = lazy(() => import('../../screens/CalendarScreen').then(m => ({ default: m.CalendarScreen })))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Screens that render BottomNav (tab bar). */
const NAV_SCREENS = new Set(['dashboard', 'journal', 'category', 'inbox'])
function showsNav(screen: Screen): boolean { return NAV_SCREENS.has(screen.name) }

function activeTab(screen: Screen): string {
  if (screen.name === 'journal')    return 'journal'
  if (screen.name === 'inbox')      return 'inbox'
  if (
    screen.name === 'all-habits' || screen.name === 'goals'    ||
    screen.name === 'all-tasks'  || screen.name === 'review'   ||
    screen.name === 'progress'   || screen.name === 'calendar'
  ) return 'more'
  if (
    screen.name === 'dashboard'  || screen.name === 'category' ||
    screen.name === 'task'       || screen.name === 'daily-plan'
  ) return 'dashboard'
  return ''
}

/** Minimal spinner shown while a lazy screen chunk loads. */
function ScreenLoadingFallback() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)', color: 'var(--ink-4)',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--rule)', borderTopColor: 'var(--ink-3)',
        animation: 'spin 0.6s linear infinite',
      }} />
    </div>
  )
}

// ── More sheet ────────────────────────────────────────────────────────────────

interface MoreSheetProps {
  onClose:     () => void
  navigate:    (s: Screen) => void
  navigateTab: (s: Screen) => void
  onAddGoal:   () => void
}

function MoreSheet({ onClose, navigate, navigateTab: _navigateTab, onAddGoal }: MoreSheetProps) {
  const today    = new Date()
  const isSunday = today.getDay() === 0

  const sections: {
    label: string
    items: { icon: string; title: string; sub: string; onTap: () => void }[]
  }[] = [
    {
      label: 'GROW',
      items: [
        { icon: 'target', title: 'Goals',      sub: "Track what you're building toward",     onTap: () => navigate({ name: 'goals' })      },
        { icon: 'flame',  title: 'All Habits',  sub: 'Manage and review your habits',          onTap: () => navigate({ name: 'all-habits' }) },
      ],
    },
    {
      label: 'PLAN',
      items: [
        { icon: 'check',  title: 'Plan my day',   sub: 'Morning ritual — mood, reckoning, top 3', onTap: () => navigate({ name: 'daily-plan' }) },
        { icon: 'bolt',   title: 'Weekly Review', sub: 'Reflect on the week, goals, and mood',    onTap: () => navigate({ name: 'review' })     },
        { icon: 'chart',  title: 'Stats',          sub: 'Streak, XP, heatmap, by-area progress',  onTap: () => navigate({ name: 'progress' })   },
        ...(isSunday ? [{
          icon: 'journal', title: 'Journal', sub: 'Sunday reflection',
          onTap: () => navigate({ name: 'journal' } as Screen),
        }] : []),
      ],
    },
    {
      label: 'FOCUS',
      items: [
        { icon: 'calendar', title: 'Calendar',     sub: 'Due dates and upcoming tasks',    onTap: () => navigate({ name: 'calendar' })      },
        { icon: 'heart',    title: 'Coping Cards', sub: 'CBT toolkit for hard moments',    onTap: () => navigate({ name: 'coping-cards' })  },
      ],
    },
    {
      label: 'CAPTURE',
      items: [
        { icon: 'layers', title: 'All tasks', sub: 'Everything, everywhere', onTap: () => navigate({ name: 'all-tasks' }) },
      ],
    },
    {
      label: 'ACCOUNT',
      items: [
        { icon: 'settings', title: 'Settings', sub: 'Theme, sync, notifications', onTap: () => navigate({ name: 'settings' }) },
      ],
    },
  ]

  // Allow tapping "Add Goal" via the FAB+goal flow
  void onAddGoal  // used in BottomNav via onAddGoal prop above

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--paper)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 430, margin: '0 auto',
        maxHeight: '80vh',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Explore</span>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', padding: 4 }}>
            <Icons.close size={18} />
          </button>
        </div>
        {sections.map(section => (
          <div key={section.label} style={{ padding: '12px 20px 0' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-4)', marginBottom: 8 }}>
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
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <I size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{item.sub}</div>
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

// ── MobileLayout ──────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'authed' | 'unauthed'
type FabSheet  = 'none' | 'capture' | 'task' | 'goal' | 'menu' | 'voice'

interface Props {
  settings:   AppSettings | undefined
  categories: Category[] | undefined
  authState:  AuthState
  isOnline:   boolean
  onLogout:   () => void
}

export function MobileLayout({ settings, categories, authState, isOnline, onLogout }: Props) {
  // ── Router ──────────────────────────────────────────────────────────────────
  const routerNavigate = useNavigate()
  const location       = useLocation()
  const screen         = locationToScreen(location.pathname, location.search)

  // ── Navigation functions ───────────────────────────────────────────────────
  const navigate    = useCallback((s: Screen) => routerNavigate(screenToPath(s)), [routerNavigate])
  const back        = useCallback(() => routerNavigate(-1 as any), [routerNavigate])
  const navigateTab = useCallback((s: Screen) => routerNavigate(screenToPath(s), { replace: true }), [routerNavigate])

  // ── Sheet / FAB state ──────────────────────────────────────────────────────
  const [fabSheet,    setFabSheet]    = useState<FabSheet>('none')
  const [taskPrefill, setTaskPrefill] = useState<TaskPrefill | null>(null)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [moreOpen,    setMoreOpen]    = useState(false)
  const [capToast,    setCapToast]    = useState(false)

  // ── Cap-exceeded toast ─────────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      setCapToast(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setCapToast(false), 4000)
    }
    window.addEventListener('sync:cap-exceeded', handler)
    return () => {
      window.removeEventListener('sync:cap-exceeded', handler)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openAddTask = useCallback((prefill?: TaskPrefill) => {
    setTaskPrefill(prefill ?? null)
    setFabSheet('task')
  }, [])

  const openCapture  = useCallback(() => setFabSheet('capture'), [])
  const openAddHabit = useCallback(() => { setTaskPrefill({ isHabit: true }); setFabSheet('task') }, [])
  const closeSheet   = useCallback(() => { setFabSheet('none'); setTaskPrefill(null) }, [])

  const currentCatId = screen.name === 'category' ? screen.catId : undefined

  // ── FAB handlers ───────────────────────────────────────────────────────────
  function handleFabTap() {
    if (screen.name === 'category')  { openAddTask({ catId: screen.catId }); return }
    if (screen.name === 'all-habits') { openAddHabit(); return }
    openCapture()
  }
  function handleFabLongPress() { setFabSheet('menu') }
  function handleFabMenuSelect(action: FabAction) {
    if (action === 'task')          { setTaskPrefill(null); setFabSheet('task') }
    else if (action === 'pomodoro') { setFabSheet('none'); window.dispatchEvent(new CustomEvent('pom:expand')) }
    else if (action === 'voice')    { setFabSheet('voice') }
    else                            { setFabSheet('none') }
  }

  // ── Navigation context value ───────────────────────────────────────────────
  const ctxValue = useMemo(() => ({
    navigate,
    back,
    navigateTab,
    openAddTask,
    openCapture,
    openAddHabit,
    onLogout,
  }), [navigate, back, navigateTab, openAddTask, openCapture, openAddHabit, onLogout])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <NavigationContext.Provider value={ctxValue}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Sync status bar */}
        {authState === 'authed' && <SyncStatusBar />}

        {/* Offline banner */}
        {!isOnline && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
            padding: '6px 16px',
            background: 'var(--warn)', color: 'var(--paper)',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
            textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span>&#9888;</span> Working offline &mdash; changes will sync when you reconnect
          </div>
        )}

        {/* Cap-exceeded toast */}
        {capToast && (
          <div style={{
            position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16,
            zIndex: 9999, background: 'var(--ink)', color: 'var(--paper)',
            borderRadius: 12, padding: '12px 16px',
            fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.03em',
            boxShadow: 'var(--shadow-pop)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ opacity: 0.7 }}>⚠</span>
            <span>Active task limit reached — write not synced on this device</span>
          </div>
        )}

        {/* ── Screen content ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* key=pathname resets the error boundary on every navigation */}
          <ScreenErrorBoundary key={location.pathname} name={screen.name}>
            <Suspense fallback={<ScreenLoadingFallback />}>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

                {screen.name === 'dashboard'       && <DashboardScreen />}
                {screen.name === 'task'            && <TaskDetailScreen taskId={screen.taskId} />}
                {screen.name === 'category'        && (
                  <CategoryScreen
                    catId={screen.catId}
                    allCatIds={categories?.map(c => c.id) ?? []}
                  />
                )}
                {screen.name === 'goals'           && <GoalsScreen />}
                {screen.name === 'goal'            && <GoalDetailScreen goalId={screen.goalId} />}
                {screen.name === 'journal'         && <JournalScreen phase={screen.phase} />}
                {screen.name === 'settings'        && <SettingsScreen />}
                {screen.name === 'inbox'           && <InboxScreen />}
                {screen.name === 'all-tasks'       && <AllTasksScreen screen={screen} />}
                {screen.name === 'all-habits'      && <AllHabitsScreen />}
                {screen.name === 'habit-analytics' && <HabitAnalyticsScreen />}
                {screen.name === 'review'          && <WeeklyReviewScreen />}
                {screen.name === 'progress'        && <ProgressScreen />}
                {screen.name === 'calendar'        && <CalendarScreen />}
                {screen.name === 'coping-cards'    && <CopingCardsScreen />}
                {screen.name === 'daily-plan'      && <DailyPlanRitualScreen />}
                {screen.name === 'onboarding'      && (
                  <OnboardingScreen onDone={() => navigateTab({ name: 'dashboard' })} />
                )}
                {screen.name === 'splash' && (
                  <SplashScreen
                    onDone={() => navigateTab(
                      settings?.onboarded ? { name: 'dashboard' } : { name: 'onboarding' }
                    )}
                  />
                )}

              </div>
            </Suspense>
          </ScreenErrorBoundary>
        </div>

        {/* Global Pomodoro floating widget */}
        <GlobalPomodoro workMins={settings?.defaultPomodoroMins ?? 25} />

        {/* Floating FAB for non-tab screens */}
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

        {/* Search sheet */}
        {searchOpen && (
          <SearchSheet
            onClose={() => setSearchOpen(false)}
            navigate={navigate}
          />
        )}

        {/* FAB menu */}
        {fabSheet === 'menu' && (
          <FabMenu onSelect={handleFabMenuSelect} onClose={closeSheet} />
        )}

        {/* Quick capture */}
        {fabSheet === 'capture' && (
          <QuickCaptureSheet
            onClose={closeSheet}
            onExpand={title => { setTaskPrefill({ title, catId: currentCatId }); setFabSheet('task') }}
            defaultCatId={currentCatId}
            captureToInbox={settings?.voiceCaptureToInbox ?? true}
            onCaptured={() => { closeSheet(); navigate({ name: 'inbox' }) }}
          />
        )}

        {/* Add task sheet */}
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

        {/* Add goal sheet */}
        {fabSheet === 'goal' && categories && (
          <AddGoalSheet categories={categories} onClose={closeSheet} />
        )}

        {/* Voice capture */}
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
    </NavigationContext.Provider>
  )
}
