import React from 'react'
import type { MoodScore, MoodEnergy } from '../../types'
import { MOOD_BY_SCORE, ENERGY_BY_VALUE } from './constants'

interface Props {
  mood?:   MoodScore | null
  energy?: MoodEnergy | null
  size?:   'small' | 'normal'
  onClick?: () => void
}

export function MoodSummaryChip({ mood, energy, size = 'normal', onClick }: Props) {
  if (!mood) return null
  const m = MOOD_BY_SCORE[mood]
  const e = energy ? ENERGY_BY_VALUE[energy] : null
  const fontSize = size === 'small' ? 10 : 11

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: size === 'small' ? '3px 8px' : '5px 10px',
        borderRadius: 999,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ color: m.color, fontWeight: 700, fontSize: fontSize + 2 }}>{m.glyph}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize, color: 'var(--ink-2)', letterSpacing: '0.04em' }}>
        {m.label}
      </span>
      {e && (
        <>
          <span style={{ color: 'var(--rule)', fontSize: fontSize - 1 }}>·</span>
          <span style={{ fontSize: fontSize + 1 }}>{e.glyph}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize, color: 'var(--ink-2)', letterSpacing: '0.04em' }}>
            {e.label}
          </span>
        </>
      )}
    </button>
  )
}
