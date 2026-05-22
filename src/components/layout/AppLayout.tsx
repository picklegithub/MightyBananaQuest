/**
 * AppLayout.tsx — Unified app shell. Desktop-first.
 *
 * Desktop (≥1024px): persistent sidebar (240px) + scrollable content area
 * Mobile (<1024px):  slide-in hamburger drawer + full-width content
 *
 * Owns:
 *   - NavigationContext provision
 *   - Sidebar nav — CORE (flat) / GROW (collapsible) / PROGRESS (collapsible)
 *     with nested Exercises sub-group inside GROW
 *   - Group state persisted to localStorage('mbq.nav.groupState')
 *   - ⌘K keyboard shortcut → Quick Capture
 *   - All overlay chrome: SyncStatusBar, offline banner, cap toast
 *   - All sheets: QuickCapture, AddTask, AddGoal, Voice, FabMenu, Search
 *   - GlobalPomodoro floating widget
 *   - PomodoroLauncher stub in top header
 *   - Lazy screen rendering via Suspense
 */

import React, {
  useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO } from '../../data/db'
import { isDueToday } from '../../lib/parseDue'
import { screenToPath, locationToScreen } from '../../lib/navigation'
import { NavigationContext, type TaskPrefill } from '../../lib/navContext'
import { Icons } from '../ui/Icons'
import { ScreenErrorBoundary } from '../ui/ScreenErrorBoundary'
import SyncStatusBar from '../SyncStatusBar'
import { GlobalPomodoro } from '../GlobalPomodoro'
import { QuickCaptureSheet } from '../QuickCaptureSheet'
import { AddTaskSheet } from '../AddTaskSheet'
import { AddGoalSheet } from '../AddGoalSheet'
import { FabMenu } from '../FabMenu'
import type { FabAction } from '../FabMenu'
import { VoiceCapture } from '../VoiceCapture'
import { SearchSheet } from '../SearchSheet'
import { SplashScreen } from '../../screens/SplashScreen'
import { OnboardingScreen } from '../../screens/OnboardingScreen'
import { ComingSoonScreen } from '../../screens/ComingSoonScreen'
import type { Screen, AppSettings, Category } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIDEBAR_W  = 240
const MOBILE_BP  = 1024
const LS_NAV_KEY = 'mbq.nav.groupState'

// ── Lazy screens ──────────────────────────────────────────────────────────────

const DashboardScreen         = lazy(() => import('../../screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })))
const TaskDetailScreen        = lazy(() => import('../../screens/TaskDetailScreen').then(m => ({ default: m.TaskDetailScreen })))
const CategoryScreen          = lazy(() => import('../../screens/CategoryScreen').then(m => ({ default: m.CategoryScreen })))
const GoalsScreen             = lazy(() => import('../../screens/GoalsScreen').then(m => ({ default: m.GoalsScreen })))
const GoalDetailScreen        = lazy(() => import('../../screens/GoalDetailScreen').then(m => ({ default: m.GoalDetailScreen })))
const JournalScreen           = lazy(() => import('../../screens/JournalScreen').then(m => ({ default: m.JournalScreen })))
const SettingsScreen              = lazy(() => import('../../screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })))
const WorkspaceSettingsScreen     = lazy(() => import('../../screens/WorkspaceSettingsScreen').then(m => ({ default: m.WorkspaceSettingsScreen })))
const InboxScreen             = lazy(() => import('../../screens/InboxScreen').then(m => ({ default: m.InboxScreen })))
const AllTasksScreen          = lazy(() => import('../../screens/AllTasksScreen').then(m => ({ default: m.AllTasksScreen })))
const AllHabitsScreen         = lazy(() => import('../../screens/AllHabitsScreen').then(m => ({ default: m.AllHabitsScreen })))
const WeeklyReviewScreen      = lazy(() => import('../../screens/WeeklyReviewScreen').then(m => ({ default: m.WeeklyReviewScreen })))
const DailyPlanRitualScreen   = lazy(() => import('../../screens/DailyPlanRitualScreen').then(m => ({ default: m.DailyPlanRitualScreen })))
const HabitAnalyticsScreen    = lazy(() => import('../../screens/HabitAnalyticsScreen').then(m => ({ default: m.HabitAnalyticsScreen })))
const CopingCardsScreen       = lazy(() => import('../../screens/CopingCardsScreen').then(m => ({ default: m.CopingCardsScreen })))
const CBTToolkitScreen        = lazy(() => import('../../screens/CBTToolkitScreen').then(m => ({ default: m.CBTToolkitScreen })))
const ProgressScreen          = lazy(() => import('../../screens/ProgressScreen').then(m => ({ default: m.ProgressScreen })))
const CalendarScreen          = lazy(() => import('../../screens/CalendarScreen').then(m => ({ default: m.CalendarScreen })))
const MoodEnergyScreen        = lazy(() => import('../../screens/MoodEnergyScreen').then(m => ({ default: m.MoodEnergyScreen })))
const InsightsScreen          = lazy(() => import('../../screens/InsightsScreen').then(m => ({ default: m.InsightsScreen })))
const MindfulnessScreen       = lazy(() => import('../../screens/MindfulnessScreen').then(m => ({ default: m.MindfulnessScreen })))
const PositivePsychologyScreen = lazy(() => import('../../screens/PositivePsychologyScreen').then(m => ({ default: m.PositivePsychologyScreen })))
const NeuroplasticityScreen   = lazy(() => import('../../screens/NeuroplasticityScreen').then(m => ({ default: m.NeuroplasticityScreen })))
const PomodoroScreen          = lazy(() => import('../../screens/PomodoroScreen').then(m => ({ default: m.PomodoroScreen })))
const FlashcardsScreen        = lazy(() => import('../../screens/FlashcardsScreen').then(m => ({ default: m.FlashcardsScreen })))
const ResourcesScreen         = lazy(() => import('../../screens/ResourcesScreen').then(m => ({ default: m.ResourcesScreen })))

// ── Nav data types ────────────────────────────────────────────────────────────

interface NavItem {
  id:        string
  icon:      string
  label:     string
  screen?:   Screen      // absent for expandable group parents
  children?: NavItem[]   // nested items (e.g. Exercises)
}

interface NavSection {
  key:   string
  label: string
  items: NavItem[]
}

// ── CORE (flat) ───────────────────────────────────────────────────────────────

const CORE_ITEMS: NavItem[] = [
  { id: 'inbox',       icon: 'inbox',   label: 'Inbox',         screen: { name: 'inbox' }       },
  { id: 'today',       icon: 'home',    label: 'Today',         screen: { name: 'today' }       },
  { id: 'all-tasks',   icon: 'layers',  label: 'Tasks',         screen: { name: 'all-tasks' }   },
  { id: 'all-habits',  icon: 'flame',   label: 'Habits',        screen: { name: 'all-habits' }  },
  { id: 'journal',     icon: 'journal', label: 'Journal',       screen: { name: 'journal' }     },
  { id: 'mood-energy', icon: 'drop',    label: 'Mood & Energy', screen: { name: 'mood-energy' } },
  { id: 'goals',       icon: 'target',  label: 'Goals',         screen: { name: 'goals' }       },
]

// ── GROW (collapsible) ────────────────────────────────────────────────────────

const GROW_SECTION: NavSection = {
  key: 'grow', label: 'GROW',
  items: [
    {
      id: 'exercises', icon: 'sparkle', label: 'Exercises',
      children: [
        { id: 'cbt-toolkit',         icon: 'heart',   label: 'CBT',                 screen: { name: 'cbt-toolkit' }         },
        { id: 'mindfulness',         icon: 'leaf',    label: 'Mindfulness',         screen: { name: 'mindfulness' }         },
        { id: 'positive-psychology', icon: 'sparkle', label: 'Positive Psychology', screen: { name: 'positive-psychology' } },
        { id: 'neuroplasticity',     icon: 'bolt',    label: 'Neuroplasticity',     screen: { name: 'neuroplasticity' }     },
      ],
    },
    { id: 'pomodoro',   icon: 'timer',  label: 'Pomodoro',   screen: { name: 'pomodoro' }   },
    { id: 'flashcards', icon: 'book',   label: 'Flashcards', screen: { name: 'flashcards' } },
    { id: 'resources',  icon: 'folder', label: 'Resources',  screen: { name: 'resources' }  },
  ],
}

// ── PROGRESS (collapsible) ────────────────────────────────────────────────────

const PROGRESS_SECTION: NavSection = {
  key: 'progress-nav', label: 'PROGRESS',
  items: [
    { id: 'review',   icon: 'bolt',  label: 'Weekly Review', screen: { name: 'review' }   },
    { id: 'insights', icon: 'chart', label: 'Insights',      screen: { name: 'insights' } },
  ],
}

const SETTINGS_ITEM: NavItem = { id: 'settings', icon: 'settings', label: 'Settings', screen: { name: 'settings' } }

// ── screenToNavId ─────────────────────────────────────────────────────────────

function screenToNavId(screen: Screen): string {
  switch (screen.name) {
    case 'today':
    case 'dashboard':           return 'today'
    case 'inbox':               return 'inbox'
    case 'all-tasks':
    case 'task':                return 'all-tasks'
    case 'all-habits':          return 'all-habits'
    case 'journal':             return 'journal'
    case 'mood-energy':
    case 'mood-tracking':
    case 'energy-score':        return 'mood-energy'
    case 'goals':
    case 'goal':                return 'goals'
    case 'category':            return 'today'
    case 'cbt-toolkit':
    case 'coping-cards':        return 'cbt-toolkit'
    case 'mindfulness':         return 'mindfulness'
    case 'positive-psychology': return 'positive-psychology'
    case 'neuroplasticity':     return 'neuroplasticity'
    case 'pomodoro':            return 'pomodoro'
    case 'flashcards':          return 'flashcards'
    case 'resources':           return 'resources'
    case 'review':              return 'review'
    case 'insights':
    case 'progress':
    case 'habit-analytics':     return 'insights'
    case 'settings':            return 'settings'
    case 'daily-plan':          return 'today'
    default:                    return 'today'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScreenLoadingFallback() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--rule)', borderTopColor: 'var(--ink-3)',
        animation: 'spin 0.6s linear infinite',
      }} />
    </div>
  )
}

// ── NavItemRow ────────────────────────────────────────────────────────────────

interface NavItemRowProps {
  item:    NavItem
  active:  boolean
  badge?:  number
  depth?:  number
  onClick: () => void
}

function NavItemRow({ item, active, badge, depth = 0, onClick }: NavItemRowProps) {
  const I = (Icons as Record<string, React.FC<{ size?: number }>>)[item.icon] ?? Icons.sparkle
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: depth > 0 ? '6px 12px 6px 28px' : '7px 12px',
        borderRadius: 9, textAlign: 'left',
        background: active ? 'var(--accent-soft, var(--paper-3))' : 'transparent',
        color:      active ? 'var(--accent)' : depth > 0 ? 'var(--ink-3)' : 'var(--ink-2)',
        fontWeight: active ? 600 : 400,
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      <I size={depth > 0 ? 13 : 15} />
      <span style={{
        flex: 1, fontSize: depth > 0 ? 12 : 13,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {item.label}
      </span>
      {!!badge && badge > 0 && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
          background: active ? 'var(--accent)' : 'var(--ink-4)',
          color: 'var(--paper)',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          letterSpacing: 0,
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

// ── SidebarContent ────────────────────────────────────────────────────────────

interface SidebarContentProps {
  activeId:    string
  badges:      Record<string, number>
  groupState:  Record<string, boolean>   // true = collapsed
  onToggle:    (key: string) => void
  onNavigate:  (s: Screen) => void
}

function SidebarContent({ activeId, badges, groupState, onToggle, onNavigate }: SidebarContentProps) {

  /** Render a single nav item, recursing into children */
  function renderItem(item: NavItem, depth = 0): React.ReactNode {
    const isParent   = (item.children?.length ?? 0) > 0
    const isExpanded = !groupState[item.id]   // not collapsed = expanded

    if (isParent) {
      const I = (Icons as Record<string, React.FC<{ size?: number }>>)[item.icon] ?? Icons.sparkle
      // Any child active?
      const childActive = item.children!.some(c => activeId === c.id)
      return (
        <div key={item.id}>
          <button
            onClick={() => onToggle(item.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 12px', borderRadius: 9, textAlign: 'left',
              background: childActive && !isExpanded ? 'var(--accent-soft, var(--paper-3))' : 'transparent',
              color: childActive ? 'var(--accent)' : 'var(--ink-3)',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <I size={15} />
            <span style={{ flex: 1, fontSize: 13, letterSpacing: '0.01em' }}>{item.label}</span>
            <span style={{
              fontSize: 9, opacity: 0.6,
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s', display: 'inline-block',
            }}>
              ▾
            </span>
          </button>
          {isExpanded && (
            <div style={{ marginLeft: 4 }}>
              {item.children!.map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    if (!item.screen) return null
    return (
      <NavItemRow
        key={item.id}
        item={item}
        active={activeId === item.id}
        badge={badges[item.id]}
        depth={depth}
        onClick={() => onNavigate(item.screen!)}
      />
    )
  }

  /** Render a collapsible section (GROW / PROGRESS) */
  function renderSection(section: NavSection) {
    const collapsed = !!groupState[section.key]
    return (
      <div key={section.key} style={{ marginBottom: 4 }}>
        <button
          onClick={() => onToggle(section.key)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 12px 4px',
            color: 'var(--ink-4)',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
            transition: 'color 0.12s',
          }}
        >
          {section.label}
          <span style={{
            fontSize: 9,
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s', display: 'inline-block', opacity: 0.6,
          }}>
            ▾
          </span>
        </button>
        {!collapsed && section.items.map(item => renderItem(item))}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '8px 10px 12px' }}>

      {/* CORE label */}
      <div style={{
        padding: '4px 12px 4px',
        color: 'var(--ink-4)',
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
        marginBottom: 2,
      }}>
        CORE
      </div>

      {/* CORE items */}
      <div style={{ marginBottom: 8 }}>
        {CORE_ITEMS.map(item => renderItem(item))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--rule)', margin: '2px 4px 8px' }} />

      {/* GROW section */}
      {renderSection(GROW_SECTION)}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--rule)', margin: '6px 4px 8px' }} />

      {/* PROGRESS section */}
      {renderSection(PROGRESS_SECTION)}

      {/* Push footer to bottom */}
      <div style={{ flex: 1 }} />

      {/* Footer divider */}
      <div style={{ height: 1, background: 'var(--rule)', margin: '8px 4px 4px' }} />

      {/* Settings */}
      <NavItemRow
        item={SETTINGS_ITEM}
        active={activeId === 'settings'}
        onClick={() => onNavigate({ name: 'settings' })}
      />
    </div>
  )
}

// ── PomodoroLauncher (stub) ───────────────────────────────────────────────────

function PomodoroLauncher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          height: 32, padding: '0 10px', borderRadius: 8,
          border: '1px solid var(--rule)', background: 'transparent',
          display: 'flex', alignItems: 'center', gap: 6,
          color: open ? 'var(--accent)' : 'var(--ink-2)',
          transition: 'color 0.12s',
        }}
      >
        <Icons.timer size={14} />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          Focus
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 220, zIndex: 200,
          background: 'var(--paper)', border: '1px solid var(--rule)',
          borderRadius: 12, boxShadow: 'var(--shadow-pop)',
          overflow: 'hidden',
          animation: 'fadeIn 0.12s ease',
        }}>
          <div style={{
            padding: '10px 14px 6px',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
            color: 'var(--ink-4)',
          }}>
            START A FOCUS SESSION
          </div>

          <button
            onClick={() => { window.dispatchEvent(new CustomEvent('pom:expand')); setOpen(false) }}
            style={{
              width: '100%', textAlign: 'left',
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid var(--rule)',
              color: 'var(--ink)', transition: 'background 0.1s',
            }}
          >
            <Icons.layers size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Link to a task</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                Open timer in task detail
              </div>
            </div>
          </button>

          <button
            onClick={() => { window.dispatchEvent(new Event('pom:start')); setOpen(false) }}
            style={{
              width: '100%', textAlign: 'left',
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--ink)', transition: 'background 0.1s',
            }}
          >
            <Icons.timer size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Just focus</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                Start a free 25-min session
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

// ── TopHeader ─────────────────────────────────────────────────────────────────

interface TopHeaderProps {
  isDesktop:   boolean
  drawerOpen:  boolean
  onHamburger: () => void
  onSearch:    () => void
  onCapture:   () => void
  onSettings:  () => void
}

function TopHeader({ isDesktop, drawerOpen, onHamburger, onSearch, onCapture, onSettings }: TopHeaderProps) {
  return (
    <div style={{
      height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 16px',
      background: 'var(--paper)',
      borderBottom: '1px solid var(--rule)',
      position: 'relative', zIndex: 50,
    }}>
      {/* Hamburger (mobile only) */}
      {!isDesktop && (
        <button
          onClick={onHamburger}
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          style={{
            width: 36, height: 36, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)', flexShrink: 0,
          }}
        >
          {drawerOpen
            ? <Icons.close size={18} />
            : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            )
          }
        </button>
      )}

      {/* Logo — mobile only; desktop has sidebar logo */}
      {!isDesktop && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-display)', fontSize: 15,
          color: 'var(--ink)', fontStyle: 'italic', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>🍌</span>
          <span>MBQ</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontStyle: 'normal',
            color: 'var(--ink-4)', letterSpacing: '0.06em',
            padding: '2px 5px', borderRadius: 4, border: '1px solid var(--rule)',
            background: 'var(--paper-2)',
          }}>
            v0.8
          </span>
        </div>
      )}

      {/* Search */}
      <button
        onClick={onSearch}
        style={{
          flex: 1, height: 32, borderRadius: 8,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '0 12px', color: 'var(--ink-4)',
          textAlign: 'left', maxWidth: 360,
        }}
      >
        <Icons.search size={13} />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', flex: 1 }}>
          Search
        </span>
        <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--ink-4)', opacity: 0.6 }}>
          ⌘K
        </kbd>
      </button>

      <div style={{ flex: 1 }} />

      {/* Pomodoro launcher */}
      <PomodoroLauncher />

      {/* Quick capture */}
      <button
        onClick={onCapture}
        aria-label="Quick capture"
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--ink)', color: 'var(--paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icons.plus size={16} />
      </button>

      {/* Settings */}
      <button
        onClick={onSettings}
        aria-label="Settings"
        style={{
          width: 32, height: 32, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-2)', flexShrink: 0,
        }}
      >
        <Icons.settings size={16} />
      </button>
    </div>
  )
}

// ── AppLayout ─────────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'authed' | 'unauthed'
type FabSheet  = 'none' | 'capture' | 'task' | 'goal' | 'menu' | 'voice'

interface Props {
  settings:   AppSettings | undefined
  categories: Category[] | undefined
  authState:  AuthState
  isOnline:   boolean
  onLogout:   () => void
}

export function AppLayout({ settings, categories, authState, isOnline, onLogout }: Props) {
  // ── Router ──────────────────────────────────────────────────────────────────
  const routerNavigate = useNavigate()
  const location       = useLocation()
  const screen         = locationToScreen(location.pathname, location.search)

  // ── Responsive ──────────────────────────────────────────────────────────────
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= MOBILE_BP)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= MOBILE_BP)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Navigation functions ───────────────────────────────────────────────────
  const navigate    = useCallback((s: Screen) => routerNavigate(screenToPath(s)),                    [routerNavigate])
  const back        = useCallback(() => routerNavigate(-1 as any),                                   [routerNavigate])
  const navigateTab = useCallback((s: Screen) => routerNavigate(screenToPath(s), { replace: true }), [routerNavigate])

  // ── Sheet / FAB state ──────────────────────────────────────────────────────
  const [fabSheet,    setFabSheet]    = useState<FabSheet>('none')
  const [taskPrefill, setTaskPrefill] = useState<TaskPrefill | null>(null)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [capToast,    setCapToast]    = useState(false)

  // ── Group state (sections + sub-groups) ────────────────────────────────────
  // true = collapsed/hidden; false/absent = expanded
  const [groupState, setGroupState] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(LS_NAV_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  const toggleGroup = useCallback((key: string) => {
    setGroupState(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(LS_NAV_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }, [])

  // ── Badge counts ──────────────────────────────────────────────────────────
  const inboxCount  = useLiveQuery(() => db.inboxItems.where('status').equals('inbox').count(), []) ?? 0
  const allTasks    = useLiveQuery(() => db.tasks.toArray(),  []) ?? []
  const allHabits   = useLiveQuery(() => db.habits.toArray(), []) ?? []

  const todayDueCount = useMemo(
    () => allTasks.filter(t => isDueToday(t.due) && !t.done && !t.isHabit).length,
    [allTasks],
  )
  const activeTasksCount = useMemo(
    () => allTasks.filter(t => t.status === 'active' && !t.done && !t.isHabit).length,
    [allTasks],
  )
  const habitsRemaining = useMemo(
    () => allHabits.filter(h => !h.done && !h.isArchived).length,
    [allHabits],
  )

  const badges: Record<string, number> = useMemo(() => ({
    inbox:       inboxCount,
    today:       todayDueCount + habitsRemaining,   // due tasks + pending habits
    'all-tasks': activeTasksCount,
    'all-habits': habitsRemaining,
  }), [inboxCount, todayDueCount, activeTasksCount, habitsRemaining])

  const activeNavId = screenToNavId(screen)

  // ── Cap-exceeded toast ─────────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      setCapToast(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setCapToast(false), 4000)
    }
    window.addEventListener('sync:cap-exceeded', handler)
    return () => { window.removeEventListener('sync:cap-exceeded', handler); if (timer) clearTimeout(timer) }
  }, [])

  // ── ⌘K shortcut → Quick Capture ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setFabSheet('capture') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Push notification deep-link ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const taskId = (e as CustomEvent<{ taskId?: string }>).detail?.taskId
      if (taskId) navigate({ name: 'task', taskId })
      else        navigate({ name: 'today' })
    }
    window.addEventListener('mbq:push-click', handler)
    return () => window.removeEventListener('mbq:push-click', handler)
  }, [navigate])

  // ── Close drawer on navigation ─────────────────────────────────────────────
  useEffect(() => { setDrawerOpen(false) }, [location.pathname, location.search])

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openAddTask  = useCallback((prefill?: TaskPrefill) => { setTaskPrefill(prefill ?? null); setFabSheet('task') }, [])
  const openCapture  = useCallback(() => setFabSheet('capture'), [])
  const openAddHabit = useCallback(() => { setTaskPrefill({ isHabit: true }); setFabSheet('task') }, [])
  const closeSheet   = useCallback(() => { setFabSheet('none'); setTaskPrefill(null) }, [])

  const currentCatId = screen.name === 'category' ? screen.catId : undefined

  // ── NavigationContext value ────────────────────────────────────────────────
  const ctxValue = useMemo(() => ({
    navigate, back, navigateTab, openAddTask, openCapture, openAddHabit, onLogout,
  }), [navigate, back, navigateTab, openAddTask, openCapture, openAddHabit, onLogout])

  const handleSidebarNavigate = useCallback((s: Screen) => { navigate(s); setDrawerOpen(false) }, [navigate])

  function handleFabMenuSelect(action: FabAction) {
    if (action === 'task')          { setTaskPrefill(null); setFabSheet('task') }
    else if (action === 'pomodoro') { setFabSheet('none'); window.dispatchEvent(new CustomEvent('pom:expand')) }
    else if (action === 'voice')    { setFabSheet('voice') }
    else                            { setFabSheet('none') }
  }

  // ── Sidebar panel (shared: desktop persistent + mobile drawer) ────────────
  const sidebarPanel = (
    <div style={{
      width: SIDEBAR_W, height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--paper)',
      borderRight: '1px solid var(--rule)',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Sidebar logo */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px',
        borderBottom: '1px solid var(--rule)',
      }}>
        <span style={{ fontSize: 20 }}>🍌</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink)' }}>
          MightyBanana
        </span>
      </div>

      <SidebarContent
        activeId={activeNavId}
        badges={badges}
        groupState={groupState}
        onToggle={toggleGroup}
        onNavigate={handleSidebarNavigate}
      />
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <NavigationContext.Provider value={ctxValue}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* System bars */}
        {authState === 'authed' && <SyncStatusBar />}
        {!isOnline && (
          <div style={{
            flexShrink: 0, padding: '6px 16px',
            background: 'var(--warn)', color: 'var(--paper)',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
            textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span>&#9888;</span> Working offline &mdash; changes sync when you reconnect
          </div>
        )}

        {/* Top header */}
        <TopHeader
          isDesktop={isDesktop}
          drawerOpen={drawerOpen}
          onHamburger={() => setDrawerOpen(d => !d)}
          onSearch={() => setSearchOpen(true)}
          onCapture={() => setFabSheet('capture')}
          onSettings={() => navigate({ name: 'settings' })}
        />

        {/* Body row */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* Desktop persistent sidebar */}
          {isDesktop && sidebarPanel}

          {/* Mobile drawer */}
          {!isDesktop && drawerOpen && (
            <>
              <div
                onClick={() => setDrawerOpen(false)}
                style={{ position: 'absolute', inset: 0, background: 'var(--overlay)', zIndex: 100 }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: SIDEBAR_W, zIndex: 101,
                animation: 'slideInLeft 0.2s ease',
              }}>
                {sidebarPanel}
              </div>
            </>
          )}

          {/* Content area */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <ScreenErrorBoundary key={location.pathname} name={screen.name}>
              <Suspense fallback={<ScreenLoadingFallback />}>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

                  {/* ── CORE ── */}
                  {(screen.name === 'today' || screen.name === 'dashboard') && <DashboardScreen />}
                  {screen.name === 'inbox'      && <InboxScreen />}
                  {screen.name === 'all-tasks'  && <AllTasksScreen screen={screen} />}
                  {screen.name === 'all-habits' && <AllHabitsScreen />}
                  {screen.name === 'journal'    && <JournalScreen phase={screen.phase} />}
                  {screen.name === 'mood-energy' && <MoodEnergyScreen />}
                  {screen.name === 'goals'      && <GoalsScreen />}

                  {/* ── Detail screens ── */}
                  {screen.name === 'task'     && <TaskDetailScreen taskId={screen.taskId} />}
                  {screen.name === 'goal'     && <GoalDetailScreen goalId={screen.goalId} />}
                  {screen.name === 'category' && (
                    <CategoryScreen catId={screen.catId} allCatIds={categories?.map(c => c.id) ?? []} />
                  )}
                  {screen.name === 'habit-analytics' && <HabitAnalyticsScreen />}
                  {screen.name === 'daily-plan'      && <DailyPlanRitualScreen />}
                  {screen.name === 'calendar'        && <CalendarScreen />}
                  {screen.name === 'settings'           && <SettingsScreen />}
                  {screen.name === 'workspace-settings' && <WorkspaceSettingsScreen />}

                  {/* ── GROW / Exercises ── */}
                  {screen.name === 'cbt-toolkit' && <CBTToolkitScreen />}
                  {screen.name === 'coping-cards' && <CopingCardsScreen />}
                  {screen.name === 'mindfulness'         && <MindfulnessScreen />}
                  {screen.name === 'positive-psychology' && <PositivePsychologyScreen />}
                  {screen.name === 'neuroplasticity'     && <NeuroplasticityScreen />}

                  {/* ── GROW / Tools ── */}
                  {screen.name === 'pomodoro'   && <PomodoroScreen />}
                  {screen.name === 'flashcards' && <FlashcardsScreen />}
                  {screen.name === 'resources'  && <ResourcesScreen />}

                  {/* ── PROGRESS ── */}
                  {screen.name === 'review'   && <WeeklyReviewScreen />}
                  {screen.name === 'insights' && <InsightsScreen />}
                  {screen.name === 'progress' && <ProgressScreen />}   {/* legacy deep-link */}

                  {/* ── System ── */}
                  {screen.name === 'onboarding' && (
                    <OnboardingScreen onDone={() => navigateTab({ name: 'today' })} />
                  )}
                  {screen.name === 'splash' && (
                    <SplashScreen
                      onDone={() => navigateTab(
                        settings?.onboarded ? { name: 'today' } : { name: 'onboarding' }
                      )}
                    />
                  )}

                </div>
              </Suspense>
            </ScreenErrorBoundary>
          </div>
        </div>

        {/* GlobalPomodoro widget */}
        <GlobalPomodoro workMins={settings?.defaultPomodoroMins ?? 25} />

        {/* Cap-exceeded toast */}
        {capToast && (
          <div style={{
            position: 'fixed', bottom: 20, left: 16, right: 16,
            maxWidth: 480, margin: '0 auto',
            zIndex: 9999, background: 'var(--ink)', color: 'var(--paper)',
            borderRadius: 12, padding: '12px 16px',
            fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.03em',
            boxShadow: 'var(--shadow-pop)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ opacity: 0.7 }}>⚠</span>
            <span>Active task limit reached — write not synced on this device</span>
          </div>
        )}

        {/* Sheets */}
        {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} navigate={navigate} />}

        {fabSheet === 'menu' && <FabMenu onSelect={handleFabMenuSelect} onClose={closeSheet} />}

        {fabSheet === 'capture' && (
          <QuickCaptureSheet
            onClose={closeSheet}
            onExpand={title => { setTaskPrefill({ title, catId: currentCatId }); setFabSheet('task') }}
            defaultCatId={currentCatId}
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
          <AddGoalSheet categories={categories} onClose={closeSheet} />
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
    </NavigationContext.Provider>
  )
}
