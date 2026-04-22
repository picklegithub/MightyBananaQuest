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

import React, { useState, useRef, useEffect } from 'react'
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

// Preset reminder times
const TIME_PRESETS = [
  { label: '9:00 AM',  value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '2:00 PM',  value: '14:00' },
  { label: '5:00 PM',  value: '17:00' },
  { label: '8:00 PM',  value: '20:00' },
]

// Full hour list for custom wheel (6am–11pm)
const CUSTOM_HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
const CUSTOM_MINUTES: { label: string; value: string }[] = [
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

// ── iPhone-style scroll wheel picker ─────────────────────────────────────────

const ITEM_H = 44

function WheelPicker<T extends string | number>({
  items, value, onChange,
}: {
  items: { label: string; value: T }[]
  value: T | null
  onChange: (v: T) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PADDING = 2 // visible rows above/below centre

  // Scroll to selected value
  useEffect(() => {
    if (!scrollRef.current) return
    const idx = items.findIndex(i => i.value === value)
    if (idx >= 0) {
      scrollRef.current.scrollTop = idx * ITEM_H
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleScroll() {
    if (!scrollRef.current) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      if (!scrollRef.current) return
      const idx = Math.round(scrollRef.current.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(items.length - 1, idx))
      if (items[clamped].value !== value) onChange(items[clamped].value)
    }, 80)
  }

  const containerH = (PADDING * 2 + 1) * ITEM_H

  return (
    <div ref={ref} style={{ position: 'relative', height: containerH, overflow: 'hidden', minWidth: 70 }}>
      {/* Centre highlight band */}
      <div style={{
        position: 'absolute', top: PADDING * ITEM_H, height: ITEM_H,
        left: 0, right: 0,
        background: 'var(--paper-3)',
        borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Scrollable track */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: '100%', overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          // hide webkit scrollbar
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        {/* Top padding */}
        {Array.from({ length: PADDING }).map((_, i) => (
          <div key={`tp-${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} />
        ))}
        {items.map(item => (
          <div key={String(item.value)} style={{
            height: ITEM_H, scrollSnapAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
            fontWeight: item.value === value ? 600 : 400,
            color: item.value === value ? 'var(--ink)' : 'var(--ink-3)',
            fontFamily: 'var(--font-mono)',
            userSelect: 'none',
          }}>
            {item.label}
          </div>
        ))}
        {/* Bottom padding */}
        {Array.from({ length: PADDING }).map((_, i) => (
          <div key={`bp-${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} />
        ))}
      </div>
      {/* Fade overlay top + bottom */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to bottom, var(--paper) 0%, transparent 35%, transparent 65%, var(--paper) 100%)',
      }} />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = ['Days', 'Weeks', 'Months', 'Years']

function parseCustomRepeat(val: string): { n: number; period: string } {
  // "Every 3 Weeks" → {n:3, period:'Weeks'}
  const m = val.match(/every\s+(\d+)\s+(\w+)/i)
  if (m) {
    const p = PERIOD_OPTIONS.find(o => o.toLowerCase().startsWith(m[2].toLowerCase())) ?? 'Weeks'
    return { n: parseInt(m[1]), period: p }
  }
  return { n: 1, period: 'Weeks' }
}

export function UnifiedDuePicker({ due, recurring, time, onChange }: Props) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [preview, setPreview] = useState<{ due: string; recurring: string | null; time?: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const isCustomRepeat = !!recurring && !REPEAT_CHIPS.slice(0, -1).some(c => c.value === recurring)

  // Custom repeat number + period state
  const parsedCustom = isCustomRepeat ? parseCustomRepeat(recurring!) : { n: 1, period: 'Weeks' }
  const [customN,      setCustomN]      = useState(parsedCustom.n)
  const [customPeriod, setCustomPeriod] = useState(parsedCustom.period)

  // Custom time wheel visibility
  const isPresetTime = TIME_PRESETS.some(p => p.value === time)
  const [showCustomTime, setShowCustomTime] = useState(!isPresetTime && !!time)

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
    const newMin = (m && CUSTOM_MINUTES.some(x => x.value === m)) ? m : '00'
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
      // Show custom picker — pre-set to "Every 1 Week" if nothing custom yet
      if (!isCustomRepeat) {
        setCustomN(1)
        setCustomPeriod('Weeks')
      }
      onChange(due, `Every 1 Weeks`, time)
    } else {
      onChange(due, val, time)
    }
  }

  function commitCustomRepeat(n: number, period: string) {
    onChange(due, `Every ${n} ${period}`, time)
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

      {/* TIME — due time presets + custom iPhone-style wheel */}
      <div>
        <div style={sectionLabel}>Due time</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Preset row */}
          <div style={scrollRow}>
            <button onClick={() => { clearTime(); setShowCustomTime(false) }} style={chip(!time && !showCustomTime)}>
              No time
            </button>
            {TIME_PRESETS.map(p => (
              <button key={p.value}
                onClick={() => { onChange(due, recurring, p.value); setShowCustomTime(false) }}
                style={chip(time === p.value && !showCustomTime)}>
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                if (!showCustomTime) {
                  // Open with current time or a sensible default
                  const h = selHour ?? 9
                  const m = selMin ?? '00'
                  setShowCustomTime(true)
                  onChange(due, recurring, `${String(h).padStart(2, '0')}:${m}`)
                } else {
                  setShowCustomTime(false)
                }
              }}
              style={chip(showCustomTime || (!isPresetTime && !!time))}>
              Custom…
            </button>
          </div>

          {/* Custom time — iPhone-style scroll wheels */}
          {showCustomTime && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--accent)' }}>
              <div style={{ display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'center' }}>
                {/* Hour wheel */}
                <WheelPicker<number>
                  items={CUSTOM_HOURS.map(h => ({ label: formatHourLabel(h), value: h }))}
                  value={selHour}
                  onChange={h => setHour(h)}
                />
                {/* Separator */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--ink-2)', padding: '0 6px', alignSelf: 'center' }}>:</div>
                {/* Minute wheel */}
                <WheelPicker<string>
                  items={CUSTOM_MINUTES.map(m => ({ label: m.label.replace(':', ''), value: m.value }))}
                  value={selMin}
                  onChange={m => setMinute(m)}
                />
              </div>
              {time && (
                <div style={{ marginTop: 6, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                  {formatTime(time)}
                </div>
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
        {/* Custom repeat structured picker */}
        {isCustomRepeat && (
          <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--accent)' }}>
            <div style={{ ...sectionLabel, marginBottom: 10 }}>Every…</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Number input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => { const n = Math.max(1, customN - 1); setCustomN(n); commitCustomRepeat(n, customPeriod) }}
                  style={{ ...chip(false), padding: '6px 10px', fontSize: 14, fontWeight: 700 }}
                >−</button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center', color: 'var(--ink)' }}>
                  {customN}
                </span>
                <button
                  onClick={() => { const n = Math.min(99, customN + 1); setCustomN(n); commitCustomRepeat(n, customPeriod) }}
                  style={{ ...chip(false), padding: '6px 10px', fontSize: 14, fontWeight: 700 }}
                >+</button>
              </div>
              {/* Period selector */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {PERIOD_OPTIONS.map(p => (
                  <button key={p} onClick={() => { setCustomPeriod(p); commitCustomRepeat(customN, p) }}
                    style={chip(customPeriod === p)}>
                    {customN === 1 ? p.replace(/s$/, '') : p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.05em' }}>
              → Every {customN} {customN === 1 ? customPeriod.replace(/s$/, '') : customPeriod}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
