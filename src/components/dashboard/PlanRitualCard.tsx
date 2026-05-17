import React from 'react'
import { Icons } from '../ui/Icons'
import type { Screen, DailyPlan } from '../../types'

interface Props {
  plan: DailyPlan | null
  navigate: (s: Screen) => void
}

export function PlanRitualCard({ plan, navigate }: Props) {
  const isComplete = plan !== null && plan.completedAt !== null
  const picked     = plan?.pickedIds.length ?? 0
  const top3       = plan?.top3Ids.length ?? 0

  return (
    <div style={{ padding: '12px 20px 0' }}>
      <button
        onClick={() => navigate({ name: 'daily-plan' })}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12, textAlign: 'left',
          background: isComplete ? 'var(--paper-2)' : 'var(--accent-soft)',
          border: `1px solid ${isComplete ? 'var(--rule)' : 'var(--accent)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: isComplete ? 'var(--paper-3)' : 'var(--accent-soft)',
          color: isComplete ? 'var(--ink-3)' : 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.sun size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isComplete ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Day planned ✓</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 1 }}>
                {top3} pinned · {picked} tasks picked · tap to re-plan
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Plan your day</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.04em', marginTop: 1 }}>
                tap to run the morning ritual
              </div>
            </>
          )}
        </div>
        <Icons.arrow size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      </button>
    </div>
  )
}
