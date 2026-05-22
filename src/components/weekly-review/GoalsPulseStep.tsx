import React from 'react'
import { Icons } from '../ui/Icons'
import { useIsDark } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import { PULSE_OPTIONS } from './shared'
import type { Goal, GoalPulse, GoalPulseStatus } from '../../types'

interface Props {
  goals:    Goal[]
  pulse:    GoalPulse[]
  onChange: (goalId: string, status: GoalPulseStatus) => void
  cats:     { id: string; hue: number }[]
}

export function GoalsPulseStep({ goals, pulse, onChange, cats }: Props) {
  const isDark = useIsDark()

  function getStatus(goalId: string): GoalPulseStatus | undefined {
    return pulse.find(p => p.goalId === goalId)?.status
  }
  function getHue(area: string): number {
    return cats.find(c => c.id === area)?.hue ?? 200
  }

  if (goals.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Honest check-in</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
            No active goals yet — set some in the Goals tab to track them here each week.
          </p>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)' }}>
          <Icons.target size={44} style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>NO GOALS YET</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Honest check-in</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
          A quick pulse on each goal. Be honest — "pausing" is a valid strategy, not a failure.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map(goal => {
          const hue     = getHue(goal.area)
          const current = getStatus(goal.id)

          return (
            <div key={goal.id} style={{
              padding: '16px', borderRadius: 14,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: areaColor(hue, 'fg', isDark),
                }} />
                <div style={{ fontSize: 14, fontWeight: 500, flex: 1, lineHeight: 1.3 }}>{goal.title}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: areaColor(hue, 'fg', isDark), letterSpacing: '0.06em',
                }}>
                  {Math.round(goal.progress * 100)}%
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {PULSE_OPTIONS.map(opt => {
                  const selected = current === opt.status
                  return (
                    <button
                      key={opt.status}
                      onClick={() => onChange(goal.id, opt.status)}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 10,
                        background: selected ? 'var(--ink)' : 'var(--paper)',
                        color:      selected ? 'var(--paper)' : 'var(--ink-3)',
                        border: `1px solid ${selected ? 'var(--ink)' : 'var(--rule)'}`,
                        transition: 'all .15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{opt.emoji}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.04em' }}>
                        {opt.status === 'on-track' ? 'ON TRACK' : opt.status === 'needs-attention' ? 'ATTENTION' : 'PAUSING'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
