import { localDateISO } from '../lib/useCurrentDate'
/**
 * ProgressScreen — "A steady month."
 *
 * 5-section scrollable stats view:
 *   1. 2×2 BigStat grid     (streak / XP / this week / XP-to-level)
 *   2. 7-day bar chart       (completion rate by day)
 *   3. 84-dot heatmap        (habit-log density, last 12 weeks)
 *   4. Mood & Energy panel   (sustainability score, avg energy, mood dist)
 *   5. By-area bars          (done % per category, all time)
 *   6. Activity log          (last 50 completed tasks)
 */

import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { EFFORT } from '../constants'
import type { Screen, AppSettings, Task, Category } from '../types'
import { useNav } from '../lib/navContext'
import {
  getEnergyStats, getMoodDistribution, getSustainabilityScore,
  type EnergyStats, type MoodDistribution,
} from '../lib/analyticsQueries'

// ── Progress stats shape ──────────────────────────────────────────────────────
interface ProgressStats {
  tasksCompleted: number   // last 30 days
  journalDays:   number   // distinct days with any journal entry, last 30
  habitsDone:    number   // total habit completions, last 30 days
  weekTasksDone: number   // tasks done in last 7 days
}

// ── Headline generator — 10 editorial tiers ───────────────────────────────────
// Mirrors WeeklyReviewScreen's generateInsight() pattern.
// Ordered from rarest (most impressive) → most common so the first true
// condition always wins the most meaningful observation.
function generateProgressHeadline(
  streak: number,
  stats: ProgressStats,
): { prefix: string; em: string; suffix: string } {
  const { tasksCompleted, journalDays, habitsDone, weekTasksDone } = stats

  // ── Streak tiers ──────────────────────────────────────────────────────────
  if (streak >= 30) return { prefix: 'A',        em: 'remarkable',  suffix: 'month.'      }
  if (streak >= 14) return { prefix: 'A',        em: 'brilliant',   suffix: 'fortnight.'  }
  if (streak >= 7)  return { prefix: 'Seven',    em: 'consecutive', suffix: 'days.'       }

  // ── Task volume tiers ─────────────────────────────────────────────────────
  if (tasksCompleted >= 40) return { prefix: 'A',    em: 'legendary',  suffix: 'month.'      }
  if (tasksCompleted >= 20) return { prefix: 'A',    em: 'productive', suffix: 'month.'      }
  if (tasksCompleted >= 10) return { prefix: 'Good', em: 'momentum',   suffix: 'this month.' }

  // ── Habit consistency ─────────────────────────────────────────────────────
  if (habitsDone >= 50) return { prefix: 'Habits',     em: 'cemented.',  suffix: 'Remarkable.'  }
  if (habitsDone >= 20) return { prefix: 'Habits',     em: 'holding.',   suffix: 'Keep at it.'  }

  // ── Journal consistency ───────────────────────────────────────────────────
  if (journalDays >= 20) return { prefix: 'A',          em: 'reflective', suffix: 'month.'       }
  if (journalDays >= 10) return { prefix: 'Reflection', em: 'becoming',   suffix: 'a habit.'     }

  // ── Getting started ───────────────────────────────────────────────────────
  if (weekTasksDone >= 3) return { prefix: 'A',      em: 'steady',  suffix: 'week.'    }
  if (tasksCompleted > 0 || journalDays > 0 || habitsDone > 0)
                           return { prefix: 'Every',  em: 'step',    suffix: 'counts.'  }

  // ── Empty / brand new ─────────────────────────────────────────────────────
  return { prefix: 'A fresh', em: 'start', suffix: 'awaits.' }
}

interface Props { navigate?: (s: Screen) => void; back?: () => void }

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
        <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
        <I size={14} stroke="var(--ink-3)" />
      </div>
      <div className="t-display" style={{ fontSize: 32, marginTop: 8, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6, letterSpacing: '0.06em' }}>{sub}</div>
    </div>
  )
}

// ── Activity log helpers ──────────────────────────────────────────────────────
const ACTIVITY_LIMIT = 50  // max completed tasks to show in the log

/** Group a sorted array of tasks into { dateISO → Task[] } ordered most-recent first */
function groupByDate(tasks: Task[]): { date: string; tasks: Task[] }[] {
  const map: Record<string, Task[]> = {}
  for (const t of tasks) {
    // Prefer completedAt timestamp → fall back to due date
    const iso = t.completedAt
      ? new Date(t.completedAt).toISOString().slice(0, 10)
      : t.due
    if (!map[iso]) map[iso] = []
    map[iso].push(t)
  }
  // Sort groups most-recent first
  return Object.entries(map)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, tasks]) => ({ date, tasks }))
}

function formatActivityDate(iso: string, todayISO: string): string {
  const yesterday = new Date(todayISO + 'T12:00:00')
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayISO = yesterday.toISOString().slice(0, 10)
  if (iso === todayISO)      return 'Today'
  if (iso === yesterdayISO)  return 'Yesterday'
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

// ── ActivityRow ───────────────────────────────────────────────────────────────
function ActivityRow({ task, cat }: { task: Task; cat: Category | undefined }) {
  const I = cat ? (Icons[cat.icon as keyof typeof Icons] ?? Icons.home) : Icons.check
  const xp = EFFORT[task.effort]?.xp ?? 15
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid var(--rule)',
    }}>
      {/* Category dot/icon */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--paper-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <I size={12} stroke="var(--ink-2)" />
      </div>

      {/* Title + category label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        {cat && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--ink-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {cat.name}
          </div>
        )}
      </div>

      {/* XP badge */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--ink-3)',
        background: 'var(--paper-3)',
        borderRadius: 4, padding: '2px 6px',
        flexShrink: 0,
      }}>
        +{xp} XP
      </div>
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
export const ProgressScreen = ({ back: backProp }: Props) => {
  const { back: ctxBack } = useNav()
  const back = backProp ?? ctxBack
  const settings  = useLiveQuery(() => db.settings.get(1), [])
  const tasks     = useLiveQuery(() => db.tasks.toArray(), [])
  const cats      = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const habitLogs = useLiveQuery(() => db.habitLog.toArray(), [])
  const journal   = useLiveQuery(() => db.journal.toArray(), []) ?? []

  // ── Mood & Energy analytics (async — not reactive, loads once) ───────────
  const [energyStats,   setEnergyStats]   = useState<EnergyStats | null>(null)
  const [moodDist,      setMoodDist]      = useState<MoodDistribution | null>(null)
  const [sustainScore,  setSustainScore]  = useState<number>(NaN)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getEnergyStats(30),
      getMoodDistribution(30),
      getSustainabilityScore(30),
    ]).then(([e, m, s]) => {
      if (cancelled) return
      setEnergyStats(e)
      setMoodDist(m)
      setSustainScore(s)
    })
    return () => { cancelled = true }
  }, [])

  // Activity log: most-recent ACTIVITY_LIMIT completed tasks, newest first
  const recentDone = useLiveQuery(
    () => db.tasks
      .filter(t => !!t.done)
      .toArray()
      .then(arr =>
        arr
          .sort((a, b) => (b.completedAt ?? b.createdAt ?? 0) - (a.completedAt ?? a.createdAt ?? 0))
          .slice(0, ACTIVITY_LIMIT)
      ),
    [],
  ) ?? []

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
  const weekDone  = tasks.filter(t => t.done && t.completedAt && last7.includes(localDateISO(new Date(t.completedAt)))).length
  const weekTotal = new Set([
    ...tasks.filter(t => t.due && last7.includes(t.due)).map(t => t.id),
    ...tasks.filter(t => t.done && t.completedAt && last7.includes(localDateISO(new Date(t.completedAt)))).map(t => t.id),
  ]).size

  // ── Habit heatmap: last 84 days (12 columns × 7 rows) ────────────────────
  const dots84 = Array.from({ length: 84 }, (_, i) => isoOffset(83 - i))
  const logCounts: Record<string, number> = {}
  for (const l of habitLogs) { logCounts[l.date] = (logCounts[l.date] ?? 0) + 1 }
  const maxLogCount = Math.max(1, ...Object.values(logCounts))

  const startLabel = new Date(dots84[0]  + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })
  const endLabel   = new Date(dots84[83] + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })

  // ── Category lookup map ───────────────────────────────────────────────────
  const catMap = React.useMemo(
    () => Object.fromEntries(cats.map(c => [c.id, c])),
    [cats],
  )

  // ── Activity log groups ───────────────────────────────────────────────────
  const activityGroups = React.useMemo(
    () => groupByDate(recentDone),
    [recentDone],
  )

  // ── Dynamic headline ──────────────────────────────────────────────────────
  const last30 = Array.from({ length: 30 }, (_, i) => isoOffset(29 - i))

  const progressStats: ProgressStats = {
    tasksCompleted: tasks.filter(t => t.done && t.completedAt && last30.includes(localDateISO(new Date(t.completedAt)))).length,
    journalDays:    new Set(journal.filter(e => last30.includes(e.date)).map(e => e.date)).size,
    habitsDone:     habitLogs.filter(l => last30.includes(l.date)).length,
    weekTasksDone:  tasks.filter(t => t.done && t.completedAt && last7.includes(localDateISO(new Date(t.completedAt)))).length,
  }
  const { prefix, em, suffix } = generateProgressHeadline(streak, progressStats)

  return (
    <div className="screen">
      <ScreenHeader title="Progress" back={back} icon={<Icons.chart size={22} />} />

      <div className="screen-scroll" style={{ padding: '0 0 44px' }}>

        {/* ── Display title ─────────────────────────────────────────────────── */}
        <div style={{ padding: '18px 22px 0' }}>
          <div className="t-display" style={{ fontSize: 36, lineHeight: 1.1 }}>
            {prefix} <em>{em}</em> {suffix}
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
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
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

        {/* ── Mood & Energy ────────────────────────────────────────────────── */}
        {(energyStats || moodDist) && (
          <div style={{ padding: '28px 22px 0' }}>
            <SectionHead title="Mood & energy" sub="last 30 days" />

            {/* Score + avg energy cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>SUSTAINABILITY</div>
                <div className="t-display" style={{ fontSize: 30, marginTop: 6, lineHeight: 1, color: isNaN(sustainScore) ? 'var(--ink-3)' : 'var(--ink)' }}>
                  {isNaN(sustainScore) ? '—' : sustainScore}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 5, letterSpacing: '0.04em' }}>/ 100 score</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>AVG ENERGY</div>
                <div className="t-display" style={{ fontSize: 30, marginTop: 6, lineHeight: 1, color: energyStats && !isNaN(energyStats.avg) ? 'var(--ink)' : 'var(--ink-3)' }}>
                  {energyStats && !isNaN(energyStats.avg) ? energyStats.avg.toFixed(1) : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 5, letterSpacing: '0.04em' }}>
                  {energyStats && energyStats.trend !== 'insufficient'
                    ? `${energyStats.trend === 'up' ? '↑' : energyStats.trend === 'down' ? '↓' : '→'} vs prior week`
                    : '/ 3.0 scale'}
                </div>
              </div>
            </div>

            {/* Mood distribution bars */}
            {moodDist && (moodDist.charged + moodDist.steady + moodDist.tired > 0) && (() => {
              const mMax = Math.max(moodDist.charged, moodDist.steady, moodDist.tired, 1)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { key: 'charged', emoji: '⚡', color: 'var(--accent)', count: moodDist.charged },
                    { key: 'steady',  emoji: '✦',  color: 'var(--ink-2)', count: moodDist.steady  },
                    { key: 'tired',   emoji: '○',  color: 'var(--warn)',  count: moodDist.tired   },
                  ] as const).map(bar => (
                    <div key={bar.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)', flexShrink: 0 }}>
                        {bar.emoji} {bar.key.charAt(0).toUpperCase() + bar.key.slice(1)}
                      </div>
                      <div style={{ flex: 1, height: 8, background: 'var(--paper-3)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${(bar.count / mMax) * 100}%`, height: '100%',
                          background: bar.color, borderRadius: 4,
                          minWidth: bar.count > 0 ? 4 : 0, transition: 'width .5s ease',
                        }} />
                      </div>
                      <div style={{ width: 22, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', textAlign: 'right', flexShrink: 0 }}>
                        {bar.count}d
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Empty state */}
            {moodDist && moodDist.charged + moodDist.steady + moodDist.tired === 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', paddingTop: 4 }}>
                Log mood in Daily Plan or Morning Journal to see data here.
              </div>
            )}
          </div>
        )}

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

        {/* ── Activity log ─────────────────────────────────────────────── */}
        <div style={{ padding: '28px 22px 0' }}>
          <SectionHead title="Activity" sub={`last ${recentDone.length} completed`} />

          {activityGroups.length === 0 ? (
            <div style={{
              padding: '24px 0', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)',
            }}>
              Complete a task to see your history here.
            </div>
          ) : (
            activityGroups.map(group => (
              <div key={group.date}>
                {/* Date header */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--ink-3)', textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  padding: '12px 0 2px',
                }}>
                  {formatActivityDate(group.date, todayISO)}
                </div>
                {group.tasks.map(task => (
                  <ActivityRow
                    key={task.id}
                    task={task}
                    cat={catMap[task.cat]}
                  />
                ))}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
