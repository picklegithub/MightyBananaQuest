import React from 'react'
import { Icons } from '../ui/Icons'
import { useIsDark } from '../../lib/colorMode'

function energyDotColor(energy?: 1 | 2 | 3 | null, isDark?: boolean): string {
  if (energy === 3) return isDark ? 'oklch(0.72 0.15 145)' : 'oklch(0.48 0.13 145)'
  if (energy === 2) return isDark ? 'oklch(0.82 0.14 60)' : 'oklch(0.68 0.14 55)'
  return 'rgba(255,255,255,0.28)'
}

interface Props {
  done: number
  total: number
  streak: number
  xp: number
  intensity: 'subtle' | 'balanced' | 'loud'
  onTap: () => void
  energy?: 1 | 2 | 3 | null
  mood?: 'steady' | 'tired' | 'charged' | null
  onDotTap?: () => void
}

export function HeroCard({ done, total, streak, xp, intensity, onTap, energy, mood, onDotTap }: Props) {
  const isTired = mood === 'tired'
  const isDark = useIsDark()
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0
  const level  = Math.floor(xp / 1000) + 1
  const toNext = 1000 - (xp % 1000)
  const showStats = intensity !== 'subtle'

  return (
    <button
      onClick={onTap}
      style={{
        display: 'block', textAlign: 'left',
        margin: '4px 20px 8px', width: 'calc(100% - 40px)',
        padding: 20, borderRadius: 18,
        background: 'var(--ink)', color: 'var(--paper)',
        position: 'relative', overflow: 'hidden',
        border: 'none',
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onDotTap?.() }}
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 8, height: 8, borderRadius: '50%',
          background: energyDotColor(energy, isDark),
          padding: 0, border: 'none',
          cursor: onDotTap ? 'pointer' : 'default',
        }}
        aria-label="Today's context"
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.6, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Today's progress
          </div>
          <div className="t-display" style={{ fontSize: 48, marginTop: 6, lineHeight: 1 }}>
            {done}
            <span style={{ opacity: 0.45, fontSize: 28 }}> / {total}</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            tasks complete · {pct}%
          </div>
        </div>
        {showStats && (
          <div style={{ display: 'flex', gap: 14, marginTop: 4, marginRight: 16 }}>
            {streak > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                  <Icons.flame size={13} stroke="rgba(255,255,255,0.75)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{streak}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.5, letterSpacing: '0.08em', marginTop: 2 }}>STREAK</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <Icons.bolt size={13} stroke="rgba(255,255,255,0.75)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.5, letterSpacing: '0.08em', marginTop: 2 }}>XP</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: isTired ? 'rgba(255,255,255,0.35)' : 'var(--accent-soft)',
          borderRadius: 2, transition: 'width .4s ease',
          filter: isTired ? 'saturate(0)' : 'none',
        }} />
      </div>

      {showStats && (
        <div style={{
          marginTop: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.65,
        }}>
          <span>LVL {level}{isTired ? ' · LIGHT DAY' : mood === 'charged' ? ' · CHARGED' : ' · STEADY'}</span>
          <span>{toNext.toLocaleString()} XP TO LVL {level + 1}</span>
        </div>
      )}
    </button>
  )
}
