import React from 'react'
import type { CopingCard } from '../../types'

interface Props {
  card: CopingCard | null
  onOpen: () => void
}

export function CopingCardPin({ card, onOpen }: Props) {
  const preview = card
    ? card.content.slice(0, 72) + (card.content.length > 72 ? '…' : '')
    : null

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left',
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>🫂</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {card && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            📌 {card.title}
          </div>
        )}
        <span style={{
          fontSize: 13,
          color: preview ? 'var(--ink-2)' : 'var(--ink-3)',
          fontFamily: preview ? 'var(--font-display)' : 'var(--font-sans)',
          fontStyle: preview ? 'italic' : 'normal',
          lineHeight: 1.5,
        }}>
          {preview ?? 'Browse coping cards →'}
        </span>
      </div>
    </button>
  )
}
