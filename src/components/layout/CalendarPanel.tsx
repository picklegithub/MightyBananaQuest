/**
 * CalendarPanel — embedded "Today's schedule" placeholder on the Today screen.
 * Real calendar integration is a future phase. For now renders an empty state.
 */

import React from 'react'
import { Icons } from '../ui/Icons'

export function CalendarPanel() {
  const now  = new Date()
  const dow  = now.toLocaleDateString(undefined, { weekday: 'long' })
  const date = now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

  return (
    <div style={{
      margin: '20px 20px 0',
      padding: '16px',
      borderRadius: 14,
      background: 'var(--paper-2)',
      border: '1px solid var(--rule)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-4)',
          }}>
            Today's schedule
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 14, color: 'var(--ink-2)', marginTop: 2,
          }}>
            {dow}, {date}
          </div>
        </div>
        <Icons.calendar size={16} style={{ color: 'var(--ink-4)' }} />
      </div>

      {/* Empty state */}
      <div style={{
        padding: '16px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--paper-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.calendar size={16} style={{ color: 'var(--ink-4)' }} />
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)',
          textAlign: 'center', lineHeight: 1.5, letterSpacing: '0.03em',
        }}>
          Calendar integration coming soon.<br />
          Your schedule will appear here.
        </div>
      </div>
    </div>
  )
}
