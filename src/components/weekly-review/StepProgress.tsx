import React from 'react'

export function StepProgress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i <= step ? 'var(--ink)' : 'var(--paper-3)',
          transition: 'background .25s',
        }} />
      ))}
    </div>
  )
}
