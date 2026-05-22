import React from 'react'
import type { MoodEnergy } from '../../types'
import { ENERGY_OPTIONS } from './constants'

interface Props {
  value:    MoodEnergy | null | undefined
  onChange: (v: MoodEnergy) => void
}

export function EnergyPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {ENERGY_OPTIONS.map(e => {
        const selected = value === e.value
        return (
          <button
            key={e.value}
            onClick={() => onChange(e.value)}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 8px',
              borderRadius: 10,
              background: selected ? 'var(--paper-2)' : 'transparent',
              border: `1.5px solid ${selected ? e.color : 'var(--rule)'}`,
              color: selected ? e.color : 'var(--ink-3)',
              transition: 'all .12s ease',
            }}
          >
            <span style={{ fontSize: 14 }}>{e.glyph}</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11, letterSpacing: '0.04em',
              fontWeight: selected ? 600 : 400,
            }}>
              {e.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
