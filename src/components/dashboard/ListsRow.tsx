import React from 'react'
import { Icons } from '../ui/Icons'
import { areaColor } from '../../lib/areaColor'
import type { Screen } from '../../types'

interface Props {
  navigate: (s: Screen) => void
  isDark: boolean
  inboxCount: number
  habitCount: number
  habitPending: number
}

export function ListsRow({ navigate, isDark, inboxCount, habitCount, habitPending }: Props) {
  return (
    <div style={{ padding: '16px 20px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
          Lists
        </span>
        <button
          onClick={() => navigate({ name: 'all-tasks' })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          ALL TASKS <Icons.arrow size={11} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => navigate({ name: 'inbox' })}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 10, textAlign: 'left',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: areaColor(205, 'bg', isDark), color: areaColor(205, 'fg', isDark),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icons.inbox size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>Inbox</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 1 }}>
              {inboxCount > 0 ? `${inboxCount} new` : 'all clear'}
            </div>
          </div>
          {inboxCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'white', letterSpacing: '0.04em',
              background: 'var(--warn)', borderRadius: 10, padding: '2px 6px', fontWeight: 600, flexShrink: 0,
            }}>
              {inboxCount}
            </span>
          )}
        </button>

        {habitCount > 0 && (
          <button
            onClick={() => navigate({ name: 'all-habits' })}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 10, textAlign: 'left',
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: areaColor(280, 'bg', isDark), color: areaColor(280, 'fg', isDark),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icons.repeat size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>Habits</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 1 }}>
                {habitPending > 0 ? `${habitPending} to log` : 'all logged'}
              </div>
            </div>
            {habitPending > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'white', letterSpacing: '0.04em',
                background: areaColor(280, 'fg', isDark), borderRadius: 10, padding: '2px 6px', fontWeight: 600, flexShrink: 0,
              }}>
                {habitPending}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
