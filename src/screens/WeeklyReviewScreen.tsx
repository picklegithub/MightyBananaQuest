import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import type { Screen, Goal, WeeklyReview, GoalPulse, GoalPulseStatus } from '../types'

// ── Week helpers ──────────────────────────────────────────────────────────────

function getMondayISO(d: Date): string {
  const day  = d.getDay()                  // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day   // shift back to Monday
  const mon  = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

function getSundayISO(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
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
  quadCounts:     { q1: number; q2: number; q3: number; q4: number }
  partial:        boolean  // week isn't over yet
}

async function computeStats(weekStart: string, weekEnd: string): Promise<WeekStats> {
  const startMs  = new Date(weekStart + 'T00:00:00').getTime()
  const endMs    = new Date(weekEnd   + 'T23:59:59').getTime()
  const todayISO = new Date().toISOString().slice(0, 10)

  const allTasks  = await db.tasks.toArray()
  const completed = allTasks.filter(
    t => t.done && t.updatedAt != null && t.updatedAt >= startMs && t.updatedAt <= endMs
  )

  const xpGained  = completed.reduce((s, t) => s + (EFFORT[t.effort]?.xp ?? 0), 0)
  const quadCounts = { q1: 0, q2: 0, q3: 0, q4: 0 }
  completed.forEach(t => {
    const q = t.quad as keyof typeof quadCounts
    if (q in quadCounts) quadCounts[q]++
  })

  const entries     = await db.journal.toArray()
  const journalDays = new Set(
    entries.filter(e => e.date >= weekStart && e.date <= weekEnd).map(e => e.date)
  ).size

  return { tasksCompleted: completed.length, xpGained, journalDays, quadCounts, partial: todayISO < weekEnd }
}

// ── Step progress bar ─────────────────────────────────────────────────────────

function StepProgress({ step, total = 5 }: { step: number; total?: number }) {
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

const STEP_LABELS = ['Your week', 'Wins', 'Goals pulse', 'Energy map', 'Commitment']

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

function StatsStep({ stats }: { stats: WeekStats }) {
  const total = stats.quadCounts.q1 + stats.quadCounts.q2 + stats.quadCounts.q3 + stats.quadCounts.q4
  const q2pct = total > 0 ? Math.round((stats.quadCounts.q2 / total) * 100) : 0

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Tasks done"   value={stats.tasksCompleted} icon="check"   color="var(--accent)"       />
        <StatCard label="XP earned"    value={stats.xpGained}       icon="bolt"    color="hsl(45,85%,48%)"     />
        <StatCard label="Journal days" value={`${stats.journalDays}/7`} icon="journal" color="hsl(200,60%,45%)" />
        <StatCard label="Q2 energy"    value={`${q2pct}%`}          icon="target"  color="hsl(145,55%,40%)"    />
      </div>

      {stats.tasksCompleted === 0 && (
        <div style={{
          padding: '13px 16px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6,
        }}>
          No completed tasks recorded this week. Tasks need a completion timestamp — future completions will appear here automatically.
        </div>
      )}
    </div>
  )
}

// ── Step 1: Wins ──────────────────────────────────────────────────────────────

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
                  background: `hsl(${hue},55%,42%)`,
                }} />
                <div style={{ fontSize: 14, fontWeight: 500, flex: 1, lineHeight: 1.3 }}>{goal.title}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: `hsl(${hue},55%,42%)`, letterSpacing: '0.06em',
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

// ── Step 3: Quadrant audit ────────────────────────────────────────────────────

function QuadrantStep({ quadCounts }: { quadCounts: { q1: number; q2: number; q3: number; q4: number } }) {
  const total = quadCounts.q1 + quadCounts.q2 + quadCounts.q3 + quadCounts.q4
  const q2pct = total > 0 ? Math.round((quadCounts.q2 / total) * 100) : 0

  const quads: { key: keyof typeof quadCounts; label: string; sub: string; color: string; highlight?: boolean }[] = [
    { key: 'q1', label: 'Urgent · Important',      sub: 'Do first',  color: 'hsl(0,60%,50%)'    },
    { key: 'q2', label: 'Important · Not urgent',   sub: 'Schedule',  color: 'hsl(145,55%,40%)', highlight: true },
    { key: 'q3', label: 'Urgent · Not important',   sub: 'Delegate',  color: 'hsl(38,75%,48%)'   },
    { key: 'q4', label: 'Neither',                  sub: 'Drop',      color: 'var(--ink-4)'       },
  ]

  const insight = total === 0
    ? 'No completed tasks to map this week — task completions will appear here automatically going forward.'
    : q2pct >= 40
      ? `${q2pct}% of your energy went to Q2 — the strategic quadrant. That's Covey's gold standard.`
      : q2pct >= 20
        ? `${q2pct}% in Q2. You're building the habit — try protecting one dedicated Q2 block next week.`
        : `Only ${q2pct}% in Q2. Most energy went to urgent work. Next week, schedule one important-not-urgent task before it becomes a fire.`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Covey's quadrants</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          Where did your completed tasks actually land? Q2 — important but not yet urgent — is where goals live. Most people under-invest here.
        </p>
      </div>

      {/* 2×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {quads.map(q => {
          const count = quadCounts[q.key]
          const pct   = total > 0 ? count / total : 0

          return (
            <div key={q.key} style={{
              padding: '14px', borderRadius: 14,
              background: 'var(--paper-2)',
              border: q.highlight
                ? `2px solid ${q.color}`
                : '1px solid var(--rule)',
            }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                  color: q.color, marginBottom: 3,
                }}>
                  {q.sub.toUpperCase()}
                  {q.highlight && <span style={{ marginLeft: 4 }}>✦</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.3 }}>{q.label}</div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
                color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.02em',
              }}>
                {count}
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--paper-3)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: q.color,
                  width: `${Math.round(pct * 100)}%`,
                  minWidth: count > 0 ? 6 : 0,
                  transition: 'width .6s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

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

function NextWeekStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
          What's your single Q2 commitment for next week? The non-urgent thing that actually matters — the one you'll protect time for before it becomes a fire.
        </p>
      </div>

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

function DoneView({ review, onHistory }: { review: WeeklyReview; onHistory: () => void }) {
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
          <Icons.bolt size={12} /> +25 XP REFLECTION BONUS
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
            const opt = PULSE_OPTIONS.find(o => o.status === p.status)
            return (
              <div key={p.goalId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{opt?.emoji}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                  color: 'var(--ink-3)',
                }}>
                  {p.goalId}
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
        const total  = r.quadCounts.q1 + r.quadCounts.q2 + r.quadCounts.q3 + r.quadCounts.q4
        const q2pct  = total > 0 ? Math.round((r.quadCounts.q2 / total) * 100) : 0

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
                  {r.tasksCompleted} tasks · {r.xpGained} XP · {r.journalDays}d journal · Q2 {q2pct}%
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

interface Props { navigate: (s: Screen) => void; back: () => void }

export const WeeklyReviewScreen = ({ back }: Props) => {
  const week = useMemo(() => {
    const start = getMondayISO(new Date())
    return { start, end: getSundayISO(start) }
  }, [])

  const goals   = useLiveQuery(() => db.goals.toArray(),         [])
  const cats    = useLiveQuery(() => db.categories.toArray(),    []) ?? []
  const reviews = useLiveQuery(() => db.weeklyReviews.toArray(), [])

  const [stats,      setStats]     = useState<WeekStats | null>(null)
  const [view,       setView]      = useState<'wizard' | 'done' | 'history'>('wizard')
  const [step,       setStep]      = useState(0)
  const [review,     setReview]    = useState<WeeklyReview | null>(null)
  const [wins,       setWins]      = useState<[string, string, string]>(['', '', ''])
  const [pulse,      setPulse]     = useState<GoalPulse[]>([])
  const [nextThing,  setNextThing] = useState('')

  // Compute stats once on mount
  useEffect(() => {
    computeStats(week.start, week.end).then(setStats)
  }, [week.start, week.end])

  // Load or resume existing review for this week
  useEffect(() => {
    if (!reviews) return
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

  // ── Persistence helper ────────────────────────────────────────────────────
  async function saveReview(patch: Partial<WeeklyReview>): Promise<WeeklyReview> {
    const base: WeeklyReview = review ?? {
      id:             `wr-${week.start}`,
      weekStart:      week.start,
      weekEnd:        week.end,
      tasksCompleted: stats?.tasksCompleted ?? 0,
      xpGained:       stats?.xpGained       ?? 0,
      journalDays:    stats?.journalDays     ?? 0,
      quadCounts:     stats?.quadCounts      ?? { q1: 0, q2: 0, q3: 0, q4: 0 },
      wins:           ['', '', ''],
      goalPulse:      [],
      nextWeekThing:  '',
    }
    const updated: WeeklyReview = { ...base, ...patch, updatedAt: Date.now() }
    await db.weeklyReviews.put(updated)
    setReview(updated)
    return updated
  }

  // ── Step navigation ───────────────────────────────────────────────────────
  async function handleNext() {
    // Save on the first advance so the record exists for resuming later
    if (step === 0) {
      await saveReview({
        tasksCompleted: stats?.tasksCompleted ?? 0,
        xpGained:       stats?.xpGained       ?? 0,
        journalDays:    stats?.journalDays     ?? 0,
        quadCounts:     stats?.quadCounts      ?? { q1: 0, q2: 0, q3: 0, q4: 0 },
      })
    }
    if (step === 1) await saveReview({ wins })
    if (step === 2) await saveReview({ goalPulse: pulse })
    setStep(s => Math.min(s + 1, 4))
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
    // Award 25 XP reflection bonus
    const settings = await db.settings.get(1)
    if (settings) await db.settings.update(1, { xp: (settings.xp ?? 0) + 25 })
    await saveReview({ wins, goalPulse: pulse, nextWeekThing: nextThing, completedAt: Date.now() })
    setView('done')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="screen">
      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px 14px', borderBottom: '1px solid var(--rule)',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center' }}>
            <Icons.back size={20} />
          </button>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
              letterSpacing: '0.12em', marginBottom: 2,
            }}>
              WEEKLY REVIEW
            </div>
            <div className="t-display" style={{ fontSize: 16 }}>
              {displayRange(week.start, week.end)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />
          <button
            onClick={() => setView(v => v === 'history' ? (review?.completedAt ? 'done' : 'wizard') : 'history')}
            style={{
              padding: '6px 12px', borderRadius: 20,
              background: view === 'history' ? 'var(--ink)' : 'var(--paper-2)',
              color:      view === 'history' ? 'var(--paper)' : 'var(--ink-3)',
              border: '1px solid var(--rule)',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
            }}
          >
            {view === 'history' ? 'This week' : 'Archive'}
          </button>
        </div>
      </div>

      {/* ── History ── */}
      {view === 'history' && (
        <div className="screen-scroll" style={{ padding: '16px 20px' }}>
          <HistoryView reviews={reviews ?? []} />
        </div>
      )}

      {/* ── Done summary ── */}
      {view === 'done' && review && (
        <div className="screen-scroll" style={{ padding: '16px 20px' }}>
          <DoneView review={review} onHistory={() => setView('history')} />
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
              {step + 1} / 5 · {STEP_LABELS[step].toUpperCase()}
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
                {step === 0 && <StatsStep stats={stats} />}
                {step === 1 && (
                  <WinsStep
                    wins={wins}
                    onChange={(i, v) => setWins(prev => {
                      const n = [...prev] as [string, string, string]
                      n[i] = v
                      return n
                    })}
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
                {step === 3 && <QuadrantStep quadCounts={stats.quadCounts} />}
                {step === 4 && <NextWeekStep value={nextThing} onChange={setNextThing} />}
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

            {step < 4 ? (
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
