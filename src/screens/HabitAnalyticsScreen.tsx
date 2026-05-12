/**
 * HabitAnalyticsScreen — wellness analytics for the habits system.
 *
 * Shows:
 *   • Overall consistency score (% of scheduled days completed)
 *   • 4-week completion rate bar chart (SVG inline)
 *   • Trend indicator (last 7d vs prior 7d)
 *   • Weekday breakdown (which days are strongest/weakest)
 */
import React, { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen } from '../types'

interface Props { navigate: (s: Screen) => void; back: () => void }

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({
  data, labels, color
}: {
  data: number[]
  labels: string[]
  color: string
}) {
  const max = Math.max(...data, 1)
  const W   = 260
  const H   = 60
  const bw  = Math.floor((W - (data.length - 1) * 4) / data.length)

  return (
    <svg width={W} height={H + 18} viewBox={`0 0 ${W} ${H + 18}`} style={{ overflow: 'visible' }}>
      {data.map((v, i) => {
        const barH = Math.max(4, (v / max) * H)
        const x    = i * (bw + 4)
        const y    = H - barH
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={bw} height={barH}
              rx={3}
              fill={v > 0 ? color : 'var(--rule)'}
              opacity={v > 0 ? 0.85 : 1}
            />
            <text
              x={x + bw / 2} y={H + 13}
              textAnchor="middle"
              fontSize={8}
              fontFamily="var(--font-mono)"
              fill="var(--ink-4)"
            >
              {labels[i]}
            </text>
            {v > 0 && (
              <text
                x={x + bw / 2} y={y - 3}
                textAnchor="middle"
                fontSize={8}
                fontFamily="var(--font-mono)"
                fill={color}
              >
                {v}%
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Weekday bar ───────────────────────────────────────────────────────────────
function WeekdayBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
        width: 28, flexShrink: 0, letterSpacing: '0.03em',
      }}>
        {label}
      </div>
      <div style={{
        flex: 1, height: 8, borderRadius: 4, background: 'var(--rule)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: pct > 0 ? color : 'transparent',
          transition: 'width .4s ease',
        }} />
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
        width: 32, textAlign: 'right', flexShrink: 0,
      }}>
        {pct > 0 ? `${pct}%` : '—'}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function HabitAnalyticsScreen({ back }: Props) {
  const habits  = useLiveQuery(() => db.habits.toArray(), [])
  const allLogs = useLiveQuery(() => db.habitLog.toArray(), [])

  const analytics = useMemo(() => {
    if (!habits || !allLogs) return null

    const today      = new Date(); today.setHours(0, 0, 0, 0)
    const logSet     = new Set(allLogs.map(l => l.date))

    // ── Overall consistency ────────────────────────────────────────────────
    // For each habit, count days since it was created vs logged days
    let totalScheduled = 0
    let totalLogged    = 0

    habits.forEach(habit => {
      const created = habit.createdAt ? new Date(habit.createdAt) : new Date(today)
      created.setHours(0, 0, 0, 0)
      const daysSince = Math.max(1, Math.round((today.getTime() - created.getTime()) / 86400000) + 1)
      const habitLogs = allLogs.filter(l => l.taskId === habit.id).length
      totalScheduled += daysSince
      totalLogged    += habitLogs
    })

    const consistencyPct = totalScheduled > 0
      ? Math.round((totalLogged / totalScheduled) * 100)
      : 0

    // ── 4-week completion rate ─────────────────────────────────────────────
    const weeks: { label: string; pct: number }[] = []
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - (w + 1) * 7 + 1)
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() - w * 7)

      let scheduled = 0
      let logged    = 0

      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const iso = isoDate(d)
        if (iso > isoDate(today)) continue
        scheduled += habits.length
        logged    += allLogs.filter(l => l.date === iso).length
      }

      const weekLabel = `W${4 - w}`
      weeks.push({
        label: weekLabel,
        pct: scheduled > 0 ? Math.round((logged / scheduled) * 100) : 0,
      })
    }

    // ── Trend: last 7d vs prior 7d ─────────────────────────────────────────
    let last7 = 0, prior7 = 0
    for (let i = 0; i < 7; i++) {
      const iso = daysAgo(i)
      last7 += allLogs.filter(l => l.date === iso).length
    }
    for (let i = 7; i < 14; i++) {
      const iso = daysAgo(i)
      prior7 += allLogs.filter(l => l.date === iso).length
    }
    const trendDelta = last7 - prior7
    const trend: 'up' | 'down' | 'flat' = trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat'

    // ── Weekday breakdown ─────────────────────────────────────────────────
    const dowCounts   = Array(7).fill(0)  // logged per dow
    const dowSchedule = Array(7).fill(0)  // scheduled per dow (past 12 weeks)
    const cutoff = daysAgo(84)
    allLogs.forEach(l => {
      if (l.date >= cutoff) {
        const dow = new Date(l.date + 'T00:00:00').getDay()
        dowCounts[dow]++
      }
    })
    // Count scheduled occurrences per DOW in past 12 weeks
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const dow = d.getDay()
      dowSchedule[dow] += habits.length
    }
    const dowPcts = dowCounts.map((c, i) =>
      dowSchedule[i] > 0 ? Math.round((c / dowSchedule[i]) * 100) : 0
    )

    return { consistencyPct, weeks, trend, last7, prior7, dowPcts, totalLogged }
  }, [habits, allLogs])

  if (!analytics) {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</div>
      </div>
    )
  }

  const accentColor = 'var(--accent)'
  const { consistencyPct, weeks, trend, last7, prior7, dowPcts, totalLogged } = analytics

  return (
    <div className="screen">
      <ScreenHeader
        title="Analytics"
        subtitle={(habits?.length ?? 0) === 1 ? '1 habit tracked' : `${habits?.length ?? 0} habits tracked`}
        back={back}
      />

      <div className="screen-scroll" style={{ padding: '20px 20px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Consistency score ── */}
        <div style={{
          background: 'var(--paper-2)', borderRadius: 16, padding: '20px',
          border: '1px solid var(--rule)',
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          {/* Ring */}
          <svg width={80} height={80} viewBox="0 0 80 80" style={{ flexShrink: 0 }}>
            <circle cx={40} cy={40} r={32} fill="none" stroke="var(--rule)" strokeWidth={8} />
            <circle
              cx={40} cy={40} r={32}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={8}
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - consistencyPct / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
            <text x={40} y={44} textAnchor="middle" fontSize={18} fontWeight={700}
              fill="var(--ink)" fontFamily="var(--font-mono)">
              {consistencyPct}%
            </text>
          </svg>
          <div>
            <div className="t-display" style={{ fontSize: 18, marginBottom: 4 }}>Consistency</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              {totalLogged} check-in{totalLogged !== 1 ? 's' : ''} across all habits
            </div>
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 12,
              background: trend === 'up' ? 'oklch(0.96 0.05 145)' : trend === 'down' ? 'oklch(0.97 0.04 25)' : 'var(--paper)',
              border: '1px solid var(--rule)',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
              color: trend === 'up' ? 'oklch(0.40 0.12 145)' : trend === 'down' ? 'oklch(0.50 0.14 25)' : 'var(--ink-3)',
            }}>
              {trend === 'up'   && '↑ Improving'}
              {trend === 'down' && '↓ Declining'}
              {trend === 'flat' && '→ Steady'}
              <span style={{ opacity: 0.65 }}>vs last week</span>
            </div>
          </div>
        </div>

        {/* ── 4-week bar chart ── */}
        <div style={{
          background: 'var(--paper-2)', borderRadius: 16, padding: '18px 20px',
          border: '1px solid var(--rule)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
            color: 'var(--ink-4)', marginBottom: 14, textTransform: 'uppercase',
          }}>
            4-week completion rate
          </div>
          <BarChart
            data={weeks.map(w => w.pct)}
            labels={weeks.map(w => w.label)}
            color="var(--accent)"
          />
          <div style={{
            marginTop: 10, display: 'flex', gap: 16,
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
          }}>
            <span>Last 7 days: <strong style={{ color: 'var(--ink)' }}>{last7} ✓</strong></span>
            <span>Prior 7 days: <strong style={{ color: 'var(--ink)' }}>{prior7} ✓</strong></span>
          </div>
        </div>

        {/* ── Weekday breakdown ── */}
        <div style={{
          background: 'var(--paper-2)', borderRadius: 16, padding: '18px 20px',
          border: '1px solid var(--rule)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
            color: 'var(--ink-4)', marginBottom: 14, textTransform: 'uppercase',
          }}>
            Weekday consistency (12 weeks)
          </div>
          {DOW_NAMES.map((name, i) => (
            <WeekdayBar key={i} label={name} pct={dowPcts[i]} color="var(--accent)" />
          ))}
        </div>

      </div>
    </div>
  )
}
