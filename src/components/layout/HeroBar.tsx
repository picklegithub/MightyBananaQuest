/**
 * HeroBar — horizontal stat strip that sits between ScreenHeader and the
 * scrollable body. Used on Today, Habits, Goals screens.
 */

import React from 'react'

export interface HeroBarStat {
  label:  string
  value:  string | number
  tone?:  'default' | 'warning' | 'success'
}

interface HeroBarProps {
  stats:      HeroBarStat[]
  sparkline?: React.ReactNode
}

function toneColor(tone: HeroBarStat['tone']): string {
  if (tone === 'success') return 'var(--accent)'
  if (tone === 'warning') return 'var(--warn)'
  return 'var(--ink)'
}

export function HeroBar({ stats, sparkline }: HeroBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 20px',
      background: 'var(--paper-2)',
      borderBottom: '1px solid var(--rule)',
      flexShrink: 0,
      gap: 0,
      overflowX: 'auto',
    }}>
      {stats.map((stat, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <div style={{
              width: 1, alignSelf: 'stretch',
              background: 'var(--rule)', margin: '0 16px',
              flexShrink: 0,
            }} />
          )}
          <div style={{
            display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 22, lineHeight: 1,
              color: toneColor(stat.tone),
            }}>
              {stat.value}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--ink-4)', marginTop: 5,
            }}>
              {stat.label}
            </div>
          </div>
        </React.Fragment>
      ))}

      {sparkline && (
        <>
          <div style={{ flex: 1 }} />
          {sparkline}
        </>
      )}
    </div>
  )
}
