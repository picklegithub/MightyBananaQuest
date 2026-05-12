import { localDateISO } from '../lib/useCurrentDate'
/**
 * ProgressScreen — "A steady month."
 *
 * 4-section scrollable stats view:
 *   1. 2×2 BigStat grid  (streak / XP / this week / XP-to-level)
 *   2. 7-day bar chart   (completion rate by day)
 *   3. 84-dot heatmap    (habit-log density, last 12 weeks)
 *   4. By-area bars      (done % per category, all time)
 */

import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen } from '../types'

interface Props { navigate: (s: Screen) => void; back?: () => void }

// ── BigStat card ──────────────────────────────────────────────────────────────
function BigStat({
  label, value, sub, icon,
}: {
  label: string; value: string; sub: string; icon: keyof typeof Icons
}) {
  const I = Icons[icon]
  return (
    <div style={{ padding: 16, borderRadius: 14, background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow" style={{ fontSize: 9 }}>{label}</div>
        <I size={14} stroke="var(--ink-3)" />
      </div>
      <div className="t-display" style={{ fontSize: 32, marginTop: 8, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6, letterSpacing: '0.06em' }}>{sub}</div>
    </div>
  )
}

// ── SectionHead (eyebrow + sub) ───────────────────────────────────────────────
function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="eyebrow">{title}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const ProgressScreen = ({ back }: Props) => {
  const settings  = useLiveQuery(() => db.settings.get(1), [])
  const tasks     = useLiveQuery(() => db.tasks.toArray(), [])
  const cats      = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const habitLogs = useLiveQuery(() => db.habitLog.toArray(), [])

  if (!settings || !tasks || !habitLogs) return null

  const xp     = settings.xp ?? 0
  const streak = settings.streak ?? 0
  const level  = Math.floor(xp / 1000) + 1
  const xpToNext = 1000 - (xp % 1000)

  // ── Date helpers ──────────────────────────────────────────────────────────
  const now      = new Date()
  const todayISO = localDateISO(now)

  function isoOffset(offsetDays: number): string {
    const d = new Date(now)
    d.setDate(d.getDate() - offsetDays)
    return localDateISO(d)
  }

  // ── 7-day bar chart ───────────────────────────────────────────────────────
  // Most-recent day on the right. Each bar = completion % for that day's tasks.
  const last7 = Array.from({ length: 7 }, (_, i) => isoOffset(6 - i))
  const DOW   = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const weekBars = last7.map(iso => {
    const dayTasks = tasks.filter(t => t.due === iso)
    const total    = dayTasks.length
    const done     = dayTasks.filter(t => t.done).length
    return {
      iso,
      pct:     total > 0 ? Math.round((done / total) * 100) : 0,
      isToday: iso === todayISO,
      dow:     DOW[new Date(iso + 'T12:00:00').getDay()],
    }
  })

  // ── This week stats ───────────────────────────────────────────────────────
  const weekDone  = tasks.filter(t => last7.includes(t.due) && t.done).length
  const weekTotal = tasks.filter(t => last7.includes(t.due)).length

  // ── Habit heatmap: last 84 days (12 columns × 7 rows) ────────────────────
  const dots84 = Array.from({ length: 84 }, (_, i) => isoOffset(83 - i))
  const logCounts: Record<string, number> = {}
  for (const l of habitLogs) { logCounts[l.date] = (logCounts[l.date] ?? 0) + 1 }
  const maxLogCount = Math.max(1, ...Object.values(logCounts))

  const startLabel = new Date(dots84[0]  + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })
  const endLabel   = new Date(dots84[83] + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })

  return (
    <div className="screen">
      <ScreenHeader title="Progress" back={back} />

      <div className="screen-scroll" style={{ padding: '0 0 44px' }}>

        {/* ── Display title ─────────────────────────────────────────────────── */}
        <div style={{ padding: '18px 22px 0' }}>
          <div className="t-display" style={{ fontSize: 36, lineHeight: 1.1 }}>
            A <em>steady</em> month.
          </div>
        </div>

        {/* ── 2×2 BigStat grid ─────────────────────────────────────────────── */}
        <div style={{ padding: '20px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <BigStat
            label="DAY STREAK"
            value={String(streak)}
            sub={streak > 0 ? `keep it going` : `start today`}
            icon="flame"
          />
          <BigStat
            label="LIFETIME XP"
            value={xp.toLocaleString()}
            sub={`LVL ${level}`}
            icon="bolt"
          />
          <BigStat
            label="THIS WEEK"
            value={`${weekDone}/${weekTotal}`}
            sub="tasks done"
            icon="check"
          />
          <BigStat
            label="NEXT LEVEL"
            value={xpToNext.toLocaleString()}
            sub={`XP → LVL ${level + 1}`}
            icon="target"
          />
        </div>

        {/* ── 7-day bar chart ───────────────────────────────────────────────── */}
        <div style={{ padding: '28px 22px 0' }}>
          <SectionHead title="Last 7 days" sub="completion rate" />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
            {weekBars.map(bar => (
              <div key={bar.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(bar.pct, 3)}%`,
                    minHeight: 3,
                    background: bar.isToday ? 'var(--accent)' : 'var(--ink)',
                    borderRadius: '4px 4px 0 0',
                    opacity: bar.isToday ? 1 : 0.8,
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

        {/* ── Habit heatmap ─────────────────────────────────────────────────── */}
        <div style={{ padding: '28px 22px 0' }}>
          <SectionHead title="Habit chains" sub="last 12 weeks" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
            {dots84.map((iso, i) => {
              const count = logCounts[iso] ?? 0
              // 4 intensity levels matching the reference
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
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            <span>{startLabel}</span>
            <span>{endLabel}</span>
          </div>
        </div>

        {/* ── By area breakdown ────────────────────────────────────────────── */}
        {cats.length > 0 && (
          <div style={{ padding: '28px 22px 0' }}>
            <SectionHead title="By area" sub="all time" />
            {cats.map(cat => {
              const catTasks = tasks.filter(t => t.cat === cat.id)
              const done     = catTasks.filter(t => t.done).length
              const total    = catTasks.length
              const pct      = total > 0 ? Math.round((done / total) * 100) : 0
              const I        = Icons[cat.icon as keyof typeof Icons] ?? Icons.home
              return (
                <div key={cat.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <I size={14} stroke="var(--ink-2)" />
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{cat.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{pct}%</div>
                  </div>
                  <div style={{ marginTop: 8, height: 3, background: 'var(--paper-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: 'var(--ink)', borderRadius: 2,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
