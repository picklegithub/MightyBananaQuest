import React from 'react'
import { Icons } from '../ui/Icons'

export function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: string; color: string
}) {
  const I = Icons[icon as keyof typeof Icons] ?? Icons.check
  return (
    <div style={{
      padding: '16px 14px', borderRadius: 14,
      background: 'var(--paper-2)', border: '1px solid var(--rule)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <I size={18} style={{ color }} />
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
        color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.07em',
      }}>
        {label.toUpperCase()}
      </div>
    </div>
  )
}
