import React, { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import type { Screen } from '../types'

interface Props { back: () => void; navigate: (s: Screen) => void }

// ── Build an ordered array of the last N days (ISO strings) ──────────────────
function lastNDays(n: number): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

// ── Calculate current streak from a Set of logged dates ──────────────────────
function calcStreak(loggedSet: Set<string>): number {
  const today = new Date().toISOString().slice(0, 10)
  let streak = 0
  let cursor = new Date()
  // Allow today + yesterday to both count as "current"
  while (true) {
    const iso = cursor.toISOString().slice(0, 10)
    if (loggedSet.has(iso)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ── Heatmap cell opacity based on logged/not ─────────────────────────────────
// Day-of-week labels
const DOW = ['M','T','W','T','F','S','S']

// ── XP → level ───────────────────────────────────────────────────────────────
function xpToLevel(xp: number) {
  // Every 100 XP = 1 level, with increasing thresholds after level 10
  if (xp < 1000) return { level: Math.floor(xp / 100) + 1, next: (Math.floor(xp / 100) + 1) * 100, prev: Math.floor(xp / 100) * 100 }
  const base = 10 + Math.floor((xp - 1000) / 500)
  const rem  = (xp - 1000) % 500
  return { level: base, next: xp - rem + 500, prev: xp - rem }
}

// ── Heatmap component for one habit ──────────────────────────────────────────
function HabitHeatmap({ loggedDates, hue }: { loggedDates: Set<string>; hue?: number }) {
  const WEEKS = 13  // ~3 months
  const days  = lastNDays(WEEKS * 7)
  const today = new Date().toISOString().slice(0, 10)

  // Pad start so row 0 = Monday
  const firstDay = new Date(days[0])
  const dow = (firstDay.getDay() + 6) % 7  // 0=Mon … 6=Sun
  const padded: (string | null)[] = [...Array(dow).fill(null), ...days]

  // Build WEEKS columns × 7 rows grid
  const cols: (string | null)[][] = []
  for (let w = 0; w < WEEKS + 1; w++) {
    cols.push(padded.slice(w * 7, w * 7 + 7))
  }

  const color = hue !== undefined ? `hsl(${hue}, 55%, 42%)` : 'var(--accent)'

  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2 }}>
      {/* Day labels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 0, flexShrink: 0 }}>
        {DOW.map((d, i) => (
          <div key={i} style={{
            width: 10, height: 10, fontFamily: 'var(--font-mono)', fontSize: 7,
            color: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {i % 2 === 0 ? d : ''}
          </div>
        ))}
      </div>

      {/* Week columns */}
      {cols.map((col, wi) => (
        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 7 }, (_, di) => {
            const dateStr = col[di] ?? null
            if (!dateStr) return <div key={di} style={{ width: 10, height: 10 }} />
            const logged  = loggedDates.has(dateStr)
            const isToday = dateStr === today
            return (
              <div
                key={di}
                title={dateStr}
                style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: logged ? color : 'var(--paper-3)',
                  opacity: logged ? 1 : 0.4,
                  outline: isToday ? `1.5px solid ${color}` : 'none',
                  outlineOffset: 1,
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export const ProgressScreen = ({ back }: Props) => {
  const tasks      = useLiveQuery(() => db.tasks.toArray(), [])
  const habitLogs  = useLiveQuery(() => db.habitLog.toArray(), [])
  const settings   = useLiveQuery(() => db.settings.get(1), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const xp     = settings?.xp ?? 0
  const { level, next, prev } = xpToLevel(xp)
  const xpProgress = (xp - prev) / (next - prev)

  // Recurring tasks shown in heatmap (habits now live in the habits table; recurring tasks stay here)
  const habitTasks = useMemo(
    () => (tasks ?? []).filter(t => !!t.recurring),
    [tasks]
  )

  // Build a map: taskId → Set<dateStr>
  const logMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const log of habitLogs ?? []) {
      if (!m.has(log.taskId)) m.set(log.taskId, new Set())
      m.get(log.taskId)!.add(log.date)
    }
    return m
  }, [habitLogs])

  // Stats for header
  const totalTasksDone = useMemo(() => (tasks ?? []).filter(t => t.done).length, [tasks])
  const totalTasks     = useMemo(() => (tasks ?? []).length, [tasks])
  const journalStreak  = settings?.streak ?? 0

  if (!tasks || !settings) return null

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', borderBottom: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} /> Back
        </button>
        <h1 className="t-display" style={{ fontSize: 20 }}>Progress</h1>
        <ThemeToggle />
      </div>

      <div className="screen-scroll" style={{ padding: '18px 18px 48px' }}>

        {/* ── XP / Level card ── */}
        <div style={{
          background: 'var(--ink)', color: 'var(--paper)',
          borderRadius: 16, padding: '20px 22px 22px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
                Level
              </div>
              <div className="t-display" style={{ fontSize: 42, lineHeight: 1 }}>{level}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                {xp.toLocaleString()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.5, letterSpacing: '0.06em' }}>XP TOTAL</div>
            </div>
          </div>
          {/* XP progress bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--paper)', width: `${xpProgress * 100}%`, transition: 'width .5s ease' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.5, letterSpacing: '0.06em' }}>
            <span>{prev.toLocaleString()} XP</span>
            <span>{(next - xp).toLocaleString()} to Lv {level + 1}</span>
          </div>
        </div>

        {/* ── Quick stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Tasks done',   value: totalTasksDone, sub: `of ${totalTasks}` },
            { label: 'Habits',       value: habitTasks.length, sub: 'tracked' },
            { label: 'Journal',      value: journalStreak > 0 ? `${journalStreak}d` : '—', sub: 'streak' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              borderRadius: 12, padding: '12px 12px 10px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div className="t-display" style={{ fontSize: 22 }}>{s.value}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Habits section ── */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Habits &amp; Streaks
        </div>

        {habitTasks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '36px 20px',
            background: 'var(--paper-2)', borderRadius: 14, border: '1px dashed var(--rule)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🌱</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              No habits yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 6 }}>
              Mark any task as a Habit or add a repeating task to start tracking.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {habitTasks.map(task => {
              const logged  = logMap.get(task.id) ?? new Set<string>()
              const streak  = calcStreak(logged)
              const area    = categories?.find(c => c.id === task.cat)
              const areaHue = area?.hue
              const todayLogged = logged.has(new Date().toISOString().slice(0, 10))

              return (
                <div key={task.id} style={{
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  borderRadius: 14, padding: '14px 14px 12px',
                  borderLeft: areaHue !== undefined ? `3px solid hsl(${areaHue}, 55%, 42%)` : '3px solid var(--accent)',
                }}>
                  {/* Habit header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {area && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 9,
                            color: areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--ink-3)',
                            letterSpacing: '0.04em',
                          }}>
                            {area.name}
                          </span>
                        )}
                        {task.recurring && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Icons.repeat size={9} /> {task.recurring}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Streak badge */}
                    <div style={{ flexShrink: 0, textAlign: 'right', paddingLeft: 12 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                        color: streak > 0 ? 'var(--warn)' : 'var(--ink-4)',
                      }}>
                        {streak > 0 && <Icons.flame size={16} />}
                        {streak}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                        {streak === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                  </div>

                  {/* Today status */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 10,
                    padding: '4px 10px', borderRadius: 999,
                    background: todayLogged
                      ? (areaHue !== undefined ? `hsl(${areaHue}, 40%, 92%)` : 'var(--accent-soft)')
                      : 'var(--paper-3)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                    color: todayLogged
                      ? (areaHue !== undefined ? `hsl(${areaHue}, 55%, 35%)` : 'var(--accent)')
                      : 'var(--ink-4)',
                  }}>
                    {todayLogged ? <Icons.check size={10} sw={2.5} /> : <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid currentColor', display: 'inline-block' }} />}
                    {todayLogged ? 'Done today' : 'Pending today'}
                  </div>

                  {/* Heatmap */}
                  <HabitHeatmap loggedDates={logged} hue={areaHue} />

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.05em' }}>
                    <span>{logged.size} total completions</span>
                    <span>Best streak: {task.streak > 0 ? `${task.streak}d` : '—'}</span>
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
