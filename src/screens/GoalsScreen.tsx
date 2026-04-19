import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { SectionHeader } from '../components/ui'
import type { Screen, Goal } from '../types'

interface Props { navigate: (s: Screen) => void }

const AREA_COLORS: Record<string, { hue: number; label: string }> = {
  health:   { hue: 145, label: 'Health' },
  finance:  { hue: 90,  label: 'Finance' },
  learning: { hue: 280, label: 'Learning' },
  family:   { hue: 15,  label: 'Family' },
  work:     { hue: 240, label: 'Work' },
  home:     { hue: 35,  label: 'Home' },
}

function ProgressRing({ progress, hue }: { progress: number; hue: number }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <svg width={64} height={64} style={{ flexShrink: 0 }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--rule)" strokeWidth={5} />
      <circle cx={32} cy={32} r={r} fill="none"
        stroke={`hsl(${hue}, 55%, 42%)`} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dashoffset .5s ease' }}
      />
      <text x={32} y={37} textAnchor="middle"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, fill: `hsl(${hue}, 55%, 38%)` }}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  )
}

export const GoalsScreen = ({ navigate }: Props) => {
  const goals = useLiveQuery(() => db.goals.toArray(), [])

  if (!goals) return null

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Long game</div>
            <h1 className="t-display" style={{ fontSize: 28 }}>Goals</h1>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            border: '1px solid var(--rule)', borderRadius: 20,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.04em',
          }}>
            <Icons.plus size={14} /> Add goal
          </button>
        </div>
      </div>

      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>
        {goals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Icons.target size={40} style={{ color: 'var(--ink-4)', margin: '0 auto 16px' }} />
            <div className="t-display" style={{ fontSize: 20, marginBottom: 8 }}>No goals yet</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Set your first goal to start tracking progress.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goals.map(goal => {
              const area = AREA_COLORS[goal.area] ?? { hue: 240, label: goal.area }
              return (
                <div key={goal.id} style={{
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  borderRadius: 16, padding: '16px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <ProgressRing progress={goal.progress} hue={area.hue} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 20, fontSize: 10,
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                        background: `hsl(${area.hue}, 40%, 92%)`,
                        color: `hsl(${area.hue}, 55%, 38%)`,
                      }}>
                        {area.label.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                        {goal.horizon}
                      </span>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, lineHeight: 1.3 }}>
                      {goal.title}
                    </div>

                    {goal.why && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 10 }}>
                        "{goal.why}"
                      </div>
                    )}

                    {/* Progress bar */}
                    <div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-3)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: `hsl(${area.hue}, 55%, 42%)`,
                          width: `${goal.progress * 100}%`,
                          transition: 'width .5s ease',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Stats footer */}
        {goals.length > 0 && (
          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            {[
              { label: 'Active', val: goals.length },
              { label: 'Avg progress', val: `${Math.round(goals.reduce((a,g) => a + g.progress, 0) / goals.length * 100)}%` },
              { label: 'On track', val: goals.filter(g => g.progress >= 0.5).length },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, padding: '14px 10px', background: 'var(--paper-2)',
                border: '1px solid var(--rule)', borderRadius: 12, textAlign: 'center',
              }}>
                <div className="t-display" style={{ fontSize: 22 }}>{s.val}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
