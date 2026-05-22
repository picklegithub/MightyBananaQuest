import { localDateISO } from '../lib/useCurrentDate'
import { isDueToday } from '../lib/parseDue'
import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, uncompleteTask, deleteTask, todayISO, getPinnedCard } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { ConfettiBurst } from '../components/ui'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { triggerSync } from '../components/SyncStatusBar'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { HeroBar } from '../components/layout/HeroBar'
import { CalendarPanel } from '../components/layout/CalendarPanel'
import { Badge } from '../components/ui/Badge'
import type { Screen, Task, DailyPlan } from '../types'
import { useNav } from '../lib/navContext'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { useIsDesktop } from '../lib/useIsDesktop'
import {
  AddAreaModal, HeroCard, TodayContextSheet,
  PlanRitualCard, Top3PinnedSection, JournalPrioritiesSection,
  UpcomingSection, AreaGrid, UpNextSection, TodayHabitsColumn,
} from '../components/dashboard'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

interface Props { navigate?: (s: Screen) => void }
interface Burst { id: number; x: number; y: number; xp: number }

export const DashboardScreen = ({ navigate: navProp }: Props) => {
  const { navigate: ctxNavigate } = useNav()
  const navigate = navProp ?? ctxNavigate
  const [bursts, setBursts]                     = useState<Burst[]>([])
  const [showAddArea, setShowAddArea]           = useState(false)
  const [undoTask, setUndoTask]                 = useState<{ id: string; title: string } | null>(null)
  const [showContextSheet, setShowContextSheet] = useState(false)
  const [copingDismissedDate, setCopingDismissedDate] = useState<string | null>(null)
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isColorful   = useIsColorful()
  const isDark       = useIsDark()
  const isDesktop    = useIsDesktop()

  const tasks    = useLiveQuery(() => db.tasks.toArray(), [])
  const goals    = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const habits   = useLiveQuery(() => db.habits.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const inboxItemCount = useLiveQuery(
    () => db.inboxItems.where('status').equals('inbox').count(), []
  ) ?? 0
  const todayPlan = useLiveQuery<DailyPlan | undefined>(
    () => db.dailyPlans.get(todayISO()), []
  )
  const todayMorningJournal = useLiveQuery(
    () => db.journal.where('date').equals(todayISO()).and(e => e.kind === 'morning').first(), []
  )
  const copingCard = useLiveQuery(() => getPinnedCard(), [])

  const yesterdayISO = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return localDateISO(d)
  })()
  const yesterdayEvening = useLiveQuery(
    () => db.journal.where('date').equals(yesterdayISO).and(e => e.kind === 'evening').first(), []
  )

  const { pullRatio, isPulling, containerProps } = usePullToRefresh(triggerSync, 72)

  if (!tasks || !settings) return null

  const allTodayTasks  = tasks.filter(t => isDueToday(t.due) && !t.isHabit)
  const doneTodayCount = allTodayTasks.filter(t => t.done).length
  const totalToday     = allTodayTasks.length
  const xp     = settings.xp ?? 0
  const streak = settings.streak ?? 0

  // Top active goal — first goal with at least one linked task and incomplete progress
  const topGoal = goals.length > 0 ? (() => {
    const scored = goals.map(g => {
      const linked = (tasks ?? []).filter(t => g.linked.includes(t.id) || t.goalId === g.id)
      const progress = linked.length > 0 ? linked.filter(t => t.done).length / linked.length : g.progress
      return { g, progress, linked: linked.length }
    })
    return scored.find(x => x.progress < 1) ?? scored[0] ?? null
  })() : null

  const isComplete        = !!todayPlan && todayPlan.completedAt !== null
  const hasTop3           = (todayPlan?.top3Ids?.length ?? 0) > 0
  const journalPinnedIds  = (todayMorningJournal?.priorityTaskIds ?? []).filter((id): id is string => !!id)
  const top3Set           = new Set([...(isComplete && hasTop3 ? todayPlan!.top3Ids : []), ...journalPinnedIds])
  // Active tasks with no due date surface here even without a scheduled date
  const activeTasks       = tasks.filter(t => t.status === 'active' && !t.done && !t.isHabit && !isDueToday(t.due) && !t.due)
  const upNextTasks       = [
    ...allTodayTasks.filter(t => !top3Set.has(t.id) && !t.done),
    ...activeTasks.filter(t => !top3Set.has(t.id)),
  ]

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) { await uncompleteTask(task.id); return }
    const { xp: gained } = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoTask({ id: task.id, title: task.title })
    undoTimerRef.current = setTimeout(() => setUndoTask(null), 4000)
  }

  async function handleUndo() {
    if (!undoTask) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoTask(null)
    await uncompleteTask(undoTask.id)
  }

  return (
    <div className="screen">
      {!isDesktop && (
        <>
          <ScreenHeader
            title={getGreeting()}
            icon={<Icons.home size={22} />}
            rightActions={<>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => navigate({ name: 'inbox' })}
                  aria-label="Inbox"
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    background: 'var(--paper-2)', border: '1px solid var(--rule)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-2)',
                  }}
                >
                  <Icons.inbox size={18} />
                </button>
                {(settings?.showInboxBadge ?? true) && <Badge count={inboxItemCount} />}
              </div>
              <ThemeToggle />
              <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
                <Icons.settings size={20} />
              </button>
            </>}
          />

          {/* HeroBar — today's at-a-glance stats (mobile only) */}
          {(() => {
            const todayTasks = (tasks ?? []).filter(t => isDueToday(t.due) && !t.isHabit)
            const doneCt     = todayTasks.filter(t => t.done).length
            const totalCt    = todayTasks.length
            const streak     = settings?.streak ?? 0
            const mood       = todayPlan?.mood ?? todayMorningJournal?.morningMood
            const moodGlyph  = mood === 'charged' ? '⚡' : mood === 'steady' ? '✦' : mood === 'tired' ? '○' : null
            return (
              <HeroBar stats={[
                { label: 'Tasks today', value: totalCt > 0 ? `${doneCt}/${totalCt}` : '—', tone: doneCt === totalCt && totalCt > 0 ? 'success' : 'default' },
                { label: 'Streak', value: streak > 0 ? `${streak}d` : '—', tone: streak >= 7 ? 'success' : 'default' },
                ...(moodGlyph ? [{ label: 'Mood', value: moodGlyph }] : []),
              ]} />
            )
          })()}
        </>
      )}

      <div className="screen-scroll" style={{ padding: '10px 0 16px' }} {...containerProps}>
        {isPulling && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: Math.round(pullRatio * 40), overflow: 'hidden', transition: 'height 0.1s' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--rule)', borderTopColor: 'var(--accent)', opacity: pullRatio, transform: `rotate(${pullRatio * 360}deg)` }} />
          </div>
        )}

        {showContextSheet && (
          <TodayContextSheet
            energy={yesterdayEvening?.energy}
            mood={todayPlan?.mood}
            onClose={() => setShowContextSheet(false)}
          />
        )}

        {isDesktop ? (
          /* ── 3-column desktop layout ── */
          <div style={{
            display: 'grid',
            gridTemplateColumns: '300px 1fr 280px',
            gap: '0 24px',
            padding: '8px 24px 40px',
            alignItems: 'start',
          }}>
            {/* LEFT — plan + progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '4px 20px 8px' }}>
                <div className="t-display" style={{ fontSize: 22, color: 'var(--ink)' }}>
                  {getGreeting()}
                </div>
              </div>
              <HeroCard
                done={doneTodayCount} total={totalToday} streak={streak} xp={xp}
                intensity={settings.intensity} onTap={() => navigate({ name: 'review' })}
                energy={yesterdayEvening?.energy} mood={todayPlan?.mood}
                onDotTap={() => setShowContextSheet(true)}
              />

              {topGoal && (
                <button
                  onClick={() => navigate({ name: 'goal', goalId: topGoal.g.id })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    margin: '0 20px', padding: '10px 14px',
                    borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)',
                    textAlign: 'left',
                  }}
                >
                  <Icons.target size={14} stroke="var(--ink-3)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {topGoal.g.title}
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'var(--rule)', marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${Math.round(topGoal.progress * 100)}%`, transition: 'width .4s ease' }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
                    {Math.round(topGoal.progress * 100)}%
                  </span>
                </button>
              )}

              {!hasTop3 && journalPinnedIds.length > 0 && (
                <JournalPrioritiesSection pinnedIds={journalPinnedIds} cats={cats} navigate={navigate} />
              )}

              {(settings.showPlanYourDay ?? true) && (isComplete ? (
                <>
                  {hasTop3 && <Top3PinnedSection top3Ids={todayPlan!.top3Ids} cats={cats} navigate={navigate} />}
                  <div style={{ padding: '4px 20px 0' }}>
                    <button onClick={() => navigate({ name: 'daily-plan' })} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
                      letterSpacing: '0.04em', padding: '7px 12px',
                      background: 'var(--paper-2)', border: '1px solid var(--rule)',
                      borderRadius: 20,
                    }}>
                      <Icons.reset size={12} /> Re-plan day
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <PlanRitualCard plan={todayPlan ?? null} navigate={navigate} />
                  {hasTop3 && todayPlan && <Top3PinnedSection top3Ids={todayPlan.top3Ids} cats={cats} navigate={navigate} />}
                </>
              ))}

              {todayPlan?.mood === 'tired' && copingCard && copingDismissedDate !== todayISO() && (
                <div style={{ padding: '0 20px 4px' }}>
                  <button onClick={() => navigate({ name: 'coping-cards' })} style={{ width: '100%', textAlign: 'left', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>🫂</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="eyebrow" style={{ marginBottom: 3 }}>pinned card</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{copingCard.title}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setCopingDismissedDate(todayISO()) }} style={{ color: 'var(--ink-4)', fontSize: 18, flexShrink: 0, padding: '0 2px' }} aria-label="Dismiss">×</button>
                  </button>
                </div>
              )}
            </div>

            {/* CENTER — tasks */}
            <div>
              <UpNextSection
                tasks={upNextTasks} cats={cats} isColorful={isColorful}
                navigate={navigate} handleComplete={handleComplete}
              />
              <UpcomingSection
                tasks={tasks} cats={cats} navigate={navigate}
                handleComplete={handleComplete} onDelete={id => deleteTask(id)}
              />
            </div>

            {/* RIGHT — habits + areas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: '16px 20px 0' }}>
                <TodayHabitsColumn
                  habits={habits ?? []} cats={cats} navigate={navigate}
                />
              </div>
              <AreaGrid
                tasks={tasks} cats={cats} navigate={navigate}
                isColorful={isColorful} isDark={isDark}
                onAddArea={() => setShowAddArea(true)}
              />
            </div>
          </div>
        ) : (
          /* ── Single-column mobile layout ── */
          <>
            <HeroCard
              done={doneTodayCount} total={totalToday} streak={streak} xp={xp}
              intensity={settings.intensity} onTap={() => navigate({ name: 'review' })}
              energy={yesterdayEvening?.energy} mood={todayPlan?.mood}
              onDotTap={() => setShowContextSheet(true)}
            />

            {topGoal && (
              <button
                onClick={() => navigate({ name: 'goal', goalId: topGoal.g.id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  margin: '0 20px 4px', padding: '10px 14px',
                  borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  textAlign: 'left', width: 'calc(100% - 40px)',
                }}
              >
                <Icons.target size={14} stroke="var(--ink-3)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topGoal.g.title}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--rule)', marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${Math.round(topGoal.progress * 100)}%`, transition: 'width .4s ease' }} />
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
                  {Math.round(topGoal.progress * 100)}%
                </span>
              </button>
            )}

            {!hasTop3 && journalPinnedIds.length > 0 && (
              <JournalPrioritiesSection pinnedIds={journalPinnedIds} cats={cats} navigate={navigate} />
            )}

            {(settings.showPlanYourDay ?? true) && (isComplete ? (
              <>
                {hasTop3 && <Top3PinnedSection top3Ids={todayPlan!.top3Ids} cats={cats} navigate={navigate} />}
                <div style={{ padding: '6px 20px 0' }}>
                  <button onClick={() => navigate({ name: 'daily-plan' })} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
                    letterSpacing: '0.04em', padding: '7px 12px',
                    background: 'var(--paper-2)', border: '1px solid var(--rule)',
                    borderRadius: 20,
                  }}>
                    <Icons.reset size={12} /> Re-plan day
                  </button>
                </div>
              </>
            ) : (
              <>
                <PlanRitualCard plan={todayPlan ?? null} navigate={navigate} />
                {hasTop3 && todayPlan && <Top3PinnedSection top3Ids={todayPlan.top3Ids} cats={cats} navigate={navigate} />}
              </>
            ))}

            {todayPlan?.mood === 'tired' && copingCard && copingDismissedDate !== todayISO() && (
              <div style={{ padding: '0 20px 4px' }}>
                <button onClick={() => navigate({ name: 'coping-cards' })} style={{ width: '100%', textAlign: 'left', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🫂</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="eyebrow" style={{ marginBottom: 3 }}>pinned card</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{copingCard.title}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setCopingDismissedDate(todayISO()) }} style={{ color: 'var(--ink-4)', fontSize: 18, flexShrink: 0, padding: '0 2px' }} aria-label="Dismiss">×</button>
                </button>
              </div>
            )}

            <UpNextSection
              tasks={upNextTasks} cats={cats} isColorful={isColorful}
              navigate={navigate} handleComplete={handleComplete}
            />

            <UpcomingSection
              tasks={tasks} cats={cats} navigate={navigate}
              handleComplete={handleComplete} onDelete={id => deleteTask(id)}
            />

            <AreaGrid
              tasks={tasks} cats={cats} navigate={navigate}
              isColorful={isColorful} isDark={isDark}
              onAddArea={() => setShowAddArea(true)}
            />

            <CalendarPanel />

            <div style={{ height: 24 }} />
          </>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
      {showAddArea && <AddAreaModal onClose={() => setShowAddArea(false)} />}

      {undoTask && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16, background: 'var(--ink)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 300, boxShadow: 'var(--shadow-pop)', animation: 'slideUp .2s ease' }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--paper)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {undoTask.title}</span>
          <button onClick={handleUndo} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', color: 'var(--accent)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', flexShrink: 0 }}>UNDO</button>
        </div>
      )}
    </div>
  )
}
