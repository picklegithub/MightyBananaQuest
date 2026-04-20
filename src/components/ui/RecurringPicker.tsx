import React, { useState } from 'react'
import { Icons } from './Icons'

interface Props {
  value: string | null
  onChange: (v: string | null) => void
}

const PRESETS = [
  { label: 'No repeat',  value: null },
  { label: 'Daily',      value: 'Daily' },
  { label: 'Weekdays',   value: 'Weekdays' },
  { label: 'Weekends',   value: 'Weekends' },
  { label: 'Weekly',     value: 'Weekly' },
  { label: 'Biweekly',   value: 'Biweekly' },
]

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function RecurringPicker({ value, onChange }: Props) {
  const [open, setOpen]             = useState(false)
  const [tab, setTab]               = useState<'presets' | 'monthly' | 'custom'>('presets')
  const [monthDays, setMonthDays]   = useState<number[]>([])
  const [customN, setCustomN]       = useState(3)
  const [customUnit, setCustomUnit] = useState<'days' | 'weeks' | 'months'>('days')

  function toggleDay(d: number) {
    setMonthDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function confirmMonthly() {
    if (monthDays.length === 0) { onChange(null); setOpen(false); return }
    const sorted = [...monthDays].sort((a, b) => a - b)
    const label = sorted.length === 1
      ? `Monthly on the ${ordinal(sorted[0])}`
      : `Monthly on the ${sorted.map(d => ordinal(d)).join(' & ')}`
    onChange(label)
    setOpen(false)
  }

  function confirmCustom() {
    onChange(`Every ${customN} ${customUnit}`)
    setOpen(false)
  }

  const displayLabel = value ?? 'No repeat'

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      background: tab === t ? 'var(--ink)' : 'var(--paper-2)',
      color: tab === t ? 'var(--paper)' : 'var(--ink-2)',
      border: '1px solid', borderColor: tab === t ? 'var(--ink)' : 'var(--rule)',
    }}>
      {label}
    </button>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '11px 14px', borderRadius: 10,
          border: '1px solid var(--rule)',
          background: value ? 'var(--ink)' : 'var(--paper-2)',
          color: value ? 'var(--paper)' : 'var(--ink-2)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{displayLabel}</span>
        <Icons.arrow size={14} />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 44px', width: '100%', maxHeight: '82vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="t-display" style={{ fontSize: 20 }}>Repeat</h3>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--ink-3)' }}>
                <Icons.close size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {tabBtn('presets', 'Common')}
              {tabBtn('monthly', 'Monthly')}
              {tabBtn('custom',  'Custom')}
            </div>

            {/* Common presets */}
            {tab === 'presets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRESETS.map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '13px 16px', borderRadius: 10, textAlign: 'left', fontSize: 14,
                      background: value === opt.value ? 'var(--ink)' : 'var(--paper-2)',
                      color:      value === opt.value ? 'var(--paper)' : 'var(--ink)',
                      border: '1px solid', borderColor: value === opt.value ? 'var(--ink)' : 'var(--rule)',
                    }}
                  >
                    <span>{opt.label}</span>
                    {value === opt.value && <Icons.check size={16} sw={2.5} />}
                  </button>
                ))}
              </div>
            )}

            {/* Monthly day-of-month grid */}
            {tab === 'monthly' && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: 14 }}>
                  TAP TO SELECT DAY(S)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 16 }}>
                  {MONTH_DAYS.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      style={{
                        aspectRatio: '1', borderRadius: 8, fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        background: monthDays.includes(d) ? 'var(--ink)' : 'var(--paper-2)',
                        color:      monthDays.includes(d) ? 'var(--paper)' : 'var(--ink-2)',
                        border: '1px solid', borderColor: monthDays.includes(d) ? 'var(--ink)' : 'var(--rule)',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {monthDays.length > 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginBottom: 14, padding: '8px 12px', background: 'var(--paper-2)', borderRadius: 8 }}>
                    Monthly on the {[...monthDays].sort((a,b)=>a-b).map(d => ordinal(d)).join(' & ')}
                  </div>
                )}
                <button onClick={confirmMonthly} style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, fontSize: 15,
                }}>
                  {monthDays.length > 0 ? 'Confirm' : 'No repeat'}
                </button>
              </div>
            )}

            {/* Custom interval */}
            {tab === 'custom' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, color: 'var(--ink-2)', flexShrink: 0 }}>Every</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--rule)', borderRadius: 10, padding: '8px 14px', background: 'var(--paper-2)' }}>
                    <button onClick={() => setCustomN(n => Math.max(1, n - 1))} style={{ color: 'var(--ink-2)', fontSize: 18, lineHeight: 1 }}>−</button>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{customN}</span>
                    <button onClick={() => setCustomN(n => Math.min(30, n + 1))} style={{ color: 'var(--ink-2)', fontSize: 18, lineHeight: 1 }}>+</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['days', 'weeks', 'months'] as const).map(u => (
                      <button key={u} onClick={() => setCustomUnit(u)} style={{
                        padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)',
                        background: customUnit === u ? 'var(--ink)' : 'var(--paper-2)',
                        color:      customUnit === u ? 'var(--paper)' : 'var(--ink-2)',
                        border: '1px solid', borderColor: customUnit === u ? 'var(--ink)' : 'var(--rule)',
                      }}>{u}</button>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginBottom: 16, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 8 }}>
                  Preview: Every {customN} {customUnit}
                </div>
                <button onClick={confirmCustom} style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: 'var(--ink)', color: 'var(--paper)', fontWeight: 600, fontSize: 15,
                }}>
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
