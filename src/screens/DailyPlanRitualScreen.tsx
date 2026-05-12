import { localDateISO } from '../lib/useCurrentDate'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO, saveDailyPlan, updateTask, deleteTask } from '../data/db'
import { EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import type { Screen, Task, Habit, Reckoning } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DPRProps {
  navigate: (s: Screen) => void
  back: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isoRe = /^\d{4}-\d{2}-\d{2}$/

function tomorrowISO(): string {
  const d = new Date(todayISO() + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return localDateISO(d)
}

const STEP_CTAS: Record<number, string> = {
  1: 'Continue',
  2: 'Choose your top 3',
  3: 'Start the day',
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function DailyPlanRitualScreen({ navigate, back }: DPRProps) {
  const [step, setStep]             = useState(0)
  const [mood, setMood]             = useState<'steady' | 'tired' | 'charged' | null>(null)
  const [reckonings, setReckonings] = useState<Reckoning[]>([])
  const [pickedIds, setPickedIds]   = useState<Set<string>>(new Set())
  const [top3Ids, setTop3Ids]       = useState<string[]>([])
  const [finishing, setFinishing]   = useState(false)

  async function handleNext() {
    if (step === 1) {
      // Apply reckoning mutations immediately so they take effect even if the user skips later
      const today    = todayISO()
      const tomorrow = tomorrowISO()
      for (const r of reckonings) {
        if (r.action === 'today') {
          await updateTask(r.taskId, { due: today })
        } else if (r.action === 'reschedule') {
          await updateTask(r.taskId, { due: r.rescheduledTo ?? tomorrow })
        } else if (r.action === 'drop') {
          await deleteTask(r.taskId)
        }
      }
      await saveDailyPlan({ mood, reckonings, completedAt: null })
      setStep(2)
      return
    }

    if (step < 3) {
      await saveDailyPlan({ mood, reckonings, pickedIds: [...pickedIds], top3Ids, completedAt: null })
      setStep(s => s + 1)
      return
    }

    // Step 3 → "Start the day"
    setFinishing(true)
    try {
      const existingPlan = await db.dailyPlans.get(todayISO())
      await saveDailyPlan({
        mood,
        reckonings,
        calBudgetMin: 0,
        pickedIds: [...pickedIds],
        top3Ids,
        completedAt: Date.now(),
      })
      // +3 XP once per day for completing the ritual
      if (!existingPlan?.completedAt) {
        const settings = await db.settings.get(1)
        if (settings) await db.settings.update(1, { xp: (settings.xp ?? 0) + 3 })
      }
    } finally {
      setFinishing(false)
      back()
    }
  }

  const handleSkip = useCallback(async () => {
    // Write a row so the auto-launch won't fire again today
    await saveDailyPlan({ completedAt: null })
    back()
  }, [back])

  return (
    <div style={{
      height: '100%', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        padding: '14px 18px 10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--rule)',
      }}>
        <span className="eyebrow" style={{ letterSpacing: '0.16em' }}>
          {step === 0 ? 'DAILY PLAN' : `DAILY PLAN · ${step}/3`}
        </span>
        <button
          onClick={handleSkip}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.10em' }}
        >
          SKIP
        </button>
      </div>

      {/* ── 3-segment progress bar ── */}
      <div style={{ display: 'flex', gap: 5, padding: '10px 18px 0', flexShrink: 0 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--accent)' : 'var(--rule)',
            transition: 'background .3s',
          }} />
        ))}
      </div>

      {/* ── Step content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 12px' }} className="no-scrollbar">
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 28 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', textAlign: 'center', color: 'var(--ink)' }}>
              How are you showing up today?
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              {([
                { id: 'steady',  label: 'Steady',  emoji: '🌱' },
                { id: 'tired',   label: 'Tired',   emoji: '😴' },
                { id: 'charged', label: 'Charged', emoji: '⚡' },
              ] as const).map(m => (
                <button
                  key={m.id}
                  onClick={() => { setMood(m.id); setStep(1) }}
                  style={{
                    flex: 1, padding: '22px 8px', borderRadius: 14,
                    background: 'var(--paper-2)', border: '1px solid var(--rule)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{m.emoji}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.08em' }}>
                    {m.label.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <DPRStep1Reckoning
            reckonings={reckonings}
            onReckoningsChange={setReckonings}
          />
        )}
        {step === 2 && (
          <DPRStep3Pick
            pickedIds={pickedIds}
            onPickedChange={setPickedIds}
            mood={mood}
          />
        )}
        {step === 3 && (
          <DPRStep4Top3
            pickedIds={pickedIds}
            top3Ids={top3Ids}
            onTop3Change={setTop3Ids}
          />
        )}
      </div>

      {/* ── Footer — hidden on mood step (tap-to-advance) ── */}
      {step > 0 && <div style={{
        padding: '12px 18px',
        paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
        flexShrink: 0,
        borderTop: '1px solid var(--rule)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        {step > 1 && (
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            style={{
              padding: '12px 16px', borderRadius: 10,
              border: '1px solid var(--rule)', color: 'var(--ink-2)',
              fontSize: 13, flexShrink: 0,
            }}
          >
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={finishing}
          style={{
            flex: 1, padding: '14px', borderRadius: 12,
            background: 'var(--ink)', color: 'var(--paper)',
            fontWeight: 600, fontSize: 14,
            opacity: finishing ? 0.6 : 1,
            transition: 'opacity .15s',
          }}
        >
          {finishing ? 'Saving…' : STEP_CTAS[step]}
        </button>
      </div>}
    </div>
  )
}

// ── Step 1 — Yesterday's Reckoning ───────────────────────────────────────────

function DPRStep1Reckoning({
  reckonings,
  onReckoningsChange,
}: {
  reckonings: Reckoning[]
  onReckoningsChange: (r: Reckoning[]) => void
}) {
  const today    = todayISO()
  const tomorrow = useMemo(tomorrowISO, [])

  // Query incomplete tasks that are overdue
  const leftovers = useLiveQuery(async () => {
    const all = await db.tasks.filter(t => {
      if (t.done) return false
      if (t.due === 'Overdue') return true
      if (isoRe.test(t.due) && t.due < today) return true
      return false
    }).toArray()
    // Sort: q1 first (most urgent), then by due date asc; cap at 8 to avoid overwhelming
    return all
      .sort((a, b) => {
        const qOrder: Record<string, number> = { q1: 0, q2: 1, q3: 2, q4: 3 }
        const qd = (qOrder[a.quad] ?? 1) - (qOrder[b.quad] ?? 1)
        if (qd !== 0) return qd
        return (a.due < b.due ? -1 : 1)
      })
      .slice(0, 8)
  }, [today]) ?? []

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  const actionFor = (taskId: string): Reckoning['action'] | undefined =>
    reckonings.find(r => r.taskId === taskId)?.action

  function setAction(task: Task, action: Reckoning['action']) {
    onReckoningsChange([
      ...reckonings.filter(r => r.taskId !== task.id),
      { taskId: task.id, action, rescheduledTo: action === 'reschedule' ? tomorrow : undefined },
    ])
  }

  // ── Empty state ──
  if (leftovers.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>All clear</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
            Nothing left over from yesterday. Nice work.
          </div>
        </div>
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'var(--accent-soft)', border: '1px solid var(--rule)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: 'var(--ink-2)',
        }}>
          <Icons.check size={16} stroke="var(--accent)" />
          Ready to plan your day.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>
          Yesterday left {leftovers.length === 1 ? 'one thing' : `${leftovers.length} things`}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          Push, reschedule, or drop — no guilt.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {leftovers.map(task => {
          const action = actionFor(task.id)
          const hue    = catHue(task.cat)
          const effort = EFFORT[task.effort]

          return (
            <div key={task.id} style={{
              padding: '12px 12px 10px',
              border: `1px solid ${action ? `hsl(${hue}, 40%, 72%)` : 'var(--rule)'}`,
              borderRadius: 12, background: 'var(--paper-2)',
              transition: 'border-color .15s',
            }}>
              {/* Title row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                  background: `hsl(${hue}, 55%, 42%)`,
                }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', flex: 1, lineHeight: 1.35 }}>
                  {task.title}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--ink-3)', letterSpacing: '0.06em', flexShrink: 0, marginTop: 2,
                }}>
                  {effort?.glyph ?? '●'}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['today', 'reschedule', 'drop'] as const).map(opt => {
                  const on = action === opt
                  const labels: Record<typeof opt, string> = {
                    today:      'Push to today',
                    reschedule: 'Reschedule',
                    drop:       'Drop',
                  }
                  return (
                    <button
                      key={opt}
                      onClick={() => setAction(task, on ? undefined as unknown as typeof opt : opt)}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 8,
                        fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                        background: on ? (opt === 'drop' ? 'var(--warn)' : 'var(--ink)') : 'transparent',
                        color:      on ? 'var(--paper)' : 'var(--ink-2)',
                        border:     on ? `1px solid ${opt === 'drop' ? 'var(--warn)' : 'var(--ink)'}` : '1px solid var(--rule)',
                        transition: 'all .15s',
                      }}
                    >
                      {labels[opt]}
                    </button>
                  )
                })}
              </div>

              {/* Reschedule hint */}
              {action === 'reschedule' && (
                <div style={{
                  marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-3)', letterSpacing: '0.04em',
                }}>
                  ↳ Moving to tomorrow ({tomorrow})
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px dashed var(--rule)',
        fontSize: 12, color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icons.sparkle size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        You're not behind — you're allocating.
      </div>
    </div>
  )
}

// ── Step 2 — Calendar reality check ──────────────────────────────────────────
//
// Reads today's tasks that have a `time` field set and treats them as calendar
// blocks. Computes free gaps across an 8 am–7 pm window and passes the total
// free minutes up to the shell so Step 3 can use it as the time budget.
// A "Connect calendar" note is shown to invite future Google / Apple integration.

interface CalBlock {
  startH: number   // decimal hours, e.g. 9.5 = 9:30 am
  endH:   number
  title:  string
  hue:    number
}

/** Parse an HH:MM string to decimal hours (e.g. "14:30" → 14.5). */
function parseTimeH(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m ?? 0) / 60
}

/** Format decimal hours as "9a", "2p", "2:30p" */
function fmtH(h: number): string {
  const intH = Math.floor(h)
  const mins  = Math.round((h - intH) * 60)
  const ap    = intH < 12 ? 'a' : 'p'
  const disp  = intH <= 12 ? intH : intH - 12
  return mins ? `${disp}:${String(mins).padStart(2, '0')}${ap}` : `${disp}${ap}`
}

function DPRStep2Calendar({ onBudgetChange }: { onBudgetChange: (min: number) => void }) {
  const today = todayISO()

  // Tasks with a `time` field due today are treated as calendar blocks.
  const timedTasks = useLiveQuery(async () => {
    const all = await db.tasks.filter(t =>
      !!t.time && !t.done &&
      (t.due === 'Today' || t.due === today)
    ).toArray()
    return all
  }, [today]) ?? []

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  // Build sorted blocks from timed tasks
  const blocks: CalBlock[] = useMemo(() => {
    return timedTasks
      .filter(t => t.time && /^\d{2}:\d{2}$/.test(t.time))
      .map(t => {
        const startH = parseTimeH(t.time!)
        // Use effort to estimate duration: xs=0.25h, s=0.25h, m=1h, l=2h, xl=4h
        const durMap: Record<string, number> = { xs: 0.25, s: 0.25, m: 1, l: 2, xl: 4, xxl: 8 }
        const dur = durMap[t.effort] ?? 1
        return { startH, endH: startH + dur, title: t.title, hue: catHue(t.cat) }
      })
      .sort((a, b) => a.startH - b.startH)
  }, [timedTasks, categories])

  const DAY_START = 8
  const DAY_END   = 19   // 8 am → 7 pm = 11 h window
  const TOTAL_MIN = (DAY_END - DAY_START) * 60

  // Compute free gaps between blocks (and at start/end)
  const gaps = useMemo(() => {
    const result: Array<{ startH: number; endH: number }> = []
    let cursor = DAY_START
    for (const b of blocks) {
      const bs = Math.max(DAY_START, b.startH)
      if (bs > cursor + 0.25) result.push({ startH: cursor, endH: bs })
      cursor = Math.max(cursor, b.endH)
    }
    if (cursor < DAY_END) result.push({ startH: cursor, endH: DAY_END })
    return result
  }, [blocks])

  const busyMin = useMemo(() =>
    blocks.reduce((s, b) => s + Math.max(0, b.endH - b.startH) * 60, 0)
  , [blocks])

  const freeMin = Math.max(0, TOTAL_MIN - busyMin)
  const freeHH  = Math.floor(freeMin / 60)
  const freeMM  = freeMin % 60

  // Push budget up to shell whenever it changes
  useEffect(() => { onBudgetChange(freeMin) }, [freeMin, onBudgetChange])

  const pct = (h: number) => ((h - DAY_START) / (DAY_END - DAY_START)) * 100

  const TIMELINE_H = 260  // px

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>Today's runway</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          {blocks.length > 0
            ? `${blocks.length} block${blocks.length === 1 ? '' : 's'} taking up your day.`
            : 'No time-blocked tasks found — showing your full day as free.'}
        </div>
      </div>

      {/* Free-time headline */}
      <div style={{
        margin: '0 0 16px', padding: '14px 16px', borderRadius: 14,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
      }}>
        <div className="eyebrow">FREE TIME TODAY</div>
        <div className="t-display" style={{ fontSize: 42, marginTop: 4, color: 'var(--accent)' }}>
          {freeHH}h{freeMM > 0 ? ` ${freeMM}m` : ''}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginTop: 2 }}>
          across {gaps.length} gap{gaps.length === 1 ? '' : 's'} · {DAY_START}am–{DAY_END - 12}pm window
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative', height: TIMELINE_H, paddingLeft: 36, marginBottom: 16 }}>

        {/* Hour ticks */}
        {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
          const h   = DAY_START + i
          const top = (i / (DAY_END - DAY_START)) * TIMELINE_H
          return (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0, top,
              borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
              pointerEvents: 'none',
            }}>
              <span style={{
                position: 'absolute', left: -30, top: -7,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--ink-3)', letterSpacing: '0.04em',
              }}>
                {h <= 12 ? h : h - 12}{h < 12 ? 'a' : 'p'}
              </span>
            </div>
          )
        })}

        {/* Free gap fills */}
        {gaps.map((g, i) => (
          <div key={`g${i}`} style={{
            position: 'absolute', left: 0, right: 8,
            top:    `${pct(g.startH)}%`,
            height: `${pct(g.endH) - pct(g.startH)}%`,
            background: 'var(--accent-soft)', opacity: 0.45,
            borderLeft: '2px solid var(--accent)',
          }}>
            {(g.endH - g.startH) >= 0.5 && (
              <span style={{
                position: 'absolute', left: 6, top: 4,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--accent)', letterSpacing: '0.04em', fontWeight: 600,
              }}>
                {Math.floor(g.endH - g.startH)}h
                {((g.endH - g.startH) % 1) ? `${Math.round(((g.endH - g.startH) % 1) * 60)}m` : ''}
                {' '}free
              </span>
            )}
          </div>
        ))}

        {/* Calendar / task blocks */}
        {blocks.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: 6, right: 8,
            top:    `${pct(b.startH)}%`,
            height: `${Math.max(pct(b.endH) - pct(b.startH), 2)}%`,
            background: `hsl(${b.hue}, 35%, 96%)`,
            borderLeft: `3px solid hsl(${b.hue}, 55%, 42%)`,
            borderRadius: '3px 8px 8px 3px',
            padding: '3px 7px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: `hsl(${b.hue}, 30%, 25%)`, lineHeight: 1.2 }}>
              {b.title.length > 28 ? b.title.slice(0, 28) + '…' : b.title}
            </div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: `hsl(${b.hue}, 30%, 40%)`, marginTop: 1 }}>
              {fmtH(b.startH)} – {fmtH(b.endH)}
            </div>
          </div>
        ))}
      </div>

      {/* Connect calendar nudge */}
      <div style={{
        padding: '11px 14px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px dashed var(--rule)',
        fontSize: 11, color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      }}>
        <Icons.calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        Set a time on any task to block it here · Google Calendar coming soon
      </div>
    </div>
  )
}

// ── Step 3 — Pick today's tasks ───────────────────────────────────────────────
//
// Candidate sources (in priority order):
//   1. Overdue tasks still open (weren't pushed/dropped in Step 1)
//   2. Tasks due today (by label "Today" or ISO date)
//   3. Incomplete habits (from the habits table)
//   4. High-priority (q1/q2) tasks with no due date — surfaced for consideration
//
// Each task is tagged with a KindTag. A sticky time-budget bar accumulates
// effort minutes and turns warn-red when the selection exceeds calBudgetMin.

type TaskKind = 'overdue' | 'due' | 'habit' | 'goal' | 'suggested'

interface Candidate {
  id:     string
  title:  string
  effort: string
  hue:    number
  kind:   TaskKind
  meta:   string
}

/** Small coloured label showing why a task is surfaced. */
function KindTag({ kind }: { kind: TaskKind }) {
  const map: Record<TaskKind, { label: string; color: string }> = {
    overdue:   { label: 'OVERDUE',   color: 'var(--warn)'   },
    due:       { label: 'DUE TODAY', color: 'var(--ink-2)'  },
    habit:     { label: 'HABIT',     color: 'var(--accent)' },
    goal:      { label: 'GOAL',      color: 'var(--accent)' },
    suggested: { label: 'SUGGESTED', color: 'var(--ink-3)'  },
  }
  const { label, color } = map[kind]
  return (
    <span style={{ color, fontWeight: 600, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
      {label}
    </span>
  )
}

function DPRStep3Pick({
  pickedIds,
  onPickedChange,
  mood,
}: {
  pickedIds:      Set<string>
  onPickedChange: (ids: Set<string>) => void
  mood:           'steady' | 'tired' | 'charged' | null
}) {
  const today = todayISO()
  const [showAll, setShowAll] = useState(false)

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  // Fetch candidates from tasks + habits
  const rawTasks  = useLiveQuery(() => db.tasks.filter(t => !t.done).toArray(), []) ?? []
  const rawHabits = useLiveQuery(() => db.habits.filter(h => !h.done && !h.isArchived).toArray(), []) ?? []
  const goals     = useLiveQuery(() => db.goals.toArray(), []) ?? []

  // Build a set of task IDs linked to any goal
  const goalLinkedIds = useMemo(() =>
    new Set(goals.flatMap(g => g.linked ?? []))
  , [goals])

  // Map task ID → { goalTitle, why } for pull-quote display
  const taskGoalMap = useMemo(() => {
    const map = new Map<string, { goalTitle: string; why: string }>()
    for (const g of goals) {
      if (!g.why?.trim()) continue
      for (const id of (g.linked ?? [])) {
        if (!map.has(id)) map.set(id, { goalTitle: g.title, why: g.why })
      }
    }
    return map
  }, [goals])

  const candidates: Candidate[] = useMemo(() => {
    const list: Candidate[] = []
    const seen = new Set<string>()

    function add(c: Candidate) {
      if (!seen.has(c.id)) { seen.add(c.id); list.push(c) }
    }

    // 1. Overdue (due < today, ISO-dated)
    rawTasks
      .filter(t => isoRe.test(t.due) && t.due < today)
      .sort((a, b) => a.due < b.due ? -1 : 1)
      .forEach(t => add({
        id: t.id, title: t.title, effort: t.effort,
        hue: catHue(t.cat), kind: 'overdue', meta: `Due ${t.due}`,
      }))

    // 2. Due today
    rawTasks
      .filter(t => t.due === 'Today' || t.due === today)
      .forEach(t => add({
        id: t.id, title: t.title, effort: t.effort,
        hue: catHue(t.cat),
        kind: goalLinkedIds.has(t.id) ? 'goal' : 'due',
        meta: goalLinkedIds.has(t.id) ? 'Linked to goal' : 'Due today',
      }))

    // 3. Habits (separate table, not done today)
    rawHabits.forEach(h => add({
      id:     h.id,
      title:  h.title,
      effort: 's',
      hue:    catHue(h.cat),
      kind:   'habit',
      meta:   h.streak > 0 ? `${h.streak}-day streak` : h.frequency,
    }))

    // 4. Remaining tasks — all when showAll, or just top q1/q2 suggestions
    if (showAll) {
      rawTasks
        .filter(t => !seen.has(t.id))
        .sort((a, b) => {
          const qOrder: Record<string, number> = { q1: 0, q2: 1, q3: 2, q4: 3 }
          const qd = (qOrder[a.quad] ?? 2) - (qOrder[b.quad] ?? 2)
          if (qd !== 0) return qd
          return a.title < b.title ? -1 : 1
        })
        .forEach(t => add({
          id: t.id, title: t.title, effort: t.effort,
          hue: catHue(t.cat),
          kind: goalLinkedIds.has(t.id) ? 'goal' : 'suggested',
          meta: goalLinkedIds.has(t.id) ? 'Linked to goal' : (t.due || (t.status ?? 'backlog')),
        }))
    } else {
      rawTasks
        .filter(t =>
          (t.quad === 'q1' || t.quad === 'q2') &&
          t.due !== 'Today' && t.due !== today &&
          !(isoRe.test(t.due) && t.due < today) &&
          !seen.has(t.id)
        )
        .sort((a, b) => (a.quad === 'q1' ? -1 : b.quad === 'q1' ? 1 : 0))
        .slice(0, 3)
        .forEach(t => add({
          id: t.id, title: t.title, effort: t.effort,
          hue: catHue(t.cat),
          kind: goalLinkedIds.has(t.id) ? 'goal' : 'suggested',
          meta: goalLinkedIds.has(t.id) ? 'Linked to goal' : (t.due || 'No date'),
        }))
    }

    // Mood-aware sort: when tired, float Small/Micro tasks to the top
    if (mood === 'tired') {
      const smallEfforts = new Set(['xs', 's'])
      list.sort((a, b) => {
        const aSmall = smallEfforts.has(a.effort ?? '')
        const bSmall = smallEfforts.has(b.effort ?? '')
        if (aSmall && !bSmall) return -1
        if (!aSmall && bSmall) return 1
        return 0
      })
    }

    return list
  }, [rawTasks, rawHabits, goals, goalLinkedIds, categories, today, showAll, mood])

  // Pre-select overdue + due-today tasks on first render (if nothing selected yet)
  useEffect(() => {
    if (pickedIds.size === 0 && candidates.length > 0) {
      const autoSelect = new Set(
        candidates
          .filter(c => c.kind === 'overdue' || c.kind === 'due')
          .map(c => c.id)
      )
      if (autoSelect.size > 0) onPickedChange(autoSelect)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.length])

  function toggle(id: string) {
    const next = new Set(pickedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onPickedChange(next)
  }

  // Total selected time
  const totalMin = useMemo(() => {
    let mins = 0
    for (const id of pickedIds) {
      const c = candidates.find(x => x.id === id)
      if (c) mins += EFFORT[c.effort as keyof typeof EFFORT]?.mins ?? 15
    }
    return mins
  }, [pickedIds, candidates])

  const totalHH = Math.floor(totalMin / 60)
  const totalMM = totalMin % 60

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>Pick today's work</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
            {mood === 'tired'
              ? 'Light day — starting with smaller tasks.'
              : 'Tap tasks to pick them for today.'}
          </div>
        </div>
        {/* Show all toggle */}
        <button
          onClick={() => setShowAll(s => !s)}
          style={{
            flexShrink: 0, marginTop: 6,
            padding: '6px 10px', borderRadius: 8,
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
            background: showAll ? 'var(--ink)' : 'var(--paper-2)',
            color: showAll ? 'var(--paper)' : 'var(--ink-3)',
            border: '1px solid', borderColor: showAll ? 'var(--ink)' : 'var(--rule)',
          }}
        >
          {showAll ? 'Suggested' : 'All tasks'}
        </button>
      </div>

      {/* Selected time counter */}
      {pickedIds.size > 0 && (
        <div style={{
          position: 'sticky', top: -20, zIndex: 2,
          background: 'var(--paper)', paddingTop: 8, paddingBottom: 8, marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--rule)',
        }}>
          <span className="eyebrow">{pickedIds.size} selected</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
          }}>
            {totalHH > 0 ? `${totalHH}h ` : ''}{totalMM}m total
          </span>
        </div>
      )}

      {candidates.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '12px 0' }}>
          No tasks found — add some or tap Continue to proceed.
        </div>
      )}

      {/* Candidate list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(() => {
          const shownGoalWhys = new Set<string>()
          return candidates.map(c => {
          const on     = pickedIds.has(c.id)
          const effort = EFFORT[c.effort as keyof typeof EFFORT]
          const goalInfo = taskGoalMap.get(c.id)
          const showWhy = goalInfo && !shownGoalWhys.has(goalInfo.why)
          if (showWhy) shownGoalWhys.add(goalInfo!.why)
          return (
            <div key={c.id}>
            <button
              onClick={() => toggle(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                padding: '10px 12px', borderRadius: 10, width: '100%',
                background: on ? 'var(--paper-2)' : 'transparent',
                border: `1px solid ${on ? `hsl(${c.hue}, 55%, 42%)` : 'var(--rule)'}`,
                transition: 'all .15s',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${on ? `hsl(${c.hue}, 55%, 42%)` : 'var(--rule)'}`,
                background: on ? `hsl(${c.hue}, 55%, 42%)` : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}>
                {on && <Icons.check size={11} sw={2.5} stroke="var(--paper)" />}
              </div>

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.3 }}>
                  {c.title}
                </div>
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)',
                  marginTop: 2, letterSpacing: '0.04em',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <KindTag kind={c.kind} />
                  <span>· {c.meta}</span>
                </div>
              </div>

              {/* Effort glyph + duration */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
                {effort?.glyph ?? '●'}{' '}
                {effort ? (effort.mins >= 60 ? `${Math.round(effort.mins / 60)}h` : `${effort.mins}m`) : ''}
              </span>
            </button>
            {showWhy && (
              <div style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5,
                paddingLeft: 40, marginTop: 3,
              }}>
                {goalInfo!.why}
              </div>
            )}
            </div>
          )
        })}
        )()}
      </div>
    </div>
  )
}

// ── Step 4 — Top 3 ───────────────────────────────────────────────────────────
//
// Shows only the tasks that were picked in Step 3.
// Tap a card to rank it (1 → 2 → 3 → deselect). Max 3.
// The numbered circle fills with the task's category hue.
// top3Ids is an ordered array — index 0 is #1, etc.

function DPRStep4Top3({
  pickedIds,
  top3Ids,
  onTop3Change,
}: {
  pickedIds:    Set<string>
  top3Ids:      string[]
  onTop3Change: (ids: string[]) => void
}) {
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  // Resolve the picked tasks in a stable order (by title, then id)
  const pickedTasks = useLiveQuery(async () => {
    if (pickedIds.size === 0) return []
    const tasks  = await db.tasks.bulkGet([...pickedIds])
    const habits = await db.habits.bulkGet([...pickedIds])
    const results: (Task | Habit)[] = ([...tasks, ...habits] as (Task | Habit | undefined)[])
      .filter((t): t is Task | Habit => t !== undefined)
    // Stable order: q1 first then title
    return results.sort((a, b) => {
      // tasks have .quad, habits don't
      const qa = ('quad' in a ? (a.quad === 'q1' ? 0 : a.quad === 'q2' ? 1 : 2) : 3)
      const qb = ('quad' in b ? (b.quad === 'q1' ? 0 : b.quad === 'q2' ? 1 : 2) : 3)
      if (qa !== qb) return qa - qb
      return a.title < b.title ? -1 : 1
    })
  }, [[...pickedIds].join(',')]) ?? []

  function toggleRank(id: string) {
    const idx = top3Ids.indexOf(id)
    if (idx !== -1) {
      // Already ranked → deselect
      onTop3Change(top3Ids.filter(x => x !== id))
    } else if (top3Ids.length < 3) {
      // Not yet ranked → add to end
      onTop3Change([...top3Ids, id])
    }
    // If 3 already selected and this is a new one → ignore (must deselect first)
  }

  const rankOf = (id: string) => {
    const i = top3Ids.indexOf(id)
    return i === -1 ? null : i + 1
  }

  const full = top3Ids.length === 3

  if (pickedIds.size === 0) {
    return (
      <div>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1, fontStyle: 'italic', marginBottom: 8 }}>
          If only three things…
        </div>
        <div style={{
          padding: '16px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5,
        }}>
          No tasks were picked in the previous step. Go back and select some, or tap "Start the day" to finish.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1, fontStyle: 'italic' }}>
          If only three things…
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          Pick the three you'd be glad you did. The rest is a bonus.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pickedTasks.map(task => {
          const rank = rankOf(task.id)
          const on   = rank !== null
          const hue  = catHue('cat' in task ? task.cat : '')
          const effort = EFFORT[('effort' in task ? task.effort : 's') as keyof typeof EFFORT]
          const atMax = full && !on   // 3 chosen but this one isn't one of them

          return (
            <button
              key={task.id}
              onClick={() => toggleRank(task.id)}
              disabled={atMax}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left', width: '100%',
                padding: '14px 12px', borderRadius: 12,
                background:  on     ? `hsl(${hue}, 35%, 96%)` : 'var(--paper-2)',
                border:      on     ? `2px solid hsl(${hue}, 55%, 42%)` : '1px solid var(--rule)',
                opacity:     atMax  ? 0.4 : 1,
                transform:   on     ? 'scale(1.0)' : 'scale(0.98)',
                transition: 'all .15s',
              }}
            >
              {/* Rank circle */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: on    ? `hsl(${hue}, 55%, 42%)` : 'var(--paper)',
                color:      on    ? 'var(--paper)'           : 'var(--ink-3)',
                border:     on    ? 'none'                   : '1px solid var(--rule)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic',
                transition: 'all .15s',
              }}>
                {on ? rank : '·'}
              </div>

              {/* Title + effort */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {effort?.glyph ?? '●'}{' '}
                  {effort ? (effort.mins >= 60 ? `${Math.round(effort.mins / 60)}h` : `${effort.mins}m`) : ''}
                </div>
              </div>

              {/* Sparkle for selected */}
              {on && (
                <Icons.sparkle size={16} style={{ color: `hsl(${hue}, 55%, 42%)`, flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px dashed var(--rule)',
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5,
      }}>
        {top3Ids.length === 0
          ? 'Tap up to three tasks to make them your priorities for today.'
          : top3Ids.length < 3
            ? `${top3Ids.length}/3 — tap ${3 - top3Ids.length} more, or continue as-is.`
            : 'These three pin to the top of Today. Finish them and the day\'s a win.'}
      </div>
    </div>
  )
}
