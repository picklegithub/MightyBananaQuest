import React, { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry } from '../data/db'
import { Icons } from '../components/ui/Icons'
import type { Screen, JournalEntry } from '../types'

// ── Quote pools ───────────────────────────────────────────────────────────────
const MORNING_QUOTES = [
  "Your morning sets the tone. Make it intentional.",
  "The first hour of the morning is the rudder of the day.",
  "Win the morning, win the day.",
  "What you focus on expands. Begin with gratitude.",
  "Each morning is a fresh start disguised as an ordinary day.",
  "Clarity in the morning creates calm throughout the day.",
  "The secret of getting ahead is getting started.",
  "Do the hard thing first. The rest of the day is a gift.",
]

const EVENING_QUOTES = [
  "Today is complete. What you did was enough.",
  "Reflection is the school of wisdom.",
  "Rest is not idleness. It is the work of restoration.",
  "End each day grateful for what went right.",
  "What didn't go to plan is tomorrow's teacher.",
  "Pauses are productive.",
  "A day well-lived is its own reward.",
  "Reviewing the day is the beginning of tomorrow.",
]

function todayQuote(pool: string[]): string {
  const dayIndex = Math.floor(Date.now() / 86400000)
  return pool[dayIndex % pool.length]
}

// ── Date helpers ──────────────────────────────────────────────────────────────
// All journal dates are stored as ISO 'YYYY-MM-DD' — locale strings are only
// used for display so that streak comparisons work correctly across locales
// and history sorts chronologically (ISO strings sort lexicographically).
function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoToDisplay(iso: string): string {
  // "2026-04-21" → "21 Apr 2026"  (display only, never stored)
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Journal streak ────────────────────────────────────────────────────────────
function computeJournalStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0
  // Normalise: accept both ISO ('2026-04-21') and legacy locale ('21 Apr') keys
  const dates = new Set(entries.map(e => {
    // If it looks like an ISO date keep it; otherwise leave it (legacy, won't match)
    return /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : e.date
  }))
  const d = new Date()
  const todayISO = d.toISOString().slice(0, 10)
  // If today has no entry yet, start counting from yesterday
  if (!dates.has(todayISO)) d.setDate(d.getDate() - 1)
  let streak = 0
  for (let i = 0; i < 366; i++) {
    const key = d.toISOString().slice(0, 10)
    if (!dates.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props { navigate: (s: Screen) => void; phase?: 'morning' | 'evening' | 'history' }

export const JournalScreen = ({ phase: initPhase }: Props) => {
  // Default tab is time-aware: before 1pm → morning, otherwise evening
  const hour = new Date().getHours()
  const [tab, setTab] = useState<'morning' | 'evening' | 'history'>(
    initPhase ?? (hour < 13 ? 'morning' : 'evening')
  )

  const entries = useLiveQuery(() => db.journal.toArray(), [])
  if (!entries) return null

  const today = isoToday()  // 'YYYY-MM-DD' — stored and compared as ISO
  const todayMorning = entries.find(e => e.date === today && e.kind === 'morning')
  const todayEvening = entries.find(e => e.date === today && e.kind === 'evening')
  const streak       = computeJournalStreak(entries)

  // Whether today's entries have any meaningful content
  const morningDone = !!(
    todayMorning?.intention ||
    (todayMorning?.gratitude?.filter(Boolean).length ?? 0) > 0
  )
  const eveningDone = !!(todayEvening?.win || todayEvening?.lesson)

  async function saveMorning(patch: Partial<JournalEntry>) {
    const id = todayMorning?.id ?? `j${Date.now()}`
    await saveJournalEntry({ id, date: today, kind: 'morning', ...todayMorning, ...patch })
  }

  async function saveEvening(patch: Partial<JournalEntry>) {
    const id = todayEvening?.id ?? `j${Date.now()}`
    await saveJournalEntry({ id, date: today, kind: 'evening', ...todayEvening, ...patch })
  }

  return (
    <div className="screen">
      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Daily Reflection</div>
            <h1 className="t-display" style={{ fontSize: 28 }}>Journal</h1>
          </div>
          {streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--warn)', paddingTop: 8,
            }}>
              <Icons.flame size={16} />
              <span style={{ fontWeight: 600 }}>{streak}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>day streak</span>
            </div>
          )}
        </div>

        {/* Today's completion status */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
            color: morningDone ? 'var(--accent)' : 'var(--ink-4)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {morningDone
              ? <><Icons.check size={10} sw={2.5} /> MORNING DONE</>
              : '☀️ MORNING PENDING'}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
            color: eveningDone ? 'var(--accent)' : 'var(--ink-4)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {eveningDone
              ? <><Icons.check size={10} sw={2.5} /> EVENING DONE</>
              : '🌙 EVENING PENDING'}
          </span>
        </div>
      </div>

      {/* ── Custom tab bar with completion dots ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        {([
          { v: 'morning' as const, label: '☀️ Morning', done: morningDone },
          { v: 'evening' as const, label: '🌙 Evening', done: eveningDone },
          { v: 'history' as const, label: '📖 History', done: false },
        ]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            style={{
              flex: 1, padding: '12px 6px', fontSize: 11,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              color: tab === t.v ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: tab === t.v ? '2px solid var(--ink)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'color .15s',
            }}
          >
            {t.label}
            {t.done && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)', flexShrink: 0,
              }} />
            )}
          </button>
        ))}
      </div>

      <div className="screen-scroll" style={{ padding: '20px 20px 44px' }}>
        {tab === 'morning' && (
          <MorningForm existing={todayMorning} onSave={saveMorning} />
        )}
        {tab === 'evening' && (
          <EveningForm existing={todayEvening} onSave={saveEvening} />
        )}
        {tab === 'history' && (
          <HistoryView entries={entries} />
        )}
      </div>
    </div>
  )
}

// ── Auto-save indicator ───────────────────────────────────────────────────────
function SavedIndicator({ saved }: { saved: boolean }) {
  return (
    <div style={{
      textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9,
      letterSpacing: '0.1em', color: 'var(--ink-4)',
      opacity: saved ? 1 : 0.35,
      transition: 'opacity .5s',
    }}>
      {saved ? '✓ AUTO-SAVED' : 'AUTO-SAVES AS YOU TYPE'}
    </div>
  )
}

// ── Shared text input style ───────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '11px 14px',
  background: 'var(--paper)',
  border: '1px solid var(--rule)',
  borderRadius: 10,
  fontSize: 14,
  lineHeight: '1.5',
  color: 'var(--ink)',
}

// ── Morning form ──────────────────────────────────────────────────────────────
function MorningForm({
  existing, onSave,
}: {
  existing?: JournalEntry
  onSave: (e: Partial<JournalEntry>) => Promise<void>
}) {
  const [g0, setG0] = useState(existing?.gratitude?.[0] ?? '')
  const [g1, setG1] = useState(existing?.gratitude?.[1] ?? '')
  const [g2, setG2] = useState(existing?.gratitude?.[2] ?? '')
  const [intention,  setIntention]  = useState(existing?.intention ?? '')
  const [p0, setP0] = useState(existing?.priorities?.[0] ?? '')
  const [p1, setP1] = useState(existing?.priorities?.[1] ?? '')
  const [p2, setP2] = useState(existing?.priorities?.[2] ?? '')
  const [saved, setSaved] = useState(false)
  const inited   = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  // Re-hydrate once when existing entry loads
  useEffect(() => {
    if (!existing || inited.current) return
    setG0(existing.gratitude?.[0] ?? '')
    setG1(existing.gratitude?.[1] ?? '')
    setG2(existing.gratitude?.[2] ?? '')
    setIntention(existing.intention ?? '')
    setP0(existing.priorities?.[0] ?? '')
    setP1(existing.priorities?.[1] ?? '')
    setP2(existing.priorities?.[2] ?? '')
    inited.current = true
  }, [existing?.id])

  // Auto-save: debounced 800ms after last change
  useEffect(() => {
    const gratitude  = [g0, g1, g2].filter(Boolean)
    const priorities = [p0, p1, p2].filter(Boolean)
    if (gratitude.length === 0 && !intention && priorities.length === 0) return
    const t = setTimeout(async () => {
      await onSaveRef.current({ gratitude, intention, priorities })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
    return () => clearTimeout(t)
  }, [g0, g1, g2, intention, p0, p1, p2])

  const GRATITUDE_PLACEHOLDERS = [
    'Something that made you smile…',
    'Someone you appreciate…',
    'Something easy to overlook…',
  ]
  const PRIORITY_PLACEHOLDERS = [
    'Most important task…',
    'Second priority…',
    'Third priority…',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Rotating quote */}
      <QuoteCard quote={todayQuote(MORNING_QUOTES)} />

      {/* Gratitude — 3 individual inputs */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>I'm grateful for</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { value: g0, set: setG0 },
            { value: g1, set: setG1 },
            { value: g2, set: setG2 },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
                width: 14, textAlign: 'right', flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <input
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={GRATITUDE_PLACEHOLDERS[i]}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Today's intention */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Today's intention</div>
        <input
          value={intention}
          onChange={e => setIntention(e.target.value)}
          placeholder="What matters most today?"
          style={{ ...inputStyle, width: '100%' }}
        />
      </section>

      {/* Top 3 priorities */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Top 3 priorities</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { value: p0, set: setP0 },
            { value: p1, set: setP1 },
            { value: p2, set: setP2 },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
                width: 14, textAlign: 'right', flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <input
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={PRIORITY_PLACEHOLDERS[i]}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </section>

      <SavedIndicator saved={saved} />
    </div>
  )
}

// ── Evening form ──────────────────────────────────────────────────────────────
function EveningForm({
  existing, onSave,
}: {
  existing?: JournalEntry
  onSave: (e: Partial<JournalEntry>) => Promise<void>
}) {
  const [win,      setWin]      = useState(existing?.win ?? '')
  const [diff,     setDiff]     = useState(existing?.diff ?? '')
  const [lesson,   setLesson]   = useState(existing?.lesson ?? '')
  const [tomorrow, setTomorrow] = useState(existing?.tomorrow ?? '')
  const [saved,    setSaved]    = useState(false)
  const inited    = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (!existing || inited.current) return
    setWin(existing.win ?? '')
    setDiff(existing.diff ?? '')
    setLesson(existing.lesson ?? '')
    setTomorrow(existing.tomorrow ?? '')
    inited.current = true
  }, [existing?.id])

  useEffect(() => {
    if (!win && !diff && !lesson && !tomorrow) return
    const t = setTimeout(async () => {
      await onSaveRef.current({ win, diff, lesson, tomorrow })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
    return () => clearTimeout(t)
  }, [win, diff, lesson, tomorrow])

  const FIELDS = [
    {
      key: 'win',      label: "Today's win",
      sub: 'Big or small — it counts.',
      value: win,      set: setWin,
      placeholder: 'Something that went well…',
    },
    {
      key: 'diff',     label: "What I'd do differently",
      sub: 'Learning, not criticism.',
      value: diff,     set: setDiff,
      placeholder: "One thing I'd change...",
    },
    {
      key: 'lesson',   label: 'Lesson learned',
      sub: 'Insight worth keeping.',
      value: lesson,   set: setLesson,
      placeholder: 'A thought from today…',
    },
    {
      key: 'tomorrow', label: "Tomorrow I'll start with...",
      sub: "Set tomorrow's momentum tonight.",
      value: tomorrow, set: setTomorrow,
      placeholder: 'One intention for the morning…',
    },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <QuoteCard quote={todayQuote(EVENING_QUOTES)} />

      {FIELDS.map(f => (
        <section key={f.key}>
          <div style={{ marginBottom: 8 }}>
            <div className="eyebrow">{f.label}</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
              letterSpacing: '0.06em', marginTop: 2,
            }}>
              {f.sub}
            </div>
          </div>
          <input
            value={f.value}
            onChange={e => f.set(e.target.value)}
            placeholder={f.placeholder}
            style={{ ...inputStyle, width: '100%' }}
          />
        </section>
      ))}

      <SavedIndicator saved={saved} />
    </div>
  )
}

// ── Quote card ────────────────────────────────────────────────────────────────
function QuoteCard({ quote }: { quote: string }) {
  return (
    <div style={{
      padding: '14px 18px',
      background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 12,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic',
        color: 'var(--ink-2)', lineHeight: 1.5,
      }}>
        "{quote}"
      </div>
    </div>
  )
}

// ── History view ──────────────────────────────────────────────────────────────
function HistoryView({ entries }: { entries: JournalEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Icons.journal size={36} style={{ color: 'var(--ink-4)', display: 'block', margin: '0 auto 16px' }} />
        <div className="t-display" style={{ fontSize: 20, marginBottom: 6 }}>Nothing yet</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>
          Your reflections will appear here<br />after your first entry.
        </div>
      </div>
    )
  }

  // Group by date (ISO key)
  const byDate = entries.reduce<Record<string, JournalEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e)
    return acc
  }, {})

  // ISO strings sort lexicographically = chronologically; reverse for most-recent-first
  const sortedDates = Object.keys(byDate).sort().reverse()

  function toggle(date: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sortedDates.map(date => {
        const morning = byDate[date].find(e => e.kind === 'morning')
        const evening = byDate[date].find(e => e.kind === 'evening')
        const isOpen  = expanded.has(date)

        return (
          <div key={date} style={{
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            {/* ── Collapsed header row ── */}
            <button
              onClick={() => toggle(date)}
              style={{
                width: '100%', padding: '13px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: isOpen ? '1px solid var(--rule)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="t-display" style={{ fontSize: 15 }}>
                  {/^\d{4}-\d{2}-\d{2}$/.test(date) ? isoToDisplay(date) : date}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {morning && (
                    <span style={{
                      padding: '2px 7px', borderRadius: 20,
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                      background: 'oklch(0.96 0.04 85)', color: 'oklch(0.52 0.12 75)',
                    }}>
                      ☀️ AM
                    </span>
                  )}
                  {evening && (
                    <span style={{
                      padding: '2px 7px', borderRadius: 20,
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                      background: 'oklch(0.95 0.02 270)', color: 'oklch(0.45 0.09 270)',
                    }}>
                      🌙 PM
                    </span>
                  )}
                </div>

                {/* Preview: intention or win */}
                {!isOpen && (
                  <span style={{
                    fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic',
                    maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {morning?.intention || evening?.win || ''}
                  </span>
                )}
              </div>
              <Icons.arrow size={14} style={{
                color: 'var(--ink-4)',
                transform: isOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform .2s',
              }} />
            </button>

            {/* ── Expanded content ── */}
            {isOpen && (
              <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Morning */}
                {morning && (
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                      color: 'oklch(0.52 0.12 75)', marginBottom: 10,
                    }}>
                      ☀️ MORNING
                    </div>

                    {morning.intention && (
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic',
                        color: 'var(--ink)', lineHeight: 1.5, marginBottom: 12,
                      }}>
                        "{morning.intention}"
                      </div>
                    )}

                    {(morning.gratitude?.filter(Boolean).length ?? 0) > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <HistoryLabel>Grateful for</HistoryLabel>
                        {morning.gratitude!.filter(Boolean).map((g, i) => (
                          <HistoryItem key={i} index={i + 1}>{g}</HistoryItem>
                        ))}
                      </div>
                    )}

                    {(morning.priorities?.filter(Boolean).length ?? 0) > 0 && (
                      <div>
                        <HistoryLabel>Priorities</HistoryLabel>
                        {morning.priorities!.filter(Boolean).map((p, i) => (
                          <HistoryItem key={i} index={i + 1}>{p}</HistoryItem>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Separator if both */}
                {morning && evening && (
                  <div style={{ height: 1, background: 'var(--rule)' }} />
                )}

                {/* Evening */}
                {evening && (
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                      color: 'oklch(0.45 0.09 270)', marginBottom: 10,
                    }}>
                      🌙 EVENING
                    </div>

                    {[
                      { label: 'Win',                 value: evening.win },
                      { label: "Would do differently", value: evening.diff },
                      { label: 'Lesson',              value: evening.lesson },
                      { label: 'Tomorrow',            value: evening.tomorrow },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} style={{ marginBottom: 10 }}>
                        <HistoryLabel>{f.label}</HistoryLabel>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                          {f.value}
                        </div>
                      </div>
                    ))}
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

// ── History sub-components ────────────────────────────────────────────────────
function HistoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
      letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5,
    }}>
      {children}
    </div>
  )
}

function HistoryItem({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, lineHeight: 1.5 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
        paddingTop: 2, flexShrink: 0,
      }}>
        {index}
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{children}</span>
    </div>
  )
}
