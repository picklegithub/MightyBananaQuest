import React from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatCustom(v: string) {
  try {
    return new Date(v + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  } catch { return v }
}

export function DueDatePicker({ value, onChange }: Props) {
  const today     = new Date()
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const nextWeek  = new Date(today); nextWeek.setDate(today.getDate() + 7)
  const nextMonth = new Date(today); nextMonth.setMonth(today.getMonth() + 1)

  const nextWeekStr  = toISODate(nextWeek)
  const nextMonthStr = toISODate(nextMonth)

  const presets = [
    { label: 'Today',      value: 'Today' },
    { label: 'Tomorrow',   value: 'Tomorrow' },
    { label: 'Next week',  value: nextWeekStr },
    { label: 'Next month', value: nextMonthStr },
    { label: 'No date',    value: '' },
  ]

  const isCustom =
    value !== '' &&
    value !== 'Today' &&
    value !== 'Tomorrow' &&
    value !== nextWeekStr &&
    value !== nextMonthStr

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 13px', borderRadius: 8, fontSize: 12,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
    background: active ? 'var(--ink)' : 'var(--paper-2)',
    color: active ? 'var(--paper)' : 'var(--ink-2)',
    border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
  })

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {presets.map(p => (
        <button key={p.label} onClick={() => onChange(p.value)} style={btnStyle(value === p.value)}>
          {p.label}
        </button>
      ))}

      {/* Custom — styled native date input */}
      <div style={{ position: 'relative' }}>
        <input
          type="date"
          value={isCustom ? value : ''}
          onChange={e => e.target.value && onChange(e.target.value)}
          style={{
            ...btnStyle(isCustom),
            cursor: 'pointer',
            colorScheme: 'light dark',
            // hide the default chrome — show our label on top
            color: isCustom ? undefined : 'transparent',
          }}
        />
        {!isCustom && (
          <span style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...btnStyle(false),
            border: 'none', background: 'transparent',
          }}>
            📅 Custom
          </span>
        )}
      </div>
    </div>
  )
}
