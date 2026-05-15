import { localDateISO } from '../lib/useCurrentDate'
import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { enqueueUpsert } from '../lib/sync'
import { EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen, Goal, WeeklyReview, GoalPulse, GoalPulseStatus } from '../types'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

// ── Week helpers ──────────────────────────────────────────────────────────────

function getMondayISO(d: Date): string {
  const day  = d.getDay()                  // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day   // shift back to Monday
  const mon  = new Date(d)
  mon.setDate(d.getDate() + diff)
  return localDateISO(mon)
}

function getSundayISO(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return localDateISO(d)
}

function displayRange(start: string, end: string): string {
  const s   = new Date(start + 'T00:00:00')
  const e   = new Date(end   + 'T00:00:00')
  const fmt = (d: Date, y?: boolean) =>
    d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) })
  return `${fmt(s)} – ${fmt(e, true)}`
}

// ── Stats computation ─────────────────────────────────────────────────────────

interface WeekStats {
  tasksCompleted: number
  xpGained:       number
  journalDays:    number
  habitsDone:     number   // unique habit-days logged this week
  partial:        boolean  // week isn't over yet
}

// ── Progress helpers shared with StatsStep ────────────────────────────────────

function isoOffsetFrom(base: Date, offsetDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() - offsetDays)
  return localDateISO(d)
}

async function computeStats(weekStart: string, weekEnd: string): Promise<WeekStats> {
  const startMs  = new Date(weekStart + 'T00:00:00').getTime()
  const endMs    = new Date(weekEnd   + 'T23:59:59').getTime()
  const todayISO = localDateISO()

  const allTasks  = await db.tasks.toArray()
  const completed = allTasks.filter(
    t => t.done && t.updatedAt != null && t.updatedAt >= startMs && t.updatedAt <= endMs
  )

  const xpGained = completed.reduce((s, t) => s + (EFFORT[t.effort]?.xp ?? 0), 0)

  const entries     = await db.journal.toArray()
  const journalDays = new Set(
    entries.filter(e => e.date >= weekStart && e.date <= weekEnd).map(e => e.date)
  ).size

  // Count habit log entries for the week
  const habitLogs = await db.habitLog.where('date').between(weekStart, weekEnd, true, true).toArray()
  const habitsDone = habitLogs.length

  return { tasksCompleted: completed.length, xpGained, journalDays, habitsDone, partial: todayISO < weekEnd }
}

// ── Step progress bar ─────────────────────────────────────────────────────────

function StepProgress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i <= step ? 'var(--ink)' : 'var(--paper-3)',
          transition: 'background .25s',
        }} />
      ))}
    </div>
  )
}

const STEP_LABELS = ['Your week', 'Mood', 'Goals', 'Prompts']

// ── Step 0: Stats at a glance ─────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: string; color: string
}) {
  const I = Icons[icon] ?? Icons.check
  return (
    <div style={{
      padding: '16px 14px', borderRadius: 14,
      background: 'var(--paper-2)', border: '1px solid var(--rule)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <I size={18} style={{ color }} />
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
        color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.07em',
      }}>
        {label.toUpperCase()}
      </div>
    </div>
  )
}

// ── Week insight generator ────────────────────────────────────────────────────
function generateInsight(stats: WeekStats, streak: number): string {
  if (stats.tasksCompleted === 0 && stats.journalDays === 0) return 'A quiet week — next week is a fresh start.'
  if (streak >= 7) return `${streak}-day streak — momentum is real. Don't break the chain.`
  if (stats.journalDays >= 6) return 'Six days of journalling — your self-awareness is compounding.'
  if (stats.tasksCompleted >= 10) return `${stats.tasksCompleted} tasks done — that's a productive week.`
  if (stats.habitsDone >= 14) return 'Habits held strong — consistency beats intensity every time.'
  if (stats.partial) return 'Week still in progress — you have time to finish strong.'
  return 'Every week you show up is a week that counts.'
}

interface StatsStepProps {
  stats:     WeekStats
  streak:    number
  xp:        number
  tasks:     import('../types').Task[]
  habitLogs: { date: string }[]
  cats:      import('../types').Category[]
  energyByDay: Record<string, 1 | 2 | 3>
  weekDays:  string[]
}

function StatsStep({ stats, streak, xp, tasks, habitLogs, cats, energyByDay, weekDays }: StatsStepProps) {
  const level    = Math.floor(xp / 1000) + 1
  const xpToNext = 1000 - (xp % 1000)

  // 7-day bar chart
  const now   = new Date()
  const todayStr = localDateISO(now)
  const DOW   = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const last7 = Array.from({ length: 7 }, (_, i) => isoOffsetFrom(now, 6 - i))
  const weekBars = last7.map(iso => {
    const dayTasks = tasks.filter(t => t.due === iso)
    const total    = dayTasks.length
    const done     = dayTasks.filter(t => t.done).length
    return {
      iso,
      pct:     total > 0 ? Math.round((done / total) * 100) : 0,
      isToday: iso === todayStr,
      dow:     DOW[new Date(iso + 'T12:00:00').getDay()],
    }
  })

  // Habit heatmap (84 days)
  const dots84 = Array.from({ length: 84 }, (_, i) => isoOffsetFrom(now, 83 - i))
  const logCounts: Record<string, number> = {}
  for (const l of habitLogs) { logCounts[l.date] = (logCounts[l.date] ?? 0) + 1 }
  const maxLogCount = Math.max(1, ...Object.values(logCounts))
  const startLabel = new Date(dots84[0]  + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })
  const endLabel   = new Date(dots84[83] + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>This week at a glance</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          {stats.partial
            ? "What you've done so far — the week isn't over. Take a breath before we reflect."
            : "Here's how your week shaped up. Take a moment before moving on."}
        </p>
      </div>

      {/* One-line insight */}
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: 'var(--ink)', color: 'var(--paper)',
        fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic',
        lineHeight: 1.55,
      }}>
        {generateInsight(stats, streak)}
      </div>

      {/* 7-bar energy mini-chart */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Energy this week</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
          {weekDays.map(iso => {
            const e = energyByDay[iso]
            const pct = e === 3 ? 100 : e === 2 ? 65 : e === 1 ? 30 : 0
            const color = e === 3 ? 'hsl(140,55%,42%)' : e === 2 ? 'hsl(38,85%,52%)' : 'var(--ink-4)'
            const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
            const dow = DOW[new Date(iso + 'T12:00:00').getDay()]
            return (
              <div key={iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: e ? `${pct}%` : 3,
                    minHeight: 3,
                    background: e ? color : 'var(--rule)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height .3s ease',
                  }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>
                  {dow}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2×2 stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Day streak"  value={streak}                    icon="flame"   color="hsl(30,90%,50%)"     />
        <StatCard label="Lifetime XP" value={xp.toLocaleString()}       icon="bolt"    color="hsl(45,85%,48%)"     />
        <StatCard label="This week"   value={`${stats.tasksCompleted}`} icon="check"   color="var(--accent)"       />
        <StatCard label="Next level"  value={xpToNext.toLocaleString()} icon="target"  color="hsl(200,60%,45%)"    />
      </div>

      {/* Journal + habits row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Journal days" value={`${stats.journalDays}/7`} icon="journal" color="hsl(200,60%,45%)"   />
        <StatCard label="Habit check-ins" value={stats.habitsDone}      icon="flame"   color="hsl(280,55%,48%)"   />
      </div>

      {/* 7-day bar chart */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Last 7 days</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {weekBars.map(bar => (
            <div key={bar.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max(bar.pct, 3)}%`,
                  minHeight: 3,
                  background: bar.isToday ? 'var(--accent)' : 'var(--ink)',
                  borderRadius: '4px 4px 0 0',
                  opacity: bar.isToday ? 1 : 0.75,
                  transition: 'height .4s ease',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>
                {bar.dow}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Habit heatmap */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Habit chains · 12 weeks</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
          {dots84.map((iso, i) => {
            const count = logCounts[iso] ?? 0
            const v = count === 0 ? 0.08
                    : count / maxLogCount > 0.85 ? 1
                    : count / maxLogCount > 0.55 ? 0.6
                    : count / maxLogCount > 0.3  ? 0.3
                    : 0.15
            return (
              <div key={i} style={{
                aspectRatio: '1', borderRadius: 2,
                background: `color-mix(in oklch, var(--accent) ${Math.round(v * 100)}%, var(--paper-3))`,
              }} />
            )
          })}
        </div>
        <div style={{ marginTop: 7, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          <span>{startLabel}</span><span>{endLabel}</span>
        </div>
      </div>

      {/* By-area breakdown */}
      {cats.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>By area</div>
          {cats.map(cat => {
            const catTasks = tasks.filter(t => t.cat === cat.id)
            const done     = catTasks.filter(t => t.done).length
            const total    = catTasks.length
            const pct      = total > 0 ? Math.round((done / total) * 100) : 0
            const I        = Icons[cat.icon as keyof typeof Icons] ?? Icons.home
            return (
              <div key={cat.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <I size={13} stroke="var(--ink-2)" />
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{cat.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{pct}%</div>
                </div>
                <div style={{ marginTop: 7, height: 3, background: 'var(--paper-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--ink)', borderRadius: 2, transition: 'width .4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {stats.tasksCompleted === 0 && (
        <div style={{
          padding: '13px 16px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6,
        }}>
          No completed tasks recorded this week. Future completions will appear here automatically.
        </div>
      )}
    </div>
  )
}

// ── Step 1: Mood ──────────────────────────────────────────────────────────────

function MoodStep({
  energyByDay, weekDays, planMoods,
}: {
  energyByDay: Record<string, 1 | 2 | 3>
  weekDays:  string[]
  planMoods: Record<string, 'steady' | 'tired' | 'charged'>
}) {
  const ENERGY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Okay', 3: 'Strong' }
  const MOOD_EMOJI = { steady: '😌', tired: '😴', charged: '⚡' }
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const energyAvg = (() => {
    const vals = weekDays.map(d => energyByDay[d]).filter(Boolean) as number[]
    if (vals.length === 0) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Mood & energy</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          How did your energy hold up? Notice patterns — not to judge, but to plan better next week.
        </p>
      </div>

      {/* Per-day energy rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weekDays.map(iso => {
          const e    = energyByDay[iso]
          const mood = planMoods[iso]
          const dow  = DOW[new Date(iso + 'T12:00:00').getDay()]
          const barW = e === 3 ? '100%' : e === 2 ? '65%' : e === 1 ? '30%' : '0%'
          const barC = e === 3 ? 'hsl(140,55%,42%)' : e === 2 ? 'hsl(38,85%,52%)' : 'var(--rule)'

          return (
            <div key={iso} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                width: 30, flexShrink: 0,
              }}>{dow}</div>
              <div style={{ flex: 1, height: 6, background: 'var(--paper-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: barW, height: '100%', background: barC, borderRadius: 3, transition: 'width .3s' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                {e ? ENERGY_LABEL[e] : '—'}
              </div>
              {mood && (
                <span style={{ fontSize: 14, flexShrink: 0 }}>{MOOD_EMOJI[mood]}</span>
              )}
            </div>
          )
        })}
      </div>

      {energyAvg && (
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            AVG ENERGY
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
            {energyAvg} / 3
          </span>
        </div>
      )}
    </div>
  )
}

// ── Step 3: Prompts (wins + commitment) ───────────────────────────────────────

function PromptsStep({
  wins, onWinChange, nextThing, onNextChange, prevCommitment,
}: {
  wins: [string, string, string]
  onWinChange: (i: 0 | 1 | 2, v: string) => void
  nextThing: string
  onNextChange: (v: string) => void
  prevCommitment?: string
}) {
  const WIN_PLACEHOLDERS = [
    'A task you\'re proud of finishing…',
    'A moment you showed up when it was hard…',
    'Something small that still counted…',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Wins */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Three wins</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
            Celebrate before you analyse — both big and small count.
          </p>
        </div>
        {([0, 1, 2] as const).map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)',
              paddingTop: 15, flexShrink: 0, width: 16, textAlign: 'right',
            }}>
              {i + 1}
            </span>
            <input
              value={wins[i]}
              onChange={e => onWinChange(i, e.target.value)}
              placeholder={WIN_PLACEHOLDERS[i]}
              style={{
                flex: 1, padding: '12px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 10, fontSize: 14, color: 'var(--ink)', lineHeight: '1.5',
              }}
            />
          </div>
        ))}
      </div>

      {/* Commitment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>One thing next week</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
            The non-urgent thing that actually matters — protect it before it becomes a fire.
          </p>
        </div>

        {prevCommitment && (
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 6 }}>
              LAST WEEK YOU COMMITTED TO
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              "{prevCommitment}"
            </div>
            <button
              onClick={() => onNextChange(prevCommitment)}
              style={{ marginTop: 8, padding: '5px 10px', borderRadius: 8, background: 'transparent', border: '1px solid var(--rule)', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}
            >
              Carry forward →
            </button>
          </div>
        )}

        <textarea
          value={nextThing}
          onChange={e => onNextChange(e.target.value)}
          placeholder="Next week I will…"
          rows={3}
          style={{
            width: '100%', padding: '14px',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 12, fontSize: 15, color: 'var(--ink)',
            lineHeight: '1.65', resize: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ── Step 1 (old): Wins ────────────────────────────────────────────────────────

function WinsStep({
  wins, onChange,
}: {
  wins: [string, string, string]
  onChange: (i: 0 | 1 | 2, v: string) => void
}) {
  const PLACEHOLDERS = [
    "A task you're proud of finishing\u2026",
    "A moment you showed up when it was hard\u2026",
    "Something small that still counted\u2026",
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Celebrate first</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          Name three wins from this week. Big or small — both count, and both deserve recognition before you analyse anything.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([0, 1, 2] as const).map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)',
              paddingTop: 15, flexShrink: 0, width: 16, textAlign: 'right',
            }}>
              {i + 1}
            </span>
            <input
              value={wins[i]}
              onChange={e => onChange(i, e.target.value)}
              placeholder={PLACEHOLDERS[i]}
              style={{
                flex: 1, padding: '12px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 10, fontSize: 14, color: 'var(--ink)', lineHeight: '1.5',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{
        padding: '13px 16px', borderRadius: 12,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
        fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic',
        color: 'var(--ink-3)', lineHeight: 1.6,
      }}>
        "What gets celebrated gets repeated."
      </div>
    </div>
  )
}

// ── Step 2: Goals pulse ───────────────────────────────────────────────────────

const PULSE_OPTIONS: { status: GoalPulseStatus; label: string; emoji: string }[] = [
  { status: 'on-track',        label: 'On Track',        emoji: '✅' },
  { status: 'needs-attention', label: 'Needs Attention', emoji: '⚠️' },
  { status: 'pausing',         label: 'Pausing',         emoji: '⏸️' },
]

function GoalsPulseStep({ goals, pulse, onChange, cats }: {
  goals:    Goal[]
  pulse:    GoalPulse[]
  onChange: (goalId: string, status: GoalPulseStatus) => void
  cats:     { id: string; hue: number }[]
}) {
  const isDark = useIsDark()
  function getStatus(goalId: string): GoalPulseStatus | undefined {
    return pulse.find(p => p.goalId === goalId)?.status
  }
  function getHue(area: string): number {
    return cats.find(c => c.id === area)?.hue ?? 200
  }

  if (goals.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Honest check-in</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
            No active goals yet — set some in the Goals tab to track them here each week.
          </p>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)' }}>
          <Icons.target size={44} style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>NO GOALS YET</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Honest check-in</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          A quick pulse on each goal. Be honest — "pausing" is a valid strategy, not a failure.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map(goal => {
          const hue     = getHue(goal.area)
          const current = getStatus(goal.id)

          return (
            <div key={goal.id} style={{
              padding: '16px', borderRadius: 14,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              {/* Goal header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: areaColor(hue, 'fg', isDark),
                }} />
                <div style={{ fontSize: 14, fontWeight: 500, flex: 1, lineHeight: 1.3 }}>{goal.title}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: areaColor(hue, 'fg', isDark), letterSpacing: '0.06em',
                }}>
                  {Math.round(goal.progress * 100)}%
                </div>
              </div>

              {/* 3-button status picker */}
              <div style={{ display: 'flex', gap: 6 }}>
                {PULSE_OPTIONS.map(opt => {
                  const selected = current === opt.status
                  return (
                    <button
                      key={opt.status}
                      onClick={() => onChange(goal.id, opt.status)}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 10,
                        background: selected ? 'var(--ink)' : 'var(--paper)',
                        color:      selected ? 'var(--paper)' : 'var(--ink-3)',
                        border: `1px solid ${selected ? 'var(--ink)' : 'var(--rule)'}`,
                        transition: 'all .15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{opt.emoji}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.04em' }}>
                        {opt.status === 'on-track' ? 'ON TRACK' : opt.status === 'needs-attention' ? 'ATTENTION' : 'PAUSING'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 3: Habits review ─────────────────────────────────────────────────────

function HabitsStep({ habitsDone }: { habitsDone: number }) {
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? []

  const insight = habitsDone === 0
    ? 'No habits logged this week yet. Tap a habit to check it in — streaks start from one.'
    : habitsDone >= habits.length * 5
      ? `${habitsDone} check-ins this week — solid consistency. Keep protecting the streak.`
      : `${habitsDone} habit check-ins this week. Consistency compounds — even one per day matters.`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Habit consistency</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          Small daily actions produce the biggest long-term results. Here's how your routines held up.
        </p>
      </div>

      {habits.length === 0 ? (
        <div style={{
          padding: '13px 16px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6,
        }}>
          No habits set up yet. Add habits from All Habits to start tracking streaks.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {habits.map(h => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 12,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: h.streak > 0 ? 'hsl(280,35%,92%)' : 'var(--paper-3)',
                color: h.streak > 0 ? 'hsl(280,50%,44%)' : 'var(--ink-4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              }}>
                {h.streak > 0 ? h.streak : '—'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                  {h.title}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                  {h.frequency} · {h.streak > 0 ? `${h.streak}d streak` : 'start today'}
                </div>
              </div>
              {h.done && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'hsl(280,55%,48%)',
                  letterSpacing: '0.06em', fontWeight: 600,
                }}>
                  ✓ TODAY
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Insight */}
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
        fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic',
        color: 'var(--ink-2)', lineHeight: 1.65,
      }}>
        {insight}
      </div>
    </div>
  )
}

// ── Step 4: Next week's commitment ────────────────────────────────────────────

function NextWeekStep({
  value, onChange, prevCommitment,
}: {
  value: string
  onChange: (v: string) => void
  prevCommitment?: string
}) {
  const EXAMPLES = [
    "Book the appointment I've been putting off",
    "Finish the report before it becomes urgent",
    "Start the habit I keep postponing to next week",
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>One thing</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          What's your single commitment for next week? The non-urgent thing that actually matters — the one you'll protect time for before it becomes a fire.
        </p>
      </div>

      {/* Last week's carry-forward */}
      {prevCommitment && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
            color: 'var(--ink-4)', marginBottom: 8,
          }}>
            LAST WEEK YOU COMMITTED TO
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic',
            color: 'var(--ink-2)', lineHeight: 1.6,
          }}>
            "{prevCommitment}"
          </div>
          <button
            onClick={() => onChange(prevCommitment)}
            style={{
              marginTop: 10, padding: '6px 12px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--rule)',
              fontSize: 11, color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            Carry forward →
          </button>
        </div>
      )}

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Next week I will…"
        rows={4}
        autoFocus
        style={{
          width: '100%', padding: '14px',
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          borderRadius: 12, fontSize: 15, color: 'var(--ink)',
          lineHeight: '1.65', resize: 'none',
        }}
      />

      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
          color: 'var(--ink-4)', marginBottom: 8,
        }}>
          EXAMPLES — TAP TO USE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => onChange(ex)} style={{
              padding: '11px 14px', borderRadius: 10, textAlign: 'left',
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4,
            }}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Done view ─────────────────────────────────────────────────────────────────

function DoneView({ review, onHistory, goals }: { review: WeeklyReview; onHistory: () => void; goals: Goal[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 44 }}>
      {/* Celebration header */}
      <div style={{
        padding: '28px 20px 24px', borderRadius: 18,
        background: 'var(--ink)', color: 'var(--paper)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🎯</div>
        <div className="t-display" style={{ fontSize: 22, marginBottom: 6 }}>Week reviewed</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.45, letterSpacing: '0.12em' }}>
          {displayRange(review.weekStart, review.weekEnd).toUpperCase()}
        </div>
        <div style={{
          marginTop: 16,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.1)', borderRadius: 20,
          padding: '7px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
        }}>
          <Icons.bolt size={12} /> +15 XP REFLECTION BONUS
        </div>
      </div>

      {/* Stats summary */}
      <div style={{
        padding: '16px', borderRadius: 14,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
      }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>The numbers</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Tasks',   value: review.tasksCompleted },
            { label: 'XP',      value: review.xpGained       },
            { label: 'Journal', value: `${review.journalDays}d` },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
                {s.value}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wins */}
      {review.wins.some(Boolean) && (
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Wins this week</div>
          {review.wins.filter(Boolean).map((win, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, paddingTop: 1 }}>
                <Icons.check size={14} sw={2.5} />
              </span>
              <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{win}</span>
            </div>
          ))}
        </div>
      )}

      {/* Goal pulse summary */}
      {review.goalPulse.length > 0 && (
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Goals pulse</div>
          {review.goalPulse.map(p => {
            const opt  = PULSE_OPTIONS.find(o => o.status === p.status)
            const goal = goals.find(g => g.id === p.goalId)
            return (
              <div key={p.goalId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{opt?.emoji}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, lineHeight: 1.4 }}>
                  {goal?.title ?? p.goalId}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                  color: 'var(--ink-4)',
                }}>
                  {opt?.label.toUpperCase() ?? p.status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Next week commitment */}
      {review.nextWeekThing && (
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Next week's commitment</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic',
            color: 'var(--ink)', lineHeight: 1.6,
          }}>
            "{review.nextWeekThing}"
          </div>
        </div>
      )}

      <button onClick={onHistory} style={{
        padding: '14px', borderRadius: 12, width: '100%',
        background: 'transparent', border: '1px solid var(--rule)',
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--ink-3)', letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Icons.list size={14} /> VIEW REVIEW HISTORY
      </button>
    </div>
  )
}

// ── History view ──────────────────────────────────────────────────────────────

function HistoryView({ reviews }: { reviews: WeeklyReview[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const completed = reviews
    .filter(r => r.completedAt)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  if (completed.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-4)' }}>
        <Icons.journal size={40} style={{ display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>NO REVIEWS YET</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
          Completed reviews appear here.<br />Your first one will be worth the ten minutes.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 44 }}>
      {completed.map(r => {
        const isOpen = expanded.has(r.id)
        // quadCounts kept in stored data for compat but not displayed anymore

        return (
          <div key={r.id} style={{
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <button onClick={() => toggle(r.id)} style={{
              width: '100%', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: isOpen ? '1px solid var(--rule)' : 'none',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div className="t-display" style={{ fontSize: 14, marginBottom: 3 }}>
                  {displayRange(r.weekStart, r.weekEnd)}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--ink-3)', letterSpacing: '0.05em',
                }}>
                  {r.tasksCompleted} tasks · {r.xpGained} XP · {r.journalDays}d journal
                </div>
              </div>
              <Icons.arrow size={14} style={{
                color: 'var(--ink-4)',
                transform: isOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform .2s',
              }} />
            </button>

            {isOpen && (
              <div style={{ padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {r.wins.some(Boolean) && (
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Wins</div>
                    {r.wins.filter(Boolean).map((w, i) => (
                      <div key={i} style={{
                        fontSize: 13, color: 'var(--ink-2)', marginBottom: 4,
                        paddingLeft: 4, lineHeight: 1.5,
                      }}>
                        · {w}
                      </div>
                    ))}
                  </div>
                )}
                {r.nextWeekThing && (
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>Commitment</div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 14,
                      fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.55,
                    }}>
                      "{r.nextWeekThing}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

interface Props { navigate?: (s: Screen) => void; back: () => void }

export const WeeklyReviewScreen = ({ back }: Props) => {
  const week = useMemo(() => {
    const start = getMondayISO(new Date())
    return { start, end: getSundayISO(start) }
  }, [])

  const goals     = useLiveQuery(() => db.goals.toArray(),         [])
  const cats      = useLiveQuery(() => db.categories.toArray(),    []) ?? []
  const reviews   = useLiveQuery(() => db.weeklyReviews.toArray(), [])
  const settings  = useLiveQuery(() => db.settings.get(1),         [])
  const allTasks  = useLiveQuery(() => db.tasks.toArray(),         []) ?? []
  const habitLogs = useLiveQuery(() => db.habitLog.toArray(),      []) ?? []
  const weekJournal = useLiveQuery(
    () => db.journal.where('date').between(week.start, week.end, true, true).toArray(),
    [week.start, week.end]
  ) ?? []
  const weekPlans = useLiveQuery(
    () => db.dailyPlans.where('date').between(week.start, week.end, true, true).toArray(),
    [week.start, week.end]
  ) ?? []

  const [stats,          setStats]         = useState<WeekStats | null>(null)
  const [view,           setView]          = useState<'wizard' | 'done' | 'history'>('wizard')
  const [step,           setStep]          = useState(0)
  const [review,         setReview]        = useState<WeeklyReview | null>(null)
  const [wins,           setWins]          = useState<[string, string, string]>(['', '', ''])
  const [pulse,          setPulse]         = useState<GoalPulse[]>([])
  const [nextThing,      setNextThing]     = useState('')
  const [prevCommitment, setPrevCommitment] = useState<string | undefined>(undefined)

  // Compute stats once on mount
  useEffect(() => {
    computeStats(week.start, week.end).then(setStats)
  }, [week.start, week.end])

  // Load or resume existing review for this week
  useEffect(() => {
    if (!reviews) return

    // Find last completed review (before this week) for carry-forward
    const prevReview = reviews
      .filter(r => r.weekStart < week.start && r.completedAt && r.nextWeekThing)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
    if (prevReview?.nextWeekThing) setPrevCommitment(prevReview.nextWeekThing)

    const existing = reviews.find(r => r.weekStart === week.start)
    if (!existing) {
      // Pre-fill wins from this week's evening journal entries
      db.journal.toArray().then(entries => {
        const thisWeekWins = entries
          .filter(e => e.date >= week.start && e.date <= week.end && e.kind === 'evening' && e.win)
          .map(e => e.win!)
          .slice(0, 3)
        const prefilled: [string, string, string] = ['', '', '']
        thisWeekWins.forEach((w, i) => { prefilled[i] = w })
        setWins(prefilled)
      })
      return
    }
    // Resume existing record
    setReview(existing)
    if (existing.completedAt) {
      setView('done')
    } else {
      // Resume draft — restore form state from saved record
      if (existing.wins.length === 3) setWins(existing.wins as [string, string, string])
      if (existing.goalPulse.length > 0) setPulse(existing.goalPulse)
      setNextThing(existing.nextWeekThing)
    }
  }, [reviews, week.start, week.end])

  // Seed goal pulse defaults once goals load
  useEffect(() => {
    if (!goals || goals.length === 0 || pulse.length > 0) return
    setPulse(goals.map(g => ({ goalId: g.id, status: 'on-track' as GoalPulseStatus })))
  }, [goals])

  // Derived: 7 days of this week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(week.start + 'T00:00:00')
      d.setDate(d.getDate() + i)
      return localDateISO(d)
    })
  }, [week.start])

  // Derived: energy by day from evening journal
  const energyByDay = useMemo(() => {
    const map: Record<string, 1 | 2 | 3> = {}
    for (const e of weekJournal) {
      if (e.kind === 'evening' && e.energy) map[e.date] = e.energy
    }
    return map
  }, [weekJournal])

  // Derived: plan moods by day
  const planMoods = useMemo(() => {
    const map: Record<string, 'steady' | 'tired' | 'charged'> = {}
    for (const p of weekPlans) {
      if (p.mood) map[p.date] = p.mood
    }
    return map
  }, [weekPlans])

  // ── Persistence helper ────────────────────────────────────────────────────
  async function saveReview(patch: Partial<WeeklyReview>): Promise<WeeklyReview> {
    const base: WeeklyReview = review ?? {
      id:             `wr-${week.start}`,
      weekStart:      week.start,
      weekEnd:        week.end,
      tasksCompleted: stats?.tasksCompleted ?? 0,
      xpGained:       stats?.xpGained       ?? 0,
      journalDays:    stats?.journalDays     ?? 0,
      quadCounts:     { q1: 0, q2: 0, q3: 0, q4: 0 },  // kept for DB compat
      wins:           ['', '', ''],
      goalPulse:      [],
      nextWeekThing:  '',
    }
    const updated: WeeklyReview = { ...base, ...patch, updatedAt: Date.now() }
    await db.weeklyReviews.put(updated)
    enqueueUpsert('weekly_reviews', updated.id, updated)
    setReview(updated)
    return updated
  }

  // ── Step navigation ───────────────────────────────────────────────────────
  async function handleNext() {
    if (step === 0) {
      await saveReview({
        tasksCompleted: stats?.tasksCompleted ?? 0,
        xpGained:       stats?.xpGained       ?? 0,
        journalDays:    stats?.journalDays     ?? 0,
        quadCounts:     { q1: 0, q2: 0, q3: 0, q4: 0 },
      })
    }
    if (step === 2) await saveReview({ goalPulse: pulse })
    setStep(s => Math.min(s + 1, 3))
  }

  function handleBack() {
    if (step > 0) {
      setStep(s => s - 1)
    } else {
      back()
    }
  }

  async function handleComplete() {
    if (!nextThing.trim()) return
    const settings = await db.settings.get(1)
    if (settings) await db.settings.update(1, { xp: (settings.xp ?? 0) + 15 })
    await saveReview({ wins, goalPulse: pulse, nextWeekThing: nextThing.trim(), completedAt: Date.now() })
    setView('done')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="screen">
      <ScreenHeader
        title="Weekly Review"
        subtitle={displayRange(week.start, week.end).toUpperCase()}
        back={back}
      />

      {/* ── History ── */}
      {view === 'history' && (
        <div className="screen-scroll" style={{ padding: '16px 20px' }}>
          <HistoryView reviews={reviews ?? []} />
        </div>
      )}

      {/* ── Done summary ── */}
      {view === 'done' && review && (
        <div className="screen-scroll" style={{ padding: '16px 20px' }}>
          <DoneView review={review} onHistory={() => setView('history')} goals={goals ?? []} />
        </div>
      )}

      {/* ── Wizard ── */}
      {view === 'wizard' && (
        <>
          {/* Progress + label */}
          <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
            <StepProgress step={step} />
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
              color: 'var(--ink-4)', marginTop: 7, textAlign: 'center',
            }}>
              {step + 1} / 4 · {STEP_LABELS[step].toUpperCase()}
            </div>
          </div>

          {/* Step content — loading gate on stats */}
          <div className="screen-scroll" style={{ padding: '20px 20px 110px' }}>
            {!stats ? (
              <div style={{
                textAlign: 'center', paddingTop: 60,
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--ink-4)', letterSpacing: '0.08em',
              }}>
                Computing your week…
              </div>
            ) : (
              <>
                {step === 0 && (
                  <StatsStep
                    stats={stats}
                    streak={settings?.streak ?? 0}
                    xp={settings?.xp ?? 0}
                    tasks={allTasks}
                    habitLogs={habitLogs}
                    cats={cats}
                    energyByDay={energyByDay}
                    weekDays={weekDays}
                  />
                )}
                {step === 1 && (
                  <MoodStep
                    energyByDay={energyByDay}
                    weekDays={weekDays}
                    planMoods={planMoods}
                  />
                )}
                {step === 2 && goals && (
                  <GoalsPulseStep
                    goals={goals}
                    pulse={pulse}
                    cats={cats}
                    onChange={(goalId, status) =>
                      setPulse(prev => [
                        ...prev.filter(p => p.goalId !== goalId),
                        { goalId, status },
                      ])
                    }
                  />
                )}
                {step === 3 && (
                  <PromptsStep
                    wins={wins}
                    onWinChange={(i, v) => setWins(prev => {
                      const n = [...prev] as [string, string, string]
                      n[i] = v
                      return n
                    })}
                    nextThing={nextThing}
                    onNextChange={setNextThing}
                    prevCommitment={prevCommitment}
                  />
                )}
              </>
            )}
          </div>

          {/* Sticky bottom buttons */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
            padding: `12px 20px calc(16px + env(safe-area-inset-bottom))`,
            background: 'var(--paper)', borderTop: '1px solid var(--rule)',
            display: 'flex', gap: 10,
          }}>
            {step > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--paper-2)', color: 'var(--ink-2)',
                  border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icons.back size={17} />
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!stats}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: stats ? 'var(--ink)' : 'var(--paper-3)',
                  color: stats ? 'var(--paper)' : 'var(--ink-3)',
                  fontSize: 15, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {step === 0 ? 'Reflect on it' : 'Next'}&nbsp;<Icons.arrow size={16} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!nextThing.trim()}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: nextThing.trim() ? 'var(--ink)' : 'var(--paper-3)',
                  color:      nextThing.trim() ? 'var(--paper)' : 'var(--ink-3)',
                  fontSize: 15, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icons.sparkle size={16} />&nbsp;Complete Review
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
