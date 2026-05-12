import React, { useState, useEffect, useRef } from 'react'
import { localDateISO } from '../lib/useCurrentDate'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry, deleteJournalEntry, getCopingCard, saveCopingCard } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen, JournalEntry, Task, CopingCard } from '../types'

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
function isoToday(): string { return localDateISO() }

function isoToDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Journal streak ────────────────────────────────────────────────────────────
function computeJournalStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0
  const dates = new Set(entries.map(e => e.date))
  const d = new Date()
  if (!dates.has(localDateISO(d))) d.setDate(d.getDate() - 1)
  let streak = 0
  for (let i = 0; i < 366; i++) {
    if (!dates.has(localDateISO(d))) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Input styles — underline, no box ─────────────────────────────────────────
const baseInput: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--rule)',
  outline: 'none',
  padding: '8px 0',
  lineHeight: 1.55,
  color: 'var(--ink)',
  transition: 'border-bottom-color .15s',
}

// Display/italic — gratitude, morning prompts
const displayInput: React.CSSProperties = {
  ...baseInput,
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic',
  fontSize: 15,
}

// Big display/italic — intention + all evening fields
const bigInput: React.CSSProperties = {
  ...displayInput,
  fontSize: 18,
}

// Mono — priorities
const monoInput: React.CSSProperties = {
  ...baseInput,
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  letterSpacing: '0.03em',
}

// ── Prompt section ────────────────────────────────────────────────────────────
function Prompt({
  num, label, help, children, last = false,
}: {
  num: string; label: string; help: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div style={{
      marginBottom: last ? 0 : 24,
      paddingBottom: last ? 0 : 20,
      borderBottom: last ? 'none' : '1px solid var(--rule)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--accent)', letterSpacing: '0.14em', flexShrink: 0,
        }}>
          {num}
        </span>
        <span className="t-display" style={{ fontSize: 18, lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--ink-3)', marginTop: 4,
        fontStyle: 'italic', fontFamily: 'var(--font-display)', marginLeft: 24,
      }}>
        {help}
      </div>
      <div style={{ marginTop: 12, marginLeft: 24 }}>
        {children}
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
      paddingTop: 8,
    }}>
      {saved ? '✓ AUTO-SAVED' : 'AUTO-SAVES AS YOU TYPE'}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props { navigate: (s: Screen) => void; back?: () => void; phase?: 'morning' | 'evening' | 'history' }

export const JournalScreen = ({ navigate, back, phase: initPhase }: Props) => {
  const hour = new Date().getHours()
  const [tab, setTab] = useState<'morning' | 'evening' | 'history'>(
    initPhase ?? (hour < 13 ? 'morning' : 'evening')
  )

  // Refresh at midnight so yesterday's entries don't bleed into today's forms
  const [today, setToday] = useState(isoToday)
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const id = setTimeout(() => setToday(isoToday()), midnight.getTime() - now.getTime())
    return () => clearTimeout(id)
  }, [today]) // re-schedules itself after each midnight tick

  const entries    = useLiveQuery(() => db.journal.toArray(), [])
  const settings   = useLiveQuery(() => db.settings.get('main'), [])
  const copingCard = useLiveQuery(() => getCopingCard(), [])
  const [showCopingEditor, setShowCopingEditor] = useState(false)
  if (!entries) return null

  const streak = computeJournalStreak(entries)

  const todayMorning = entries.find(e => e.date === today && e.kind === 'morning')
  const todayEvening = entries.find(e => e.date === today && e.kind === 'evening')

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
      {showCopingEditor && (
        <CopingCardEditor
          card={copingCard ?? null}
          onClose={() => setShowCopingEditor(false)}
        />
      )}
      <ScreenHeader
        title="Journal"
        back={back}
        rightActions={<>
          <ThemeToggle />
          <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
            <Icons.settings size={20} />
          </button>
        </>}
        footer={
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>MORNING + EVENING</span>
              <span>{(morningDone ? 1 : 0) + (eveningDone ? 1 : 0)}/2 done</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${((morningDone ? 1 : 0) + (eveningDone ? 1 : 0)) * 50}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        }
      />

      {/* ── Pill-style tab switcher ── */}
      <div style={{ flexShrink: 0, padding: '10px 16px 0' }}>
        <div style={{
          display: 'flex', background: 'var(--paper-2)',
          borderRadius: 10, padding: 3, gap: 2,
        }}>
          {([
            { v: 'morning' as const, Icon: Icons.sun,     label: 'Morning', done: morningDone },
            { v: 'evening' as const, Icon: Icons.moon,    label: 'Evening', done: eveningDone },
            { v: 'history' as const, Icon: Icons.journal, label: 'History', done: false },
          ]).map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8,
                fontSize: 12, fontWeight: tab === t.v ? 600 : 400,
                background: tab === t.v ? 'var(--paper)' : 'transparent',
                color: tab === t.v ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: tab === t.v ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all .15s',
              }}
            >
              <t.Icon size={13} />
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
      </div>

      <div className="screen-scroll" style={{ padding: '24px 22px 44px' }}>
        {/* ── Coping card pin ── */}
        {tab !== 'history' && (
          <CopingCardPin
            card={copingCard ?? null}
            onOpen={() => setShowCopingEditor(true)}
          />
        )}
        {/* ── Editorial intro ── */}
        {tab !== 'history' && (
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--rule)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {tab === 'morning' ? 'Journal · five minutes' : 'Journal · five minutes'}
            </div>
            <div className="t-display t-italic" style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 6 }}>
              {tab === 'morning' ? 'A quiet beginning.' : 'Today, reviewed.'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              {tab === 'morning'
                ? 'Two short rituals — morning sets direction, evening locks in learning.'
                : 'Reflection closes the loop. What happened, what mattered, what\'s next.'}
            </div>
          </div>
        )}

        {tab === 'morning' && (
          <MorningForm existing={todayMorning} onSave={saveMorning} />
        )}
        {tab === 'evening' && (
          <EveningForm existing={todayEvening} onSave={saveEvening} />
        )}
        {tab === 'history' && (
          <HistoryView entries={entries} />
        )}

        {/* ── Streak strip — always shown at the bottom ─────────────────── */}
        <JournalStreakStrip streak={streak} entries={entries} />
      </div>
    </div>
  )
}

// ── Streak strip ─────────────────────────────────────────────────────────────
// 14 vertical bars — filled = any journal entry that day; sub-label from the
// reference: "Both rituals, most days."
function JournalStreakStrip({ streak, entries }: { streak: number; entries: JournalEntry[] }) {
  const now = new Date()
  const entryDates = new Set(entries.map(e => e.date))

  // Last 14 days: index 0 = oldest, 13 = today
  const bars = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (13 - i))
    return entryDates.has(localDateISO(d))
  })

  return (
    <div style={{
      marginTop: 28,
      padding: 14, borderRadius: 12,
      background: 'var(--paper-2)', border: '1px solid var(--rule)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <Icons.flame size={18} stroke="var(--accent)" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
          {streak > 0 ? `${streak}-day journal streak` : 'Start your streak today'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          Both rituals, most days.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {bars.map((filled, i) => (
          <div key={i} style={{
            width: 5, height: 18, borderRadius: 1,
            background: filled ? 'var(--accent)' : 'var(--paper-3)',
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Rating constants ──────────────────────────────────────────────────────────
const ENERGY_OPTIONS = [
  { v: 1 as const, emoji: '😴', lbl: 'Low'    },
  { v: 2 as const, emoji: '😐', lbl: 'Okay'   },
  { v: 3 as const, emoji: '⚡', lbl: 'Strong' },
]
const IMPACT_OPTIONS = [
  { v: 1 as const, emoji: '💤', lbl: 'Minimal' },
  { v: 2 as const, emoji: '🔹', lbl: 'Some'    },
  { v: 3 as const, emoji: '🔷', lbl: 'Solid'   },
  { v: 4 as const, emoji: '🌟', lbl: 'High'    },
]

// ── RatingRow — emoji pill selector ──────────────────────────────────────────
function RatingRow<T extends number>({
  label, help, options, value, onChange,
}: {
  label: string
  help: string
  options: { v: T; emoji: string; lbl: string }[]
  value: T | undefined
  onChange: (v: T) => void
}) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--ink-4)', letterSpacing: '0.09em',
        textTransform: 'uppercase', marginBottom: 4,
      }}>
        {label}
        <span style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          textTransform: 'none', letterSpacing: 0,
          color: 'var(--ink-3)', marginLeft: 6,
        }}>
          — {help}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(o => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 9,
              border: `1.5px solid ${value === o.v ? 'var(--accent)' : 'var(--rule)'}`,
              background: value === o.v ? 'var(--accent-soft)' : 'var(--paper-2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{o.emoji}</span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              color: value === o.v ? 'var(--accent)' : 'var(--ink-4)',
            }}>
              {o.lbl}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── PrioritySlot — free text OR task picker ───────────────────────────────────
function PrioritySlot({
  slotIndex, text, onTextChange, taskId, onTaskSelect, onTaskClear, allTasks,
}: {
  slotIndex: number
  text: string
  onTextChange: (v: string) => void
  taskId: string | null
  onTaskSelect: (id: string, title: string) => void
  onTaskClear: () => void
  allTasks: Task[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const linked = taskId ? allTasks.find(t => t.id === taskId) ?? null : null

  const filtered = allTasks
    .filter(t => !t.done && !t.deletedAt &&
      (query === '' || t.title.toLowerCase().includes(query.toLowerCase())))
    .slice(0, 14)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, position: 'relative' }}>
      {/* Slot number */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--ink-3)', paddingTop: 10, flexShrink: 0, width: 14,
      }}>
        {slotIndex + 1}.
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {linked ? (
          /* ── Linked task chip ── */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', borderBottom: '1px solid var(--rule)',
          }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>⭐</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--ink)', flex: 1, letterSpacing: '0.03em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {linked.title}
            </span>
            <button
              onClick={onTaskClear}
              style={{ color: 'var(--ink-4)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}
              title="Unlink task"
            >
              ✕
            </button>
          </div>
        ) : (
          /* ── Free text input + star button ── */
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <input
              value={text}
              onChange={e => onTextChange(e.target.value)}
              className="journal-input"
              style={{ ...monoInput, flex: 1 }}
            />
            <button
              onClick={() => { setOpen(v => !v); setQuery('') }}
              title={open ? 'Close picker' : 'Pin a task'}
              style={{
                padding: '8px 5px',
                color: open ? 'var(--accent)' : 'var(--ink-4)',
                fontSize: 13, flexShrink: 0,
                transition: 'color .15s',
              }}
            >
              ⭐
            </button>
          </div>
        )}

        {/* ── Inline task picker dropdown ── */}
        {open && !linked && (
          <div style={{
            position: 'absolute', top: '100%', left: 14, right: 0, zIndex: 100,
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            {/* Search */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule)' }}>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search tasks…"
                style={{
                  width: '100%', background: 'transparent',
                  border: 'none', outline: 'none',
                  fontSize: 12, color: 'var(--ink)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
            {/* Results */}
            <div style={{ maxHeight: 186, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '14px', fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>
                  No tasks found
                </div>
              ) : filtered.map(t => (
                <button
                  key={t.id}
                  onMouseDown={e => e.preventDefault()} // keep focus on search input until click
                  onClick={() => { onTaskSelect(t.id, t.title); setOpen(false); setQuery('') }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--rule)',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: 'var(--ink)',
                  }}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Morning form ──────────────────────────────────────────────────────────────
function MorningForm({
  existing, onSave,
}: {
  existing?: JournalEntry
  onSave: (e: Partial<JournalEntry>) => Promise<void>
}) {
  const [morningMood, setMorningMood] = useState<'steady' | 'tired' | 'charged' | undefined>(existing?.morningMood)
  const [g0, setG0] = useState(existing?.gratitude?.[0] ?? '')
  const [g1, setG1] = useState(existing?.gratitude?.[1] ?? '')
  const [g2, setG2] = useState(existing?.gratitude?.[2] ?? '')
  const [intention, setIntention] = useState(existing?.intention ?? '')
  const [p0, setP0] = useState(existing?.priorities?.[0] ?? '')
  const [p1, setP1] = useState(existing?.priorities?.[1] ?? '')
  const [p2, setP2] = useState(existing?.priorities?.[2] ?? '')
  const [notes,     setNotes]     = useState(existing?.notes ?? '')
  // Priority task IDs — parallel to p0/p1/p2; null = free-text slot
  const [ptId0, setPtId0] = useState<string | null>(existing?.priorityTaskIds?.[0] ?? null)
  const [ptId1, setPtId1] = useState<string | null>(existing?.priorityTaskIds?.[1] ?? null)
  const [ptId2, setPtId2] = useState<string | null>(existing?.priorityTaskIds?.[2] ?? null)
  const [saved, setSaved] = useState(false)
  const inited    = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  // All non-done tasks for the picker dropdown
  const allTasks = useLiveQuery(
    () => db.tasks.filter(t => !t.done && !t.deletedAt).toArray(),
    []
  ) ?? []

  useEffect(() => {
    if (!existing || inited.current) return
    setMorningMood(existing.morningMood)
    setG0(existing.gratitude?.[0] ?? '')
    setG1(existing.gratitude?.[1] ?? '')
    setG2(existing.gratitude?.[2] ?? '')
    setIntention(existing.intention ?? '')
    setP0(existing.priorities?.[0] ?? '')
    setP1(existing.priorities?.[1] ?? '')
    setP2(existing.priorities?.[2] ?? '')
    setNotes(existing.notes ?? '')
    setPtId0(existing.priorityTaskIds?.[0] ?? null)
    setPtId1(existing.priorityTaskIds?.[1] ?? null)
    setPtId2(existing.priorityTaskIds?.[2] ?? null)
    inited.current = true
  }, [existing?.id])

  useEffect(() => {
    const gratitude       = [g0, g1, g2].filter(Boolean)
    const priorities      = [p0, p1, p2]
    const priorityTaskIds = [ptId0, ptId1, ptId2]
    const hasAny = gratitude.length > 0 || !!intention ||
      priorities.some(Boolean) || !!notes || priorityTaskIds.some(Boolean) || !!morningMood
    if (!hasAny) return
    const t = setTimeout(async () => {
      await onSaveRef.current({
        morningMood,
        gratitude,
        intention,
        priorities: priorities.filter(Boolean),
        priorityTaskIds: priorityTaskIds.some(Boolean) ? priorityTaskIds : undefined,
        notes: notes || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
    return () => clearTimeout(t)
  }, [morningMood, g0, g1, g2, intention, p0, p1, p2, notes, ptId0, ptId1, ptId2])

  const ptSlots = [
    { text: p0, setText: setP0, taskId: ptId0, setTaskId: setPtId0 },
    { text: p1, setText: setP1, taskId: ptId1, setTaskId: setPtId1 },
    { text: p2, setText: setP2, taskId: ptId2, setTaskId: setPtId2 },
  ]

  const MOOD_OPTIONS = [
    { id: 'steady',  label: 'Steady',  emoji: '🌱' },
    { id: 'tired',   label: 'Tired',   emoji: '😴' },
    { id: 'charged', label: 'Charged', emoji: '⚡' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Mood tap */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>
          HOW ARE YOU TODAY?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MOOD_OPTIONS.map(m => (
            <button
              key={m.id}
              onClick={() => setMorningMood(morningMood === m.id ? undefined : m.id)}
              style={{
                flex: 1, padding: '12px 6px', borderRadius: 10,
                background: morningMood === m.id ? 'var(--ink)' : 'var(--paper-2)',
                border: `1px solid ${morningMood === m.id ? 'var(--ink)' : 'var(--rule)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 18 }}>{m.emoji}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                color: morningMood === m.id ? 'var(--paper)' : 'var(--ink-3)',
              }}>
                {m.label.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>

      <QuoteCard quote={todayQuote(MORNING_QUOTES)} />

      <div style={{ marginTop: 28 }}>
        {/* 01 Gratitude */}
        <Prompt num="01" label="Three things I'm grateful for"
          help="Small or large. Specific lands deeper.">
          {[
            { value: g0, set: setG0 },
            { value: g1, set: setG1 },
            { value: g2, set: setG2 },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--ink-3)', paddingTop: 10, flexShrink: 0, width: 14,
              }}>
                {i + 1}.
              </span>
              <input
                value={f.value}
                onChange={e => f.set(e.target.value)}
                className="journal-input"
                style={{ ...displayInput }}
              />
            </div>
          ))}
        </Prompt>

        {/* 02 Intention */}
        <Prompt num="02" label="Today's intention"
          help="One sentence. How will I show up?">
          <input
            value={intention}
            onChange={e => setIntention(e.target.value)}
            className="journal-input"
            style={{ ...bigInput }}
          />
        </Prompt>

        {/* 03 Three priorities — task picker or free text */}
        <Prompt num="03" label="The three priorities"
          help="If only these three, the day was good. Tap ⭐ to pin a task.">
          {ptSlots.map((s, i) => (
            <PrioritySlot
              key={i}
              slotIndex={i}
              text={s.text}
              onTextChange={s.setText}
              taskId={s.taskId}
              onTaskSelect={(id, title) => { s.setTaskId(id); s.setText(title) }}
              onTaskClear={() => { s.setTaskId(null); s.setText('') }}
              allTasks={allTasks}
            />
          ))}
        </Prompt>

        {/* 04 Notes */}
        <Prompt num="04" label="Notes" help="Anything else on your mind." last>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="journal-input"
            style={{ ...displayInput, minHeight: 72, resize: 'none', lineHeight: 1.6 }}
          />
        </Prompt>
      </div>

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
  const [win,          setWin]          = useState(existing?.win ?? '')
  const [diff,         setDiff]         = useState(existing?.diff ?? '')
  const [diffFollowOn, setDiffFollowOn] = useState(existing?.diffFollowOn ?? '')
  const [reframe,      setReframe]      = useState(existing?.reframe ?? '')
  const [reframeOpen,  setReframeOpen]  = useState(!!existing?.reframe)
  const [lesson,       setLesson]       = useState(existing?.lesson ?? '')
  const [tomorrow,     setTomorrow]     = useState(existing?.tomorrow ?? '')
  const [notes,        setNotes]        = useState(existing?.notes ?? '')
  const [energy,       setEnergy]       = useState<1 | 2 | 3 | undefined>(existing?.energy)
  const [impact,       setImpact]       = useState<1 | 2 | 3 | 4 | undefined>(existing?.impact)
  const [saved,        setSaved]        = useState(false)
  const inited    = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (!existing || inited.current) return
    setWin(existing.win ?? '')
    setDiff(existing.diff ?? '')
    setDiffFollowOn(existing.diffFollowOn ?? '')
    setReframe(existing.reframe ?? '')
    setReframeOpen(!!existing.reframe)
    setLesson(existing.lesson ?? '')
    setTomorrow(existing.tomorrow ?? '')
    setNotes(existing.notes ?? '')
    setEnergy(existing.energy)
    setImpact(existing.impact)
    inited.current = true
  }, [existing?.id])

  useEffect(() => {
    if (!win && !diff && !diffFollowOn && !reframe && !lesson && !tomorrow && !notes && !energy && !impact) return
    const t = setTimeout(async () => {
      await onSaveRef.current({
        win, diff,
        diffFollowOn: diffFollowOn || undefined,
        reframe: reframe || undefined,
        lesson, tomorrow,
        notes: notes || undefined,
        energy, impact,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
    return () => clearTimeout(t)
  }, [win, diff, diffFollowOn, reframe, lesson, tomorrow, notes, energy, impact])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <QuoteCard quote={todayQuote(EVENING_QUOTES)} />

      <div style={{ marginTop: 28 }}>
        {/* 01 — Today's win */}
        <Prompt num="01" label="Today's win" help="The one moment to celebrate, however small.">
          <input
            value={win}
            onChange={e => setWin(e.target.value)}
            className="journal-input"
            style={{ ...bigInput }}
          />
        </Prompt>

        {/* 02 — What got in the way? (renamed from "What I'd do differently") */}
        <Prompt num="02" label="What got in the way?" help="Without judgement. Just notice.">
          <input
            value={diff}
            onChange={e => setDiff(e.target.value)}
            className="journal-input"
            style={{ ...bigInput }}
          />
        </Prompt>

        {/* 02a — One thing I'd do differently (conditional on diff having content) */}
        {diff.trim() && (
          <div style={{ marginTop: -8, marginBottom: 20, paddingLeft: 32 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 12,
              color: 'var(--ink-3)', marginBottom: 6,
            }}>
              One thing I'd do differently.
            </div>
            <input
              value={diffFollowOn}
              onChange={e => setDiffFollowOn(e.target.value)}
              className="journal-input"
              style={{ ...bigInput }}
            />

            {/* + Reframe accordion */}
            <button
              onClick={() => setReframeOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                marginTop: 10, background: 'none', border: 'none',
                padding: 0, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 12,
                color: 'var(--ink-3)',
              }}
            >
              <span style={{
                fontSize: 14, lineHeight: 1,
                transform: reframeOpen ? 'rotate(45deg)' : 'none',
                transition: 'transform 0.15s',
                display: 'inline-block',
              }}>+</span>
              Reframe
            </button>
            {reframeOpen && (
              <div style={{ marginTop: 8 }}>
                <input
                  value={reframe}
                  onChange={e => setReframe(e.target.value)}
                  placeholder="One thing I'm thinking differently about after today…"
                  className="journal-input"
                  style={{ ...bigInput }}
                />
              </div>
            )}
          </div>
        )}

        {/* 03 — Key lesson learnt */}
        <Prompt num="03" label="Key lesson learnt" help="One thread to carry forward.">
          <input
            value={lesson}
            onChange={e => setLesson(e.target.value)}
            className="journal-input"
            style={{ ...bigInput }}
          />
        </Prompt>

        {/* 04 — What I'm excited about tomorrow */}
        <Prompt num="04" label="What I'm excited about tomorrow" help="Anticipation primes the morning.">
          <input
            value={tomorrow}
            onChange={e => setTomorrow(e.target.value)}
            className="journal-input"
            style={{ ...bigInput }}
          />
        </Prompt>

        {/* ── Rate today ── */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 14,
          }}>
            RATE TODAY
          </div>
          <RatingRow
            label="Energy"
            help="How did you feel today?"
            options={ENERGY_OPTIONS}
            value={energy}
            onChange={v => setEnergy(v)}
          />
          <div style={{ height: 12 }} />
          <RatingRow
            label="Impact"
            help="How much did today's work matter?"
            options={IMPACT_OPTIONS}
            value={impact}
            onChange={v => setImpact(v)}
          />
        </div>

        {/* ── Notes ── */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10,
          }}>
            NOTES
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="journal-input"
            style={{ ...displayInput, minHeight: 72, resize: 'none', lineHeight: 1.6 }}
          />
        </div>
      </div>

      <SavedIndicator saved={saved} />
    </div>
  )
}

// ── Coping card ───────────────────────────────────────────────────────────────
function CopingCardEditor({ card, onClose }: { card: CopingCard | null; onClose: () => void }) {
  const [text, setText] = useState(card?.content ?? '')

  async function handleSave() {
    if (text.trim()) await saveCopingCard(text.trim())
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'var(--paper)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flexShrink: 0, padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--rule)',
      }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Coping Card</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>When I'm struggling</div>
        </div>
        <button
          onClick={handleSave}
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}
        >
          Save
        </button>
      </div>

      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.6 }}>
          When I'm struggling, it helps me to…
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write something kind and true to your future self."
          style={{
            flex: 1, resize: 'none', fontSize: 15, lineHeight: 1.7,
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            color: 'var(--ink)', background: 'var(--paper-2)',
            border: '1px solid var(--rule)', borderRadius: 12,
            padding: '16px', outline: 'none',
          }}
        />
      </div>
    </div>
  )
}

function CopingCardPin({ card, onOpen }: { card: CopingCard | null; onOpen: () => void }) {
  const preview = card?.content
    ? card.content.split('\n')[0].slice(0, 60) + (card.content.length > 60 ? '…' : '')
    : null

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left',
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>🫂</span>
      <span style={{
        fontSize: 13,
        color: preview ? 'var(--ink-2)' : 'var(--ink-3)',
        fontFamily: preview ? 'var(--font-display)' : 'var(--font-sans)',
        fontStyle: preview ? 'italic' : 'normal',
        lineHeight: 1.5, flex: 1,
      }}>
        {preview ?? 'Add your personal coping note →'}
      </span>
    </button>
  )
}

// ── Quote card ────────────────────────────────────────────────────────────────
function QuoteCard({ quote }: { quote: string }) {
  return (
    <div style={{
      padding: '16px 0',
      borderBottom: '1px solid var(--rule)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic',
        color: 'var(--ink-2)', lineHeight: 1.5,
      }}>
        "{quote}"
      </div>
    </div>
  )
}

// ── History view ──────────────────────────────────────────────────────────────
function HistoryView({ entries }: { entries: JournalEntry[] }) {
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function handleDelete(entryId: string) {
    if (confirmDelete === entryId) {
      await deleteJournalEntry(entryId)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(entryId)
      setTimeout(() => setConfirmDelete(c => c === entryId ? null : c), 3000)
    }
  }

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

  const byDate = entries.reduce<Record<string, JournalEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e)
    return acc
  }, {})

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
            <button
              onClick={() => toggle(date)}
              style={{
                width: '100%', padding: '13px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: isOpen ? '1px solid var(--rule)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span className="t-display" style={{ fontSize: 15, flexShrink: 0 }}>
                  {/^\d{4}-\d{2}-\d{2}$/.test(date) ? isoToDisplay(date) : date}
                </span>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
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
                {!isOpen && (morning?.intention || evening?.win) && (
                  <span style={{
                    fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic',
                    fontFamily: 'var(--font-display)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}>
                    {morning?.intention || evening?.win}
                  </span>
                )}
              </div>
              <Icons.arrow size={14} style={{
                color: 'var(--ink-4)', flexShrink: 0,
                transform: isOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform .2s',
              }} />
            </button>

            {isOpen && (
              <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                {morning && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'oklch(0.52 0.12 75)' }}>
                        ☀️ MORNING
                      </div>
                      <button
                        onClick={() => handleDelete(morning.id)}
                        style={{
                          padding: '3px 8px', borderRadius: 8, fontSize: 11,
                          border: `1px solid ${confirmDelete === morning.id ? 'var(--danger, #e53)' : 'var(--rule)'}`,
                          background: confirmDelete === morning.id ? 'oklch(0.97 0.03 25)' : 'transparent',
                          color: confirmDelete === morning.id ? 'var(--danger, #e53)' : 'var(--ink-4)',
                          fontFamily: 'var(--font-mono)',
                          transition: 'all .15s',
                        }}
                      >
                        {confirmDelete === morning.id ? 'Tap again to delete' : '⌫'}
                      </button>
                    </div>

                    {morning.intention && (
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic',
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
                          <HistoryItem key={i} index={i + 1} mono>{p}</HistoryItem>
                        ))}
                      </div>
                    )}

                    {morning.notes && (
                      <div style={{ marginTop: 10 }}>
                        <HistoryLabel>Notes</HistoryLabel>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {morning.notes}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {morning && evening && (
                  <div style={{ height: 1, background: 'var(--rule)' }} />
                )}

                {evening && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'oklch(0.45 0.09 270)' }}>
                        🌙 EVENING
                      </div>
                      <button
                        onClick={() => handleDelete(evening.id)}
                        style={{
                          padding: '3px 8px', borderRadius: 8, fontSize: 11,
                          border: `1px solid ${confirmDelete === evening.id ? 'var(--danger, #e53)' : 'var(--rule)'}`,
                          background: confirmDelete === evening.id ? 'oklch(0.97 0.03 25)' : 'transparent',
                          color: confirmDelete === evening.id ? 'var(--danger, #e53)' : 'var(--ink-4)',
                          fontFamily: 'var(--font-mono)',
                          transition: 'all .15s',
                        }}
                      >
                        {confirmDelete === evening.id ? 'Tap again to delete' : '⌫'}
                      </button>
                    </div>

                    {/* Energy + impact pills in history */}
                    {(evening.energy || evening.impact) && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        {evening.energy && (
                          <span style={{
                            padding: '3px 9px', borderRadius: 20,
                            background: 'var(--paper-3)',
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            color: 'var(--ink-3)', letterSpacing: '0.04em',
                          }}>
                            {['', '😴 Low', '😐 Okay', '⚡ Strong'][evening.energy]} energy
                          </span>
                        )}
                        {evening.impact && (
                          <span style={{
                            padding: '3px 9px', borderRadius: 20,
                            background: 'var(--paper-3)',
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            color: 'var(--ink-3)', letterSpacing: '0.04em',
                          }}>
                            {['', '💤 Minimal', '🔹 Some', '🔷 Solid', '🌟 High'][evening.impact]} impact
                          </span>
                        )}
                      </div>
                    )}
                    {[
                      { label: 'Win',                  value: evening.win },
                      { label: 'Would do differently', value: evening.diff },
                      { label: 'Lesson',               value: evening.lesson },
                      { label: 'Tomorrow',             value: evening.tomorrow },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} style={{ marginBottom: 10 }}>
                        <HistoryLabel>{f.label}</HistoryLabel>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontStyle: 'italic',
                          fontSize: 14, color: 'var(--ink)', lineHeight: 1.55,
                        }}>
                          {f.value}
                        </div>
                      </div>
                    ))}

                    {evening.notes && (
                      <div style={{ marginTop: 2 }}>
                        <HistoryLabel>Notes</HistoryLabel>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {evening.notes}
                        </div>
                      </div>
                    )}
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

function HistoryItem({ children, index, mono }: { children: React.ReactNode; index: number; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, lineHeight: 1.5 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
        paddingTop: 2, flexShrink: 0,
      }}>
        {index}
      </span>
      <span style={{
        fontSize: 13, color: 'var(--ink-2)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontStyle: mono ? 'normal' : 'italic',
      }}>
        {children}
      </span>
    </div>
  )
}
