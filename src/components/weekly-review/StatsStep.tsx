import React from 'react'
import { localDateISO } from '../../lib/useCurrentDate'
import { Icons } from '../ui/Icons'
import { StatCard } from './StatCard'
import { isoOffsetFrom, generateInsight } from './shared'
import type { WeekStats } from './shared'
import type { Task, Category } from '../../types'

interface Props {
  stats:       WeekStats
  streak:      number
  xp:          number
  tasks:       Task[]
  habitLogs:   { date: string }[]
  cats:        Category[]
  energyByDay: Record<string, 1 | 2 | 3>
  weekDays:    string[]
}

export function StatsStep({ stats, streak, xp, tasks, habitLogs, cats, energyByDay, weekDays }: Props) {
  const level    = Math.floor(xp / 1000) + 1
  const xpToNext = 1000 - (xp % 1000)

  const now      = new Date()
  const todayStr = localDateISO(now)
  const DOW      = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const last7    = Array.from({ length: 7 }, (_, i) => isoOffsetFrom(now, 6 - i))
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

  const dots84 = Array.from({ length: 84 }, (_, i) => isoOffsetFrom(now, 83 - i))
  const logCounts: Record<string, number> = {}
  for (const l of habitLogs) { logCounts[l.date] = (logCounts[l.date] ?? 0) + 1 }
  const maxLogCount = Math.max(1, ...Object.values(logCounts))
  const startLabel  = new Date(dots84[0]  + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })
  const endLabel    = new Date(dots84[83] + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })

  // suppress unused warning
  void level

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

      {/* Insight */}
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: 'var(--ink)', color: 'var(--paper)',
        fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic', lineHeight: 1.55,
      }}>
        {generateInsight(stats, streak)}
      </div>

      {/* Energy mini-chart */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Energy this week</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
          {weekDays.map(iso => {
            const e    = energyByDay[iso]
            const pct  = e === 3 ? 100 : e === 2 ? 65 : e === 1 ? 30 : 0
            const color = e === 3 ? 'var(--accent)' : e === 2 ? 'var(--ink-2)' : e === 1 ? 'var(--warn)' : 'var(--ink-4)'
            const dow  = DOW[new Date(iso + 'T12:00:00').getDay()]
            return (
              <div key={iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: e ? `${pct}%` : 3, minHeight: 3,
                    background: e ? color : 'var(--rule)',
                    borderRadius: '3px 3px 0 0', transition: 'height .3s ease',
                  }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{dow}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2×2 stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Day streak"  value={streak}                    icon="flame"  color="hsl(30,90%,50%)"  />
        <StatCard label="Lifetime XP" value={xp.toLocaleString()}       icon="bolt"   color="hsl(45,85%,48%)"  />
        <StatCard label="This week"   value={`${stats.tasksCompleted}`} icon="check"  color="var(--accent)"    />
        <StatCard label="Next level"  value={xpToNext.toLocaleString()} icon="target" color="hsl(200,60%,45%)" />
      </div>

      {/* Journal + habits row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Journal days"    value={`${stats.journalDays}/7`} icon="journal" color="hsl(200,60%,45%)" />
        <StatCard label="Habit check-ins" value={stats.habitsDone}         icon="flame"   color="hsl(280,55%,48%)" />
      </div>

      {/* 7-day bar chart */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Last 7 days</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {weekBars.map(bar => (
            <div key={bar.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '100%', height: `${Math.max(bar.pct, 3)}%`, minHeight: 3,
                  background: bar.isToday ? 'var(--accent)' : 'var(--ink)',
                  borderRadius: '4px 4px 0 0',
                  opacity: bar.isToday ? 1 : 0.75, transition: 'height .4s ease',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{bar.dow}</div>
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
        <div style={{
          marginTop: 7, display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
        }}>
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
