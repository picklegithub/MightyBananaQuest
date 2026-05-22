/**
 * Shared constants, styles, and presentational components
 * used across Journal sub-components.
 */
import React, { useState, useRef, useEffect } from 'react'
import { localDateISO } from '../../lib/useCurrentDate'
import type { JournalEntry, Task, CopingCategory } from '../../types'

// ── Quote pools ───────────────────────────────────────────────────────────────
export const MORNING_QUOTES = [
  "Your morning sets the tone. Make it intentional.",
  "The first hour of the morning is the rudder of the day.",
  "Win the morning, win the day.",
  "What you focus on expands. Begin with gratitude.",
  "Each morning is a fresh start disguised as an ordinary day.",
  "Clarity in the morning creates calm throughout the day.",
  "The secret of getting ahead is getting started.",
  "Do the hard thing first. The rest of the day is a gift.",
]

export const EVENING_QUOTES = [
  "Today is complete. What you did was enough.",
  "Reflection is the school of wisdom.",
  "Rest is not idleness. It is the work of restoration.",
  "End each day grateful for what went right.",
  "What didn't go to plan is tomorrow's teacher.",
  "Pauses are productive.",
  "A day well-lived is its own reward.",
  "Reviewing the day is the beginning of tomorrow.",
]

export const GROW_QUOTES = [
  "Growth is not about being perfect. It's about showing up.",
  "You are the author of your own story.",
  "Small acts of courage compound into character.",
  "What you water grows. Water what matters.",
  "Values are not what you say — they're what you do when it's hard.",
  "Self-compassion is the foundation of resilience.",
  "Progress, not perfection.",
  "Your habits are votes for who you're becoming.",
  "The quality of your life is the quality of your attention.",
  "Kindness to yourself is not weakness. It's wisdom.",
]

// ── Coping category maps ──────────────────────────────────────────────────────
export const CAT_HUE: Record<CopingCategory, number> = {
  'anxiety': 275, 'social': 28, 'low-mood': 220, 'grounding': 145,
  'mindfulness': 192, 'self-compassion': 340, 'values': 45, 'crisis': 5,
}

export const CAT_LABEL: Record<CopingCategory, string> = {
  'anxiety': 'Anxiety', 'social': 'Social', 'low-mood': 'Low Mood', 'grounding': 'Grounding',
  'mindfulness': 'Mindfulness', 'self-compassion': 'Self-Compassion', 'values': 'Values', 'crisis': 'Crisis',
}

export const CAT_EMOJI: Record<CopingCategory, string> = {
  'anxiety': '🌬️', 'social': '🤝', 'low-mood': '🌱', 'grounding': '⚓',
  'mindfulness': '🧘', 'self-compassion': '🫂', 'values': '⭐', 'crisis': '🆘',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function todayQuote(pool: string[]): string {
  const dayIndex = Math.floor(Date.now() / 86400000)
  return pool[dayIndex % pool.length]
}

export function isoToDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function computeJournalStreak(entries: JournalEntry[]): number {
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
export const baseInput: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--rule)', outline: 'none',
  padding: '8px 0', lineHeight: 1.55, color: 'var(--ink)',
  transition: 'border-bottom-color .15s',
}

export const displayInput: React.CSSProperties = {
  ...baseInput, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15,
}

export const bigInput: React.CSSProperties = { ...displayInput, fontSize: 18 }

export const monoInput: React.CSSProperties = {
  ...baseInput, fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.03em',
}

// ── Mood constants — shared with MoodTrackingScreen ───────────────────────────
export const MOOD_COLORS: Record<string, string> = {
  charged: 'var(--accent)',
  steady:  'var(--ink-2)',
  tired:   'var(--warn)',
}
export const MOOD_EMOJI: Record<string, string> = {
  charged: '⚡',
  steady:  '✦',
  tired:   '○',
}
export const MOOD_LABELS: Record<string, string> = {
  charged: 'Charged',
  steady:  'Steady',
  tired:   'Tired',
}
export const MOOD_ORDER = ['charged', 'steady', 'tired'] as const
export type MoodValue = 'charged' | 'steady' | 'tired'

// ── Rating options — aligned with EnergyScoreScreen ──────────────────────────
export const ENERGY_OPTIONS = [
  { v: 1 as const, emoji: '○', lbl: 'Low',    color: 'var(--warn)'    },
  { v: 2 as const, emoji: '◑', lbl: 'Okay',   color: 'var(--ink-2)'  },
  { v: 3 as const, emoji: '●', lbl: 'Strong',  color: 'var(--accent)' },
]

export const IMPACT_OPTIONS = [
  { v: 1 as const, emoji: '○', lbl: 'Minimal', color: 'var(--ink-4)'  },
  { v: 2 as const, emoji: '◔', lbl: 'Some',    color: 'var(--ink-3)'  },
  { v: 3 as const, emoji: '◑', lbl: 'Solid',   color: 'var(--ink-2)'  },
  { v: 4 as const, emoji: '●', lbl: 'High',    color: 'var(--accent)' },
]

// ── Prompt section ────────────────────────────────────────────────────────────
export function Prompt({
  num, label, help, children, last = false,
}: {
  num: string; label: string; help: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 24, paddingBottom: last ? 0 : 20, borderBottom: last ? 'none' : '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.14em', flexShrink: 0 }}>
          {num}
        </span>
        <span className="t-display" style={{ fontSize: 18, lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontStyle: 'italic', fontFamily: 'var(--font-display)', marginLeft: 24 }}>
        {help}
      </div>
      <div style={{ marginTop: 12, marginLeft: 24 }}>{children}</div>
    </div>
  )
}

// ── Auto-save indicator ───────────────────────────────────────────────────────
export function SavedIndicator({ saved }: { saved: boolean }) {
  return (
    <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-4)', opacity: saved ? 1 : 0.35, transition: 'opacity .5s', paddingTop: 8 }}>
      {saved ? '✓ AUTO-SAVED' : 'AUTO-SAVES AS YOU TYPE'}
    </div>
  )
}

// ── Quote card ────────────────────────────────────────────────────────────────
export function QuoteCard({ quote }: { quote: string }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink-2)', lineHeight: 1.5 }}>
        "{quote}"
      </div>
    </div>
  )
}

// ── Rating row ────────────────────────────────────────────────────────────────
export function RatingRow<T extends number>({
  label, help, options, value, onChange,
}: {
  label: string; help: string
  options: { v: T; emoji: string; lbl: string; color?: string }[]
  value: T | undefined; onChange: (v: T) => void
}) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, color: 'var(--ink-3)', marginLeft: 6 }}>— {help}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(o => {
          const clr = o.color ?? 'var(--accent)'
          const sel = value === o.v
          return (
            <button key={o.v} onClick={() => onChange(o.v)} style={{
              flex: 1, padding: '10px 4px', borderRadius: 10,
              border: `1.5px solid ${sel ? clr : 'var(--rule)'}`,
              background: sel ? 'var(--paper-3)' : 'var(--paper-2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all .15s',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: sel ? clr : 'var(--paper-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1,
                color: sel ? 'var(--paper)' : clr,
                transition: 'all .15s',
              }}>
                {o.emoji}
              </div>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: sel ? clr : 'var(--ink-4)', transition: 'color .15s' }}>
                {o.lbl.toUpperCase()}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── MoodPicker — shared across MorningForm and DailyPlanRitual ────────────────
export function MoodPicker({
  value, onChange, size = 'normal',
}: {
  value: MoodValue | null | undefined
  onChange: (m: MoodValue | undefined) => void
  /** 'normal' = journal inline; 'large' = DailyPlan full-screen card */
  size?: 'normal' | 'large'
}) {
  const pad  = size === 'large' ? '20px 8px' : '12px 8px'
  const ring = size === 'large' ? 44 : 34
  const emojiSize = size === 'large' ? 20 : 15
  const lblSize = size === 'large' ? 11 : 9

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {MOOD_ORDER.map(id => {
        const sel = value === id
        const clr = MOOD_COLORS[id]
        return (
          <button
            key={id}
            onClick={() => onChange(sel ? undefined : id)}
            style={{
              flex: 1, padding: pad, borderRadius: 12,
              background: sel ? 'var(--paper-3)' : 'var(--paper-2)',
              border: `1.5px solid ${sel ? clr : 'var(--rule)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              transition: 'border-color .15s, background .15s',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: ring, height: ring, borderRadius: '50%',
              background: sel ? clr : 'var(--paper-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: emojiSize, lineHeight: 1,
              color: sel ? 'var(--paper)' : clr,
              transition: 'all .15s',
            }}>
              {MOOD_EMOJI[id]}
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: lblSize, letterSpacing: '0.08em',
              color: sel ? clr : 'var(--ink-4)', transition: 'color .15s',
            }}>
              {MOOD_LABELS[id].toUpperCase()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Priority slot — free text OR task picker ──────────────────────────────────
export function PrioritySlot({
  slotIndex, text, onTextChange, taskId, onTaskSelect, onTaskClear, allTasks,
}: {
  slotIndex: number; text: string; onTextChange: (v: string) => void
  taskId: string | null; onTaskSelect: (id: string, title: string) => void
  onTaskClear: () => void; allTasks: Task[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const linked = taskId ? allTasks.find(t => t.id === taskId) ?? null : null
  const filtered = allTasks.filter(t => !t.done && !(t as any).deletedAt &&
    (query === '' || t.title.toLowerCase().includes(query.toLowerCase()))).slice(0, 14)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, position: 'relative' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', paddingTop: 10, flexShrink: 0, width: 14 }}>
        {slotIndex + 1}.
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {linked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>⭐</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', flex: 1, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linked.title}</span>
            <button onClick={onTaskClear} style={{ color: 'var(--ink-4)', fontSize: 14, padding: '0 2px', flexShrink: 0 }} title="Unlink task">✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <input value={text} onChange={e => onTextChange(e.target.value)} className="journal-input" style={{ ...monoInput, flex: 1 }} />
            <button onClick={() => { setOpen(v => !v); setQuery('') }} title={open ? 'Close picker' : 'Pin a task'}
              style={{ padding: '8px 5px', color: open ? 'var(--accent)' : 'var(--ink-4)', fontSize: 13, flexShrink: 0, transition: 'color .15s' }}>⭐</button>
          </div>
        )}
        {open && !linked && (
          <div style={{ position: 'absolute', top: '100%', left: 14, right: 0, zIndex: 100, background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--rule)' }}>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks…"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div style={{ maxHeight: 186, overflowY: 'auto' }}>
              {filtered.length === 0
                ? <div style={{ padding: '14px', fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>No tasks found</div>
                : filtered.map(t => (
                  <button key={t.id} onMouseDown={e => e.preventDefault()}
                    onClick={() => { onTaskSelect(t.id, t.title); setOpen(false); setQuery('') }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 14px', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>
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
