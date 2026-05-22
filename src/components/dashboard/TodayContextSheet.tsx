import React from 'react'

interface Props {
  energy?: 1 | 2 | 3 | null
  mood?: 'steady' | 'tired' | 'charged' | null
  onClose: () => void
}

export function TodayContextSheet({ energy, mood, onClose }: Props) {
  const ENERGY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Okay', 3: 'Strong' }
  const ENERGY_EMOJI:  Record<number, string> = { 1: '🌱',  2: '☀️',   3: '⚡' }
  const MOOD_LABELS = { steady: 'Steady', tired: 'Tired', charged: 'Charged' }
  const MOOD_EMOJI  = { steady: '😌', tired: '😴', charged: '⚡' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--paper)', borderRadius: '20px 20px 0 0',
        padding: `24px 24px calc(32px + env(safe-area-inset-bottom))`,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)', margin: '0 auto 20px' }} />
        <div className="eyebrow" style={{ marginBottom: 16 }}>Today's context</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            <span style={{ fontSize: 20 }}>{energy ? ENERGY_EMOJI[energy] : '—'}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 3 }}>YESTERDAY'S ENERGY</div>
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{energy ? ENERGY_LABELS[energy] : 'Not logged'}</div>
            </div>
          </div>
          {mood && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <span style={{ fontSize: 20 }}>{MOOD_EMOJI[mood]}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 3 }}>TODAY'S MOOD</div>
                <div style={{ fontSize: 14, color: 'var(--ink)' }}>{MOOD_LABELS[mood]}</div>
              </div>
            </div>
          )}
        </div>
        {(mood === 'tired' || mood === 'charged') && (
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 12,
            background: mood === 'charged' ? 'var(--accent-soft)' : 'var(--paper-2)',
            border: `1px solid ${mood === 'charged' ? 'var(--accent)' : 'var(--rule)'}`,
            fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6,
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
          }}>
            {mood === 'tired'
              ? 'A lighter day is still progress. Protect your energy.'
              : 'High energy today. Good time for deep work or that task you\'ve been avoiding.'}
          </div>
        )}
      </div>
    </>
  )
}
