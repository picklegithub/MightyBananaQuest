/**
 * UnifiedDuePicker
 *
 * A single text field that parses natural language for both due date and recurrence.
 *   "tomorrow"              → due=Tomorrow
 *   "every Monday"          → due=next Monday, recurring=Weekly on Mon
 *   "every day"             → due=Today, recurring=Daily
 *   "next Friday"           → due=YYYY-MM-DD
 *
 * Also shows quick-pick chips below the input.
 */

import React, { useState, useRef, useEffect } from 'react'
import { parseDue, dueSummary, formatDueLabel } from '../../lib/parseDue'

interface Props {
  due: string
  recurring: string | null
  onChange: (due: string, recurring: string | null) => void
}

// Quick-pick suggestions
const QUICK = [
  { label: 'Today',      due: 'Today',     recurring: null },
  { label: 'Tomorrow',   due: 'Tomorrow',  recurring: null },
  { label: 'This week',  due: '',          recurring: null, custom: () => {
      const d = new Date(); d.setDate(d.getDate() + 7)
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      return { due: iso, recurring: null }
  }},
  { label: 'Daily',      due: 'Today',     recurring: 'Daily' },
  { label: 'Weekly',     due: 'Today',     recurring: 'Weekly' },
  { label: 'No date',    due: '',          recurring: null },
]

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 11px', borderRadius: 20, fontSize: 11,
  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', whiteSpace: 'nowrap',
  background: active ? 'var(--ink)' : 'var(--paper-2)',
  color: active ? 'var(--paper)' : 'var(--ink-2)',
  border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
  cursor: 'pointer', flexShrink: 0,
})

export function UnifiedDuePicker({ due, recurring, onChange }: Props) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [preview, setPreview] = useState<{ due: string; recurring: string | null } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive display label from current due/recurring
  const displayLabel = (() => {
    if (!due && !recurring) return 'No date'
    const parts: string[] = []
    if (due) parts.push(formatDueLabel(due))
    if (recurring) parts.push(recurring)
    return parts.join(' · ')
  })()

  function handleTextChange(v: string) {
    setText(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) {
      setPreview(null)
      return
    }
    debounceRef.current = setTimeout(() => {
      const result = parseDue(v)
      setPreview(result)
    }, 350)
  }

  function commit(d: string, r: string | null) {
    onChange(d, r)
    setText('')
    setPreview(null)
    setFocused(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (preview) {
      commit(preview.due, preview.recurring)
    } else if (text.trim()) {
      const result = parseDue(text.trim())
      commit(result.due, result.recurring)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Text input */}
      <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
        <input
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // slight delay so click on preview chip can fire
            setTimeout(() => setFocused(false), 180)
          }}
          placeholder={displayLabel || 'e.g. "every Monday" or "next Friday"…'}
          style={{
            width: '100%', padding: '11px 14px',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 10, fontSize: 13, color: 'var(--ink)',
          }}
        />

        {/* Parsed preview */}
        {focused && text.trim() && preview && (
          <div style={{
            marginTop: 6, padding: '8px 12px',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
              ✦ {dueSummary(preview.due, preview.recurring)}
            </span>
            <button
              type="submit"
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                background: 'var(--ink)', color: 'var(--paper)',
              }}
            >
              Set
            </button>
          </div>
        )}
      </form>

      {/* Quick-pick chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {QUICK.map(q => {
          const { due: qd, recurring: qr } = q.custom ? q.custom() : q
          const isActive = due === qd && recurring === qr
          return (
            <button
              key={q.label}
              onClick={() => commit(qd, qr)}
              style={chipStyle(isActive)}
            >
              {q.label}
            </button>
          )
        })}

        {/* Native date picker chip */}
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(due) ? due : ''}
            onChange={e => e.target.value && commit(e.target.value, null)}
            style={{
              ...chipStyle(false),
              cursor: 'pointer',
              colorScheme: 'light dark',
              color: 'transparent',
            }}
          />
          <span style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...chipStyle(false),
            border: 'none', background: 'transparent',
          }}>
            📅 Custom
          </span>
        </div>
      </div>

      {/* Current value badge — shown only when something is set */}
      {(due || recurring) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px', borderRadius: 8,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
            {displayLabel}
          </span>
          {(due || recurring) && (
            <button
              onClick={() => commit('', null)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}
            >
              ✕ clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
