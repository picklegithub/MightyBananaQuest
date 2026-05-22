import React from 'react'
import type { MoodScore } from '../../types'
import { MOOD_SCALE } from './constants'

interface Props {
  value:    MoodScore | null | undefined
  onChange: (v: MoodScore) => void
  size?:    'normal' | 'large'
}

export function MoodScalePicker({ value, onChange, size = 'normal' }: Props) {
  const glyphSize   = size === 'large' ? 36 : 28
  const labelSize   = size === 'large' ? 11 : 10
  const gap         = size === 'large' ? 6  : 4

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, justifyContent: 'space-between' }}>
      {MOOD_SCALE.map(m => {
        const selected = value === m.score
        return (
          <button
            key={m.score}
            onClick={() => onChange(m.score)}
            title={m.sublabel}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: size === 'large' ? '10px 4px' : '8px 2px',
              borderRadius: 12,
              background: selected ? 'var(--paper-2)' : 'transparent',
              border: `1.5px solid ${selected ? m.color : 'transparent'}`,
              transition: 'all .12s ease',
            }}
          >
            {/* Glyph */}
            <span style={{
              fontSize: glyphSize,
              lineHeight: 1,
              color: selected ? m.color : 'var(--ink-3)',
              fontWeight: selected ? 700 : 400,
              transition: 'color .12s ease',
              display: 'block',
            }}>
              {m.glyph}
            </span>
            {/* Label */}
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: labelSize,
              letterSpacing: '0.04em',
              color: selected ? m.color : 'var(--ink-4)',
              transition: 'color .12s ease',
              whiteSpace: 'nowrap',
            }}>
              {m.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
