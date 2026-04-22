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

// ── Time helpers ──────────────────────────────────────────────────────────────

const HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]
const MINUTES: { label: string; value: string }[] = [
  { label: ':00', value: '00' },
  { label: ':15', value: '15' },
  { label: ':30', value: '30' },
  { label: ':45', value: '45' },
]

function formatHourLabel(h: number): string {
  if (h === 0)  return '12am'
  if (h < 12)  return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function parseTimeParts(t?: string): { h: number | null; m: string | null } {
  if (!t) return { h: null, m: null }
  const [hh, mm] = t.split(':')
  return { h: parseInt(hh), m: mm }
}

// ── Repeat chips ──────────────────────────────────────────────────────────────

const REPEAT_CHIPS = [
  { label: 'None',       value: null        },
  { label: 'Daily',      value: 'Daily'     },
  { label: 'Weekdays',   value: 'Weekdays'  },
  { label: 'Weekly',     value: 'Weekly'    },
  { label: 'Biweekly',   value: 'Biweekly'  },
  { label: 'Monthly',    value: 'Monthly'   },
  { label: 'Yearly',     value: 'Yearly'    },
  { label: 'Custom…',    value: '__custom__' },
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

const scrollRow: React.CSSProperties = {
  display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UnifiedDuePicker({ due, recurring, time, onChange }: Props) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [preview, setPreview] = useState<{ due: string; recurring: string | null; time?: string } | null>(null)
  const [customRepeat, setCustomRepeat] = useState(
    recurring && !REPEAT_CHIPS.some(c => c.value === recurring && c.value !== '__custom__') ? recurring : ''
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const isCustomRepeat = !!recurring && !REPEAT_CHIPS.slice(0, -1).some(c => c.value === recurring)

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

  function setHour(h: number) {
    const { m } = parseTimeParts(time)
    const newMin = (m && MINUTES.some(x => x.value === m)) ? m : '00'
    onChange(due, recurring, `${String(h).padStart(2, '0')}:${newMin}`)
  }

  function setMinute(m: string) {
    const { h } = parseTimeParts(time)
    if (h === null) return
    onChange(due, recurring, `${String(h).padStart(2, '0')}:${m}`)
  }

  function clearTime() { onChange(due, recurring, undefined) }

  function setRepeat(val: string | null) {
    if (val === '__custom__') {
      // Show custom input — don't change recurring yet
    } else {
      onChange(due, val, time)
    }
  }

  function commitCustomRepeat() {
    const v = customRepeat.trim()
    if (v) onChange(due, v, time)
  }

  // ── Display ────────────────────────────────────────────────────────────────

  const hasValue = !!(due || recurring || time)
  const displayLabel = hasValue ? dueSummary(due, recurring, time) : 'No date'

  const { h: selHour, m: selMin } = parseTimeParts(time)
  const showMinutePicker = selHour !== null

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
          {/* Date picker pill — hidden native input behind a clean visible button */}
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              style={chip(/^\d{4}-\d{2}-\d{2}$/.test(due))}
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            >
              {/^\d{4}-\d{2}-\d{2}$/.test(due) ? formatDueLabel(due) : '📅 Pick'}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : ''}
              onChange={e => e.target.value && setDate(e.target.value)}
              style={{
                position: 'absolute', inset: 0, opacity: 0,
                cursor: 'pointer', width: '100%', height: '100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* TIME — hour chips + minute refinement */}
      <div>
        <div style={sectionLabel}>Time</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Clear time chip */}
          <div style={scrollRow}>
            <button onClick={clearTime} style={chip(!time)}>No time</button>
            {HOURS.map(h => (
              <button key={h} onClick={() => setHour(h)} style={chip(selHour === h)}>
                {formatHourLabel(h)}
              </button>
            ))}
          </div>
          {/* Minute row — only when an hour is selected */}
          {showMinutePicker && (
            <div style={{ ...row, marginLeft: 2 }}>
              {MINUTES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMinute(m.value)}
                  style={chip(selMin === m.value)}
                >
                  {m.label}
                </button>
              ))}
              {time && (
                <span style={{
                  ...chip(false),
                  background: 'transparent', border: 'none',
                  color: 'var(--ink-3)', display: 'flex', alignItems: 'center',
                }}>
                  → {formatTime(time)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* REPEAT */}
      <div>
        <div style={sectionLabel}>Repeat</div>
        <div style={{ ...row, marginBottom: isCustomRepeat ? 8 : 0 }}>
          {REPEAT_CHIPS.map(r => {
            const active = r.value === '__custom__' ? isCustomRepeat : recurring === r.value
            return (
              <button
                key={r.label}
                onClick={() => setRepeat(r.value)}
                style={chip(active)}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        {/* Custom repeat text input */}
        {(isCustomRepeat || recurring === '__custom__') && (
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <input
              value={customRepeat}
              onChange={e => setCustomRepeat(e.target.value)}
              onBlur={commitCustomRepeat}
              onKeyDown={e => { if (e.key === 'Enter') commitCustomRepeat() }}
              placeholder="e.g. Every 3 weeks"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10,
                border: '1px solid var(--accent)', background: 'var(--paper-2)',
                fontSize: 13, color: 'var(--ink)',
              }}
            />
            <button
              onClick={commitCustomRepeat}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 12, flexShrink: 0,
                background: 'var(--ink)', color: 'var(--paper)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Set
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
