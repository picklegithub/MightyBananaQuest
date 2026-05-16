import React from 'react'

interface BadgeProps {
  count: number
  max?: number
}

export const Badge = ({ count, max = 9 }: BadgeProps) => {
  if (count <= 0) return null
  return (
    <div style={{
      position: 'absolute', top: -4, right: -4,
      minWidth: 18, height: 18, borderRadius: 9,
      background: 'var(--warn)', color: 'var(--paper)',
      border: '2px solid var(--paper)',
      fontFamily: 'var(--font-mono)', fontSize: 10,
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px',
      zIndex: 1,
      pointerEvents: 'none',
    }}>
      {count > max ? `${max}+` : count}
    </div>
  )
}
