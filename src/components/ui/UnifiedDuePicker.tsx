/**
 * UnifiedDuePicker — one panel for due date, time, and repeat.
 *
 * Natural-language input at the top understands:
 *   "tomorrow at 3pm"          → due=Tomorrow, time=15:00
 *   "every Monday at 10am"     → due=next Mon, recurring=Weekly on Mon, time=10:00
 *   "next Friday"              → due=2025-04-25
 *
 * Three chip rows below let you tap-select without typing.
 */

import React, { useState, useRef } from 'react'
import { parseDue, dueSummary, formatDueLabel, formatTime } from '../../lib/parseDue'

export interface ScheduleValue {
  due: string
  recurring: string | null
  time: string | undefined
}

interface Props {
  due: string
  recurring: string | null
  time?: string
  onChange: (due: string, recurring: string | null, time: string | undefined) => void
}

// ── Date quick-picks ──────────────────────────────────────────────────────────

function thisWeekISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DATE_CHIPS = [
  { label: 'Today',     due: () => 'Today'      },
  { label: 'Tomorrow',  due: () => 'Tomorrow'   },
  { label: '+1 week',   due: thisWeekISO         },
  { label: 'No date',   due: () => ''            },
]

// ── Time quick-picks ──────────────────────────────────────────────────────────

const TIME_CHIPS = [
  { label: 'No time', value: '' },
  { label: '9 am',    value: '09:00' },
  { label: '12 pm',   value: '12:00' },
  { label: '2 pm',    value: '14:00' },
  { label: '6 pm',    value: '18:00' },
  { label: '9 pm',    value: '21:00' },
]

// ── Repeat quick-picks ────────────────────────────────────────────────────────

const REPEAT_CHIPS = [
  { label: 'None',      value: null       },
  { label: 'Daily',     value: 'Daily'    },
  { label: 'Weekdays',  value: 'Weekdays' },
  { label: 'Weekly',    value: 'Weekly'   },
  { label: 'Biweekly',  value: 'Biweekly' },
  { label: 'Monthly',   value: 'Monthly'  },
]

// ── Styles ────────────────────────────────────────────────────────────────────

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '6px 11px', borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', flexShrink: 0,
    background: active ? 'var(--ink)' : 'var(--paper-2)',
    color:      active ? 'var(--paper)' : 'var(--ink-2)',
    border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
    cursor: 'pointer',
  }
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 7,
}

const row: React.CSSProperties = {
  display: 'flex', gap: 6, flexWrap: 'wrap',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UnifiedDuePicker({ due, recurring, time, onChange }: Props) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [preview, setPreview] = useState<{ due: string; recurring: string | null; time?: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Natural language input ─────────────────────────────────────────────────

  function handleTextChange(v: string) {
    setText(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) { setPreview(null); return }
    debounceRef.current = setTimeout(() => setPreview(parseDue(v)), 320)
  }

  function commitText(e: React.FormEvent) {
    e.preventDefault()
    const result = preview ?? (text.trim() ? parseDue(text.trim()) : null)
    if (result) { onChange(result.due, result.recurring, result.time); setText(''); setPreview(null) }
  }

  // ── Chip helpers ───────────────────────────────────────────────────────────

  function setDate(newDue: string) { onChange(newDue, recurring, time) }
  function setTime(newTime: string) { onChange(due, recurring, newTime || undefined) }
  function setRepeat(newRecurring: string | null) { onChange(due, newRecurring, time) }

  // ── Display label for the preview badge ───────────────────────────────────

  const hasValue = !!(due || recurring || time)
  const displayLabel = hasValue
    ? dueSummary(due, recurring, time)
    : 'No date'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Natural language input */}
      <form onSubmit={commitText} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          placeholder={hasValue ? displayLabel : 'e.g. "next Friday at 2pm" or "every Mon"…'}
          style={{
            width: '100%', padding: '10px 13px',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 10, fontSize: 13, color: 'var(--ink)',
          }}
        />
        {focused && text.trim() && preview && (
          <div style={{
            padding: '8px 12px',
            background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
              ✦ {dueSummary(preview.due, preview.recurring, preview.time)}
            </span>
            <button
              type="submit"
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, flexShrink: 0,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                background: 'var(--ink)', color: 'var(--paper)',
              }}
            >
              Set
            </button>
          </div>
        )}
      </form>

      {/* DATE */}
      <div>
        <div style={sectionLabel}>Date</div>
        <div style={row}>
          {DATE_CHIPS.map(q => {
            const d = q.due()
            const active = due === d
            return (
              <button key={q.label} onClick={() => setDate(d)} style={chip(active)}>
                {q.label}
              </button>
            )
          })}
          {/* Native date input overlaid on a chip */}
          <div style={{ position: 'relative' }}>
            <input
              type="date"
              value={/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : ''}
              onChange={e => e.target.value && setDate(e.target.value)}
              style={{ ...chip(false), cursor: 'pointer', colorScheme: 'light dark', color: 'transparent', display: 'block' }}
            />
            <span style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...chip(/^\d{4}-\d{2}-\d{2}$/.test(due)),
              border: 'none', background: 'transparent',
            }}>
              {/^\d{4}-\d{2}-\d{2}$/.test(due) ? formatDueLabel(due) : '📅 Pick'}
            </span>
          </div>
        </div>
      </div>

      {/* TIME */}
      <div>
        <div style={sectionLabel}>Time</div>
        <div style={row}>
          {TIME_CHIPS.map(t => {
            const active = (t.value === '') ? !time : time === t.value
            return (
              <button key={t.label} onClick={() => setTime(t.value)} style={chip(active)}>
                {t.label}
              </button>
            )
          })}
          {/* Native time input chip */}
          <div style={{ position: 'relative' }}>
            <input
              type="time"
              value={time ?? ''}
              onChange={e => setTime(e.target.value)}
              style={{ ...chip(false), cursor: 'pointer', colorScheme: 'light dark', color: 'transparent', display: 'block' }}
            />
            <span style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...chip(!!(time && !TIME_CHIPS.some(t => t.value === time))),
              border: 'none', background: 'transparent',
            }}>
              {(time && !TIME_CHIPS.some(t => t.value === time)) ? formatTime(time) : '⌚ Custom'}
            </span>
          </div>
        </div>
      </div>

      {/* REPEAT */}
      <div>
        <div style={sectionLabel}>Repeat</div>
        <div style={row}>
          {REPEAT_CHIPS.map(r => (
            <button key={r.label} onClick={() => setRepeat(r.value)} style={chip(recurring === r.value)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
