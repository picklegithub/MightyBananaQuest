import React, { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './data/db'
import { BottomNav } from './components/layout/BottomNav'
import { DashboardScreen }  from './screens/DashboardScreen'
import { TaskDetailScreen } from './screens/TaskDetailScreen'
import { AddScreen }        from './screens/AddScreen'
import { CategoryScreen }   from './screens/CategoryScreen'
import { GoalsScreen }      from './screens/GoalsScreen'
import { JournalScreen }    from './screens/JournalScreen'
import { SettingsScreen }   from './screens/SettingsScreen'
import { CalendarScreen }   from './screens/CalendarScreen'
import { InboxScreen }      from './screens/InboxScreen'
import { AllTasksScreen }   from './screens/AllTasksScreen'
import { ScheduleScreen }   from './screens/ScheduleScreen'
import type { Screen, AppSettings } from './types'

// ── Theme application ─────────────────────────────────────────────────────────
function applyTheme(settings: AppSettings) {
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemDark)

  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  root.setAttribute('data-variant', settings.variant)
  root.setAttribute('data-intensity', settings.intensity)
}

// ── Nav tabs that show the bottom bar ────────────────────────────────────────
const NAV_SCREENS = new Set(['dashboard', 'journal', 'goals', 'calendar'])
function showsNav(screen: Screen): boolean {
  return NAV_SCREENS.has(screen.name)
}
function activeTab(screen: Screen): string {
  if (screen.name === 'journal') return 'journal'
  if (screen.name === 'goals')   return 'goals'
  if (screen.name === 'calendar') return 'calendar'
  return 'dashboard'
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' })
  const settings = useLiveQuery(() => db.settings.get(1), [])

  // Apply theme whenever settings change
  useEffect(() => {
    if (settings) applyTheme(settings)
  }, [settings])

  // Listen for system dark-mode changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (settings) applyTheme(settings) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings])

  function navigate(s: Screen) {
    setScreen(s)
    // Scroll to top on screen change
    window.scrollTo(0, 0)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screen.name === 'dashboard'  && <DashboardScreen navigate={navigate} />}
        {screen.name === 'task'       && <TaskDetailScreen taskId={screen.taskId} navigate={navigate} />}
        {screen.name === 'add'        && <AddScreen navigate={navigate} />}
        {screen.name === 'category'   && <CategoryScreen catId={screen.catId} navigate={navigate} />}
        {screen.name === 'goals'      && <GoalsScreen navigate={navigate} />}
        {screen.name === 'journal'    && <JournalScreen navigate={navigate} phase={screen.phase} />}
        {screen.name === 'settings'   && <SettingsScreen navigate={navigate} />}
        {screen.name === 'calendar'   && <CalendarScreen navigate={navigate} />}
        {screen.name === 'inbox'      && <InboxScreen navigate={navigate} />}
        {screen.name === 'all-tasks'  && <AllTasksScreen navigate={navigate} />}
        {screen.name === 'schedule'   && <ScheduleScreen taskId={screen.taskId} navigate={navigate} />}
        {screen.name === 'progress'   && <StubScreen title="Progress" navigate={navigate} />}
        {screen.name === 'review'     && <StubScreen title="Weekly Review" navigate={navigate} />}
        {screen.name === 'onboarding' && <StubScreen title="Welcome" navigate={navigate} />}
        {screen.name === 'splash'     && <SplashScreen onDone={() => navigate({ name: 'dashboard' })} />}
      </div>

      {/* Bottom nav — only on main tabs */}
      {showsNav(screen) && (
        <BottomNav active={activeTab(screen)} navigate={navigate} />
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
      <div className="t-display" style={{ fontSize: 36 }}>🍌</div>
      <div className="t-display" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>MightyBananaQuest</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Life admin, gamified
      </div>
    </div>
  )
}

// ── Stub screen for unimplemented screens ─────────────────────────────────────
function StubScreen({ title, navigate }: { title: string; navigate: (s: Screen) => void }) {
  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
        <button onClick={() => navigate({ name: 'dashboard' })} style={{ color: 'var(--ink-2)' }}>
          ← Back
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
