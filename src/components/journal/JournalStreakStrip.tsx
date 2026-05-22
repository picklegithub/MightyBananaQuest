import React from 'react'
import { localDateISO } from '../../lib/useCurrentDate'
import { Icons } from '../ui/Icons'
import type { JournalEntry } from '../../types'

interface Props {
  streak: number
  entries: JournalEntry[]
}

export function JournalStreakStrip({ streak, entries }: Props) {
  const now = new Date()
  const entryDates = new Set(entries.map(e => e.date))

  // Last 14 days: index 0 = oldest, 13 = today
  const bars = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (13 - i))
    return entryDates.has(localDateISO(d))
  })

  return (
    <div style={{
      marginTop: 28, padding: 14, borderRadius: 12,
      background: 'var(--paper-2)', border: '1px solid var(--rule)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <Icons.flame size={18} stroke="var(--accent)" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
          {streak > 0 ? `${streak}-day journal streak` : 'Start your streak today'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          Both rituals, most days.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {bars.map((filled, i) => (
          <div key={i} style={{
            width: 5, height: 18, borderRadius: 1,
            background: filled ? 'var(--accent)' : 'var(--paper-3)',
          }} />
        ))}
      </div>
    </div>
  )
}
