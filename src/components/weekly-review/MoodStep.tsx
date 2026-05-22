import React from 'react'

interface Props {
  energyByDay: Record<string, 1 | 2 | 3>
  weekDays:    string[]
  planMoods:   Record<string, 'steady' | 'tired' | 'charged'>
}

const ENERGY_LABEL:  Record<number, string> = { 1: 'Low', 2: 'Okay', 3: 'Strong' }
const ENERGY_COLOR:  Record<number, string> = { 1: 'var(--warn)', 2: 'var(--ink-2)', 3: 'var(--accent)' }
const ENERGY_WIDTH:  Record<number, string> = { 1: '30%', 2: '65%', 3: '100%' }
const MOOD_EMOJI = { steady: '✦', tired: '○', charged: '⚡' }
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MoodStep({ energyByDay, weekDays, planMoods }: Props) {
  const energyAvg = (() => {
    const vals = weekDays.map(d => energyByDay[d]).filter(Boolean) as number[]
    if (vals.length === 0) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Mood & energy</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          How did your energy hold up? Notice patterns — not to judge, but to plan better next week.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weekDays.map(iso => {
          const e    = energyByDay[iso]
          const mood = planMoods[iso]
          const dow  = DOW[new Date(iso + 'T12:00:00').getDay()]
          const barW = e ? ENERGY_WIDTH[e] : '0%'
          const barC = e ? ENERGY_COLOR[e] : 'var(--rule)'

          return (
            <div key={iso} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                width: 30, flexShrink: 0,
              }}>{dow}</div>
              <div style={{ flex: 1, height: 6, background: 'var(--paper-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: barW, height: '100%', background: barC, borderRadius: 3, transition: 'width .3s' }} />
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                width: 36, textAlign: 'right', flexShrink: 0,
              }}>
                {e ? ENERGY_LABEL[e] : '—'}
              </div>
              {mood && <span style={{ fontSize: 14, flexShrink: 0 }}>{MOOD_EMOJI[mood]}</span>}
            </div>
          )
        })}
      </div>

      {energyAvg && (
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            AVG ENERGY
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
            {energyAvg} / 3
          </span>
        </div>
      )}
    </div>
  )
}
