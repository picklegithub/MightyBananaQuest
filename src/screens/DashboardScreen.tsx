import { localDateISO } from '../lib/useCurrentDate'
import { isDueToday, isDueTomorrow } from '../lib/parseDue'
import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, uncompleteTask, addCategory, deleteTask, todayISO, getCopingCard } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { SectionHeader, ConfettiBurst } from '../components/ui'
import { useCurrentDate } from '../lib/useCurrentDate'
import { SwipeableRow } from '../components/SwipeableRow'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { triggerSync } from '../components/SyncStatusBar'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen, Task, Habit, Category, DailyPlan, CopingCard } from '../types'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

// ── Area icons available for custom areas ─────────────────────────────────────
const AREA_ICONS = ['home','heart','briefcase','book','dollar','family','leaf','drop','bolt','star','bell','layers','pet']


// ── Add Area Modal ────────────────────────────────────────────────────────────
function AddAreaModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('home')
  const [hue, setHue]   = useState(200)
  const isDark           = useIsDark()

  async function handleSave() {
    if (!name.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await addCategory({ id: `${id}-${Date.now()}`, name: name.trim(), icon, hue })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 22 }}>New Area</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Name</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Pets, Pool, Mindfulness…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AREA_ICONS.map(ic => {
                const I = Icons[ic] ?? Icons.home
                return (
                  <button key={ic} onClick={() => setIcon(ic)} style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: icon === ic ? areaColor(hue, 'fg', isDark) : 'var(--paper-2)',
                    color: icon === ic ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: icon === ic ? 'transparent' : 'var(--rule)',
                  }}>
                    <I size={18} />
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Colour — hue {hue}°</div>
            <input type="range" min={0} max={360} value={hue} onChange={e => setHue(Number(e.target.value))}
              style={{ width: '100%', accentColor: `hsl(${hue},55%,42%)` }} />
            <div style={{ height: 24, borderRadius: 8, marginTop: 8, background: `hsl(${hue},55%,42%)` }} />
          </div>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: name.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: name.trim() ? 'var(--paper)' : 'var(--ink-3)',
          }}>
            Add area
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Flat transparent row — no opaque background so SwipeableRow green/red shows ─
function DashboardTaskRow({
  task, hue, onTap, onComplete,
}: {
  task: Task; hue?: number; onTap: () => void; onComplete: (e: React.MouseEvent) => void
}) {
  const isDark = useIsDark()
  const accent = hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--accent)'
  return (
    <div onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px 10px 8px',
      borderBottom: '1px solid var(--rule)',
      borderLeft: `3px solid ${accent}`,
      cursor: 'pointer', opacity: task.done ? 0.45 : 1,
    }}>
      <button onClick={e => { e.stopPropagation(); onComplete(e) }} style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        border: `1.5px solid ${task.done ? accent : 'var(--ink-3)'}`,
        background: task.done ? accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <Icons.check size={12} sw={2.5} stroke="var(--paper)" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500,
          textDecoration: task.done ? 'line-through' : 'none',
          color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        {task.due && !isDueToday(task.due) && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>
            {task.due}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dark hero card ────────────────────────────────────────────────────────────
// Full-bleed var(--ink) card: done/total, streak + XP stats, progress bar,
// level chip. Gated on intensity for the stats and level rows.
function energyDotColor(energy?: 1 | 2 | 3 | null): string {
  if (energy === 3) return 'hsl(140,55%,42%)'  // Strong — green
  if (energy === 2) return 'hsl(38,85%,52%)'   // Okay — amber
  return 'rgba(255,255,255,0.28)'               // Low / no data — grey
}

function HeroCard({
  done, total, streak, xp, intensity, onTap,
  energy, isTired, onDotTap,
}: {
  done: number; total: number; streak: number; xp: number
  intensity: 'subtle' | 'balanced' | 'loud'
  onTap: () => void
  energy?: 1 | 2 | 3 | null
  isTired?: boolean
  onDotTap?: () => void
}) {
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0
  const level  = Math.floor(xp / 1000) + 1
  const toNext = 1000 - (xp % 1000)
  const showStats = intensity !== 'subtle'

  return (
    <button
      onClick={onTap}
      style={{
        display: 'block', textAlign: 'left',
        margin: '4px 20px 8px', width: 'calc(100% - 40px)',
        padding: 20, borderRadius: 18,
        background: 'var(--ink)', color: 'var(--paper)',
        position: 'relative', overflow: 'hidden',
        border: 'none',
      }}
    >
      {/* Energy dot — top-right corner */}
      <button
        onClick={e => { e.stopPropagation(); onDotTap?.() }}
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 8, height: 8, borderRadius: '50%',
          background: energyDotColor(energy),
          padding: 0, border: 'none',
          cursor: onDotTap ? 'pointer' : 'default',
        }}
        aria-label="Today's context"
      />

      {/* Top row: done/total + stats chips */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            opacity: 0.6, letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            Today's progress
          </div>
          <div className="t-display" style={{ fontSize: 48, marginTop: 6, lineHeight: 1 }}>
            {done}
            <span style={{ opacity: 0.45, fontSize: 28 }}> / {total}</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            tasks complete · {pct}%
          </div>
        </div>

        {showStats && (
          <div style={{ display: 'flex', gap: 14, marginTop: 4, marginRight: 16 }}>
            {streak > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                  <Icons.flame size={13} stroke="rgba(255,255,255,0.75)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{streak}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.5, letterSpacing: '0.08em', marginTop: 2 }}>STREAK</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <Icons.bolt size={13} stroke="rgba(255,255,255,0.75)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.5, letterSpacing: '0.08em', marginTop: 2 }}>XP</div>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar — desaturated when tired */}
      <div style={{
        marginTop: 18, height: 4,
        background: 'rgba(255,255,255,0.12)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: isTired ? 'rgba(255,255,255,0.35)' : 'var(--accent-soft)',
          borderRadius: 2,
          transition: 'width .4s ease',
          filter: isTired ? 'saturate(0)' : 'none',
        }} />
      </div>

      {/* Level chip */}
      {showStats && (
        <div style={{
          marginTop: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.65,
        }}>
          <span>LVL {level}{isTired ? ' · LIGHT DAY' : ' · STEADY'}</span>
          <span>{toNext.toLocaleString()} XP TO LVL {level + 1}</span>
        </div>
      )}
    </button>
  )
}

// ── Today's context bottom sheet ──────────────────────────────────────────────
function TodayContextSheet({
  energy, mood, onClose,
}: {
  energy?: 1 | 2 | 3 | null
  mood?: 'steady' | 'tired' | 'charged' | null
  onClose: () => void
}) {
  const ENERGY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Okay', 3: 'Strong' }
  const ENERGY_EMOJI:  Record<number, string> = { 1: '🌱',  2: '☀️',   3: '⚡' }
  const MOOD_LABELS = { steady: 'Steady', tired: 'Tired', charged: 'Charged' }
  const MOOD_EMOJI  = { steady: '😌', tired: '😴', charged: '⚡' }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)' }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--paper)', borderRadius: '20px 20px 0 0',
        padding: `24px 24px calc(32px + env(safe-area-inset-bottom))`,
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--rule)', margin: '0 auto 20px',
        }} />

        <div className="eyebrow" style={{ marginBottom: 16 }}>Today's context</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Yesterday energy */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            <span style={{ fontSize: 20 }}>{energy ? ENERGY_EMOJI[energy] : '—'}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 3 }}>YESTERDAY'S ENERGY</div>
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>
                {energy ? ENERGY_LABELS[energy] : 'Not logged'}
              </div>
            </div>
          </div>

          {/* Today's mood */}
          {mood && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <span style={{ fontSize: 20 }}>{MOOD_EMOJI[mood]}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 3 }}>TODAY'S MOOD</div>
                <div style={{ fontSize: 14, color: 'var(--ink)' }}>{MOOD_LABELS[mood]}</div>
              </div>
            </div>
          )}
        </div>

        {mood === 'tired' && (
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6,
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
          }}>
            A lighter day is still progress. Protect your energy.
          </div>
        )}
      </div>
    </>
  )
}

interface Props {
  navigate: (s: Screen) => void
}

interface Burst { id: number; x: number; y: number; xp: number }

export const DashboardScreen = ({ navigate }: Props) => {
  const [bursts, setBursts]           = useState<Burst[]>([])
  const [showAddArea, setShowAddArea] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [undoTask,    setUndoTask]    = useState<{ id: string; title: string } | null>(null)
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copingDismissedDate, setCopingDismissedDate] = useState<string | null>(null)
  const isColorful = useIsColorful()
  const isDark     = useIsDark()
  const { day, date } = useCurrentDate()

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const tasks    = useLiveQuery(() => db.tasks.toArray(), [])
  const habits   = useLiveQuery(() => db.habits.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const inboxCount = useLiveQuery(
    () => db.tasks.where('cat').equals('inbox').filter(t => !t.done).count(),
    []
  )
  // Live plan row for today — drives PlanRitualCard + Top3PinnedSection
  const todayPlan = useLiveQuery<DailyPlan | undefined>(
    () => db.dailyPlans.get(todayISO()),
    []
  )
  // Today's morning journal — for journal-pinned priorities (independent of plan ritual)
  const todayMorningJournal = useLiveQuery(
    () => db.journal.where('date').equals(todayISO()).and(e => e.kind === 'morning').first(),
    []
  )
  const copingCard = useLiveQuery(() => getCopingCard(), [])

  // Yesterday's evening journal — for energy dot on HeroCard
  const yesterdayISO = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return localDateISO(d)
  })()
  const yesterdayEvening = useLiveQuery(
    () => db.journal.where('date').equals(yesterdayISO).and(e => e.kind === 'evening').first(),
    []
  )

  const [showContextSheet, setShowContextSheet] = useState(false)

  const { pullRatio, isPulling, containerProps } = usePullToRefresh(triggerSync, 72)

  if (!tasks || !settings) return null

  const habitTasks    = habits ?? []
  const habitPending  = habitTasks.filter(h => !h.done).length
  const allTodayTasks = tasks.filter(t =>
    isDueToday(t.due) && !t.isHabit
  )
  const doneTodayCount = allTodayTasks.filter(t => t.done).length
  const totalToday = allTodayTasks.length
  const xp = settings.xp ?? 0
  const streak = settings.streak ?? 0

  // Derived plan flags used in the render below
  const isComplete = !!todayPlan && todayPlan.completedAt !== null
  const hasTop3    = (todayPlan?.top3Ids?.length ?? 0) > 0

  // Journal-pinned task IDs from morning priorities (independent of plan ritual)
  const journalPinnedIds = (todayMorningJournal?.priorityTaskIds ?? [])
    .filter((id): id is string => !!id)

  // Tasks due tomorrow — shown in Upcoming strip (max 3, read-only)
  const upcomingTasks = tasks
    .filter(t => !t.done && !t.isHabit && isDueTomorrow(t.due))
    .slice(0, 3)

  // Exclude Top 3 tasks and journal-pinned tasks from Up Next to prevent duplicates
  const top3Set      = new Set([
    ...(isComplete && hasTop3 ? todayPlan!.top3Ids : []),
    ...journalPinnedIds,
  ])
  const upNextTasks  = allTodayTasks.filter(t => !top3Set.has(t.id) && !t.done)

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
      <ScreenHeader
        title={getGreeting()}
        rightActions={<>
          <ThemeToggle />
          <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
            <Icons.settings size={20} />
          </button>
        </>}
      />

      <div className="screen-scroll" style={{ padding: '10px 0 16px' }} {...containerProps}>
        {/* Pull-to-refresh indicator */}
        {isPulling && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: Math.round(pullRatio * 40),
            overflow: 'hidden', transition: 'height 0.1s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: '2px solid var(--rule)',
              borderTopColor: 'var(--accent)',
              opacity: pullRatio,
              transform: `rotate(${pullRatio * 360}deg)`,
            }} />
          </div>
        )}

        {/* ── Dark hero card — Today's progress ────────────────────────────── */}
        {showContextSheet && (
          <TodayContextSheet
            energy={yesterdayEvening?.energy}
            mood={todayPlan?.mood}
            onClose={() => setShowContextSheet(false)}
          />
        )}
        <HeroCard
          done={doneTodayCount}
          total={totalToday}
          streak={streak}
          xp={xp}
          intensity={settings.intensity}
          onTap={() => navigate({ name: 'review' })}
          energy={yesterdayEvening?.energy}
          isTired={todayPlan?.mood === 'tired'}
          onDotTap={() => setShowContextSheet(true)}
        />

        {/* ── Journal-pinned priorities — only when ritual not yet done */}
        {!isComplete && journalPinnedIds.length > 0 && (
          <JournalPrioritiesSection pinnedIds={journalPinnedIds} cats={cats} navigate={navigate} />
        )}

        {/* ── Top 3 hero (plan done) OR Plan ritual CTA ── */}
        {(settings.showPlanYourDay ?? true) && (isComplete ? (
          <>
            {hasTop3 && (
              <Top3PinnedSection top3Ids={todayPlan!.top3Ids} cats={cats} navigate={navigate} />
            )}
            <div style={{ padding: '2px 20px 0' }}>
              <button
                onClick={() => navigate({ name: 'daily-plan' })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '0.04em', padding: '8px 0',
                }}
              >
                <Icons.reset size={12} /> Re-plan day
              </button>
            </div>
          </>
        ) : (
          <>
            <PlanRitualCard plan={todayPlan ?? null} navigate={navigate} />
            {hasTop3 && todayPlan && (
              <Top3PinnedSection top3Ids={todayPlan.top3Ids} cats={cats} navigate={navigate} />
            )}
          </>
        ))}

        {/* ── Coping card surface — shown when today's plan mood = tired ── */}
        {todayPlan?.mood === 'tired' && copingCard?.content && copingDismissedDate !== todayISO() && (
          <div style={{ padding: '0 20px 4px' }}>
            <button
              onClick={() => navigate({ name: 'journal' })}
              style={{
                width: '100%', textAlign: 'left',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0, paddingTop: 1 }}>🫂</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
                }}>Coping card</div>
                <div style={{
                  fontSize: 13, color: 'var(--ink-2)',
                  fontFamily: 'var(--font-display)', fontStyle: 'italic',
                  lineHeight: 1.5,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {copingCard.content.split('\n')[0].slice(0, 72)}
                  {copingCard.content.length > 72 ? '…' : ''}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setCopingDismissedDate(todayISO()) }}
                style={{ color: 'var(--ink-4)', fontSize: 18, flexShrink: 0, padding: '0 2px' }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </button>
          </div>
        )}

        {/* Today's tasks — Top 3 already shown above; Up Next shows the remainder */}
        {upNextTasks.length > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <SectionHeader title="Up Next" action={
              <button onClick={() => navigate({ name: 'all-tasks' })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                ALL <Icons.arrow size={12} />
              </button>
            } />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upNextTasks.map(task => {
                const taskHue = isColorful ? cats.find((c: Category) => c.id === task.cat)?.hue : undefined
                const isExpanded = expandedIds.has(task.id)
                return (
                  <div key={task.id}>
                    <SwipeableRow
                      done={task.done}
                      onComplete={() => task.done ? uncompleteTask(task.id) : completeTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                    >
                      <DashboardTaskRow
                        task={task}
                        hue={taskHue}
                        onTap={() => navigate({ name: 'task', taskId: task.id })}
                        onComplete={e => handleComplete(e, task)}
                      />
                    </SwipeableRow>
                    {isExpanded && (task.sub?.length ?? 0) > 0 && (
                      <div style={{
                        marginLeft: 14, paddingLeft: 22,
                        borderLeft: `2px solid ${taskHue !== undefined ? `hsl(${taskHue}, 40%, 80%)` : 'var(--rule)'}`,
                        marginBottom: 2,
                      }}>
                        {task.sub.map((s, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 4px',
                            borderBottom: i < task.sub.length - 1 ? '1px solid var(--rule)' : 'none',
                            opacity: s.d ? 0.5 : 1,
                          }}>
                            <div style={{
                              width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                              border: `1.5px solid ${s.d ? (taskHue !== undefined ? `hsl(${taskHue}, 55%, 42%)` : 'var(--accent)') : 'var(--rule)'}`,
                              background: s.d ? (taskHue !== undefined ? `hsl(${taskHue}, 55%, 42%)` : 'var(--accent)') : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {s.d && <Icons.check size={8} sw={2.5} stroke="var(--paper)" />}
                            </div>
                            <span style={{
                              fontSize: 12, color: s.d ? 'var(--ink-3)' : 'var(--ink)',
                              textDecoration: s.d ? 'line-through' : 'none',
                            }}>
                              {s.t}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Upcoming — tasks due tomorrow, read-only ── */}
        {upcomingTasks.length > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <SectionHeader title="Upcoming" />
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingTasks.map(task => {
                const taskHue = isColorful ? cats.find((c: Category) => c.id === task.cat)?.hue : undefined
                const color = taskHue !== undefined ? `hsl(${taskHue}, 55%, 42%)` : 'var(--ink-3)'
                return (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 10,
                    background: 'var(--paper-2)', border: '1px solid var(--rule)',
                    borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {task.title}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                      Tomorrow
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Lists row — Inbox, Shopping, Habits (horizontal, demoted from area grid) ── */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: 'var(--ink-4)',
            marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
          }}>
            Lists
          </div>
          <div style={{ display: 'flex', gap: 8 }}>

            {/* Inbox */}
            <button
              onClick={() => navigate({ name: 'inbox' })}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 10, textAlign: 'left',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: areaColor(205, 'bg', isDark), color: areaColor(205, 'fg', isDark),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.inbox size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>Inbox</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 1 }}>
                  {(inboxCount ?? 0) > 0 ? `${inboxCount} new` : 'all clear'}
                </div>
              </div>
              {(inboxCount ?? 0) > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'white', letterSpacing: '0.04em',
                  background: 'var(--warn)', borderRadius: 10, padding: '2px 6px', fontWeight: 600, flexShrink: 0,
                }}>
                  {inboxCount}
                </span>
              )}
            </button>

            {/* Habits — only shown when habits exist */}
            {habitTasks.length > 0 && (
              <button
                onClick={() => navigate({ name: 'all-habits' })}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 10, textAlign: 'left',
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `hsl(280, 35%, 92%)`, color: `hsl(280, 50%, 44%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icons.repeat size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>Habits</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 1 }}>
                    {habitPending > 0 ? `${habitPending} to log` : 'all logged'}
                  </div>
                </div>
                {habitPending > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'white', letterSpacing: '0.04em',
                    background: `hsl(280, 55%, 48%)`, borderRadius: 10, padding: '2px 6px', fontWeight: 600, flexShrink: 0,
                  }}>
                    {habitPending}
                  </span>
                )}
              </button>
            )}

          </div>
        </div>

        {/* ── Areas grid — pure area cards only ── */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
              Areas
            </span>
            <button
              onClick={() => navigate({ name: 'category', catId: cats[0]?.id ?? '' })}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              SEE ALL <Icons.arrow size={11} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

            {/* ── Area cards ── */}
            {cats.map((cat: Category) => {
              const catTasks  = tasks.filter(t => t.cat === cat.id)
              const catDone   = catTasks.filter(t => t.done).length
              const catOpen   = catTasks.filter(t => !t.done).length
              const catTotal  = catTasks.length
              const recurringCount = catTasks.filter(t => !!t.recurring).length
              const progress  = catTotal > 0 ? catDone / catTotal : 0
              const I = Icons[cat.icon] ?? Icons.home
              const hue = cat.hue
              // Mini ring SVG values
              const R = 11, C = 2 * Math.PI * R

              return (
                <div key={cat.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => navigate({ name: 'category', catId: cat.id })}
                    style={{
                      width: '100%', padding: '11px 10px 10px', borderRadius: 12, textAlign: 'left',
                      background: 'var(--paper-2)', border: '1px solid var(--rule)',
                      display: 'flex', flexDirection: 'column', gap: 7,
                    }}
                  >
                    {/* Top row: icon + mini progress ring */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: isColorful ? areaColor(hue, 'bg', isDark) : 'var(--paper-2)',
                        color: isColorful ? areaColor(hue, 'fg', isDark) : 'var(--ink-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <I size={14} />
                      </div>
                      {catTotal > 0 && (
                        <svg width={26} height={26} style={{ flexShrink: 0 }}>
                          <circle cx={13} cy={13} r={R} fill="none" stroke="var(--rule)" strokeWidth={2.5} />
                          <circle cx={13} cy={13} r={R} fill="none"
                            stroke={isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'} strokeWidth={2.5}
                            strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                            strokeLinecap="round" transform="rotate(-90 13 13)" />
                        </svg>
                      )}
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{cat.name}</div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {catOpen > 0 ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                          {catOpen} open
                        </span>
                      ) : catTotal > 0 ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)', letterSpacing: '0.04em' }}>
                          ✓ all done
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                          empty
                        </span>
                      )}
                      {recurringCount > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Icons.repeat size={8} />{recurringCount}
                        </span>
                      )}
                    </div>
                  </button>

                </div>
              )
            })}

            {/* Add Area button */}
            <button onClick={() => setShowAddArea(true)} style={{
              padding: '12px 10px', borderRadius: 12, textAlign: 'left',
              background: 'transparent', border: '1px dashed var(--rule)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 72,
            }}>
              <Icons.plus size={18} style={{ color: 'var(--ink-4)' }} />
              <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>ADD AREA</span>
            </button>

          </div>
        </div>

      </div>

      {/* Confetti bursts */}
      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
      {showAddArea && <AddAreaModal onClose={() => setShowAddArea(false)} />}

      {/* Undo toast */}
      {undoTask && (
        <div style={{
          position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16,
          background: 'var(--ink)', borderRadius: 12, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          animation: 'slideUp .2s ease',
        }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--paper)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ✓ {undoTask.title}
          </span>
          <button
            onClick={handleUndo}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
              color: 'var(--accent)', padding: '4px 10px', borderRadius: 8,
              border: '1px solid var(--accent)', background: 'transparent', flexShrink: 0,
            }}
          >
            UNDO
          </button>
        </div>
      )}
    </div>
  )
}


// ── Plan Ritual Card ──────────────────────────────────────────────────────────
/**
 * Shows above Today tasks. Three states:
 *  • No plan row yet      → won't render (auto-launch effect handles it)
 *  • plan.completedAt null → skipped — show a gentle "Re-plan" nudge
 *  • plan.completedAt set  → completed — show compact summary + re-plan option
 */
function PlanRitualCard({ plan, navigate }: { plan: DailyPlan | null; navigate: (s: Screen) => void }) {
  // plan === null  → not started yet → show "Plan your day" prompt
  // plan with completedAt → done → show compact summary
  const isComplete = plan !== null && plan.completedAt !== null
  const picked     = plan?.pickedIds.length ?? 0
  const top3       = plan?.top3Ids.length ?? 0

  return (
    <div style={{ padding: '12px 20px 0' }}>
      <button
        onClick={() => navigate({ name: 'daily-plan' })}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12, textAlign: 'left',
          background: isComplete ? 'var(--paper-2)' : `hsl(42, 80%, 96%)`,
          border: `1px solid ${isComplete ? 'var(--rule)' : 'hsl(42, 60%, 80%)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        {/* Icon dot */}
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: isComplete ? 'var(--paper-3)' : `hsl(42, 70%, 88%)`,
          color: isComplete ? 'var(--ink-3)' : `hsl(42, 55%, 38%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.sun size={16} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isComplete ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Day planned ✓
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 1 }}>
                {top3} pinned · {picked} tasks picked · tap to re-plan
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: `hsl(42, 50%, 32%)` }}>
                Plan your day
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: `hsl(42, 40%, 48%)`, letterSpacing: '0.04em', marginTop: 1 }}>
                tap to run the morning ritual
              </div>
            </>
          )}
        </div>

        <Icons.arrow size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      </button>
    </div>
  )
}

// ── Top 3 Pinned Section ──────────────────────────────────────────────────────
/**
 * Resolves top3Ids (tasks or habits) and renders them as priority pills
 * pinned just below the plan card, above the full Today list.
 */
function Top3PinnedSection({ top3Ids, cats, navigate }: {
  top3Ids: string[]
  cats: Category[]
  navigate: (s: Screen) => void
}) {
  const isDark     = useIsDark()
  const items = useLiveQuery(async () => {
    const [tasks, habits] = await Promise.all([
      db.tasks.bulkGet(top3Ids),
      db.habits.bulkGet(top3Ids),
    ])
    // Merge and keep original order
    return top3Ids
      .map(id => {
        const t = tasks.find(x => x?.id === id)
        const h = habits.find(x => x?.id === id)
        return (t ?? h) as (Task | Habit) | undefined
      })
      .filter((x): x is Task | Habit => x !== undefined)
  }, [top3Ids.join(',')])

  const isColorful = useIsColorful()

  if (!items || items.length === 0) return null

  return (
    <div style={{ padding: '10px 20px 0' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--ink-4)',
        marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
      }}>
        Top 3 priorities
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((item, idx) => {
          const isTask = 'due' in item
          const rawHue = isTask
            ? (cats.find(c => c.id === (item as Task).cat)?.hue ?? 220)
            : (cats.find(c => c.id === (item as Habit).cat)?.hue ?? 220)
          const hue = isColorful ? rawHue : 0
          const isDone = isTask ? (item as Task).done : (item as Habit).done

          return (
            <button
              key={item.id}
              onClick={() => isTask ? navigate({ name: 'task', taskId: item.id }) : navigate({ name: 'all-habits' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, textAlign: 'left', width: '100%',
                background: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                borderLeft: `3px solid ${isDone ? 'var(--rule)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)')}`,
                opacity: isDone ? 0.6 : 1,
              }}
            >
              {/* Rank circle */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: isDone ? 'var(--paper-3)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'),
                color: isDone ? 'var(--ink-3)' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              }}>
                {isDone ? <Icons.check size={10} sw={2.5} /> : idx + 1}
              </div>

              {/* Title */}
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                color: isDone ? 'var(--ink-3)' : 'var(--ink)',
                textDecoration: isDone ? 'line-through' : 'none',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {item.title}
              </span>

              {/* Habit badge */}
              {!isTask && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                  color: isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)', background: 'var(--paper-3)',
                  borderRadius: 6, padding: '2px 6px', flexShrink: 0,
                }}>
                  HABIT
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Journal Priorities Section ────────────────────────────────────────────────
/**
 * Shown when the user has pinned tasks from the morning journal's priority slots.
 * Independent of the Plan Your Day ritual — appears even when showPlanYourDay is off.
 */
function JournalPrioritiesSection({ pinnedIds, cats, navigate }: {
  pinnedIds: string[]
  cats: Category[]
  navigate: (s: Screen) => void
}) {
  const tasks = useLiveQuery(
    () => db.tasks.bulkGet(pinnedIds),
    [pinnedIds.join(',')]
  )
  const isColorful = useIsColorful()
  const isDark     = useIsDark()

  const items = (tasks ?? []).filter((t): t is Task => !!t)
  if (items.length === 0) return null

  return (
    <div style={{ padding: '10px 20px 0' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--ink-4)',
        marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>⭐</span> Morning priorities
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((task, idx) => {
          const hue = isColorful ? (cats.find(c => c.id === task.cat)?.hue ?? 220) : 0
          return (
            <button
              key={task.id}
              onClick={() => navigate({ name: 'task', taskId: task.id })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, textAlign: 'left', width: '100%',
                background: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                borderLeft: `3px solid ${task.done ? 'var(--rule)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)')}`,
                opacity: task.done ? 0.6 : 1,
              }}
            >
              {/* Rank circle */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: task.done ? 'var(--paper-3)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'),
                color: task.done ? 'var(--ink-3)' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              }}>
                {task.done ? <Icons.check size={10} sw={2.5} /> : idx + 1}
              </div>
              {/* Title */}
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                color: task.done ? 'var(--ink-3)' : 'var(--ink)',
                textDecoration: task.done ? 'line-through' : 'none',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {task.title}
              </span>
              <Icons.arrow size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Upcoming section ──────────────────────────────────────────────────────────

function UpcomingSection({ tasks, cats, navigate, handleComplete, onDelete }: {
  tasks: Task[]
  cats: Category[]
  navigate: (s: Screen) => void
  handleComplete: (e: React.MouseEvent, task: Task) => void
  onDelete: (id: string) => void
}) {
  const todayISO     = localDateISO()
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowISO  = tomorrowDate.toISOString().slice(0, 10)
  const isoRe        = /^\d{4}-\d{2}-\d{2}$/

  const overdue   = tasks.filter(t => !t.done && !t.isHabit && isoRe.test(t.due) && t.due < todayISO)
  const tomorrow  = tasks.filter(t => !t.done && !t.isHabit && (t.due === 'Tomorrow' || t.due === tomorrowISO))
  const upcoming  = tasks.filter(t =>
    !t.done && !t.isHabit &&
    !isDueToday(t.due) && !isDueTomorrow(t.due) && t.due !== '' &&
    !(isoRe.test(t.due) && t.due <= tomorrowISO)
  )

  // Split upcoming into ISO-dated tasks and label-only tasks (Someday, etc.)
  const dateBound = [...upcoming]
    .filter(t => isoRe.test(t.due))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
  const someday = upcoming.filter(t => !isoRe.test(t.due))

  const hasAny = overdue.length > 0 || tomorrow.length > 0 || dateBound.length > 0 || someday.length > 0
  if (!hasAny) return null

  function TaskGroup({ label, labelColor, tasks: group }: { label: string; labelColor?: string; tasks: Task[] }) {
    if (group.length === 0) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
          color: labelColor ?? 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase',
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {group.map(task => (
            <SwipeableRow
              key={task.id}
              disabled={task.done}
              onComplete={() => completeTask(task.id)}
              onDelete={() => onDelete(task.id)}
            >
              <DashboardTaskRow
                task={task}
                hue={cats.find(c => c.id === task.cat)?.hue}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={e => handleComplete(e, task)}
              />
            </SwipeableRow>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <SectionHeader title="Upcoming" action={
        <button onClick={() => navigate({ name: 'all-tasks' })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
          ALL <Icons.arrow size={12} />
        </button>
      } />
      <div style={{ marginTop: 12 }}>
        <TaskGroup label={`Overdue \u00B7 ${overdue.length}`} labelColor="var(--warn)" tasks={overdue} />
        <TaskGroup label="Tomorrow" tasks={tomorrow} />
        <TaskGroup label="Later" tasks={dateBound.slice(0, 5)} />
        {dateBound.length > 5 && (
          <button onClick={() => navigate({ name: 'all-tasks' })} style={{
            padding: '10px 14px', borderRadius: 12, background: 'transparent',
            border: '1px dashed var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--ink-3)', letterSpacing: '0.06em', width: '100%',
          }}>
            +{dateBound.length - 5} more tasks
          </button>
        )}
        <TaskGroup label="Someday" tasks={someday} />
      </div>
    </div>
  )
}
