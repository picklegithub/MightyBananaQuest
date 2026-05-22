import React, { useState } from 'react'
import { Icons } from '../ui/Icons'
import { displayRange } from './shared'
import type { WeeklyReview } from '../../types'

interface Props {
  reviews: WeeklyReview[]
}

export function HistoryView({ reviews }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const completed = reviews
    .filter(r => r.completedAt)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  if (completed.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-4)' }}>
        <Icons.journal size={40} style={{ display: 'block', margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>NO REVIEWS YET</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
          Completed reviews appear here.<br />Your first one will be worth the ten minutes.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 44 }}>
      {completed.map(r => {
        const isOpen = expanded.has(r.id)
        return (
          <div key={r.id} style={{
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <button onClick={() => toggle(r.id)} style={{
              width: '100%', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: isOpen ? '1px solid var(--rule)' : 'none',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div className="t-display" style={{ fontSize: 14, marginBottom: 3 }}>
                  {displayRange(r.weekStart, r.weekEnd)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
                  {r.tasksCompleted} tasks · {r.xpGained} XP · {r.journalDays}d journal
                </div>
              </div>
              <Icons.arrow size={14} style={{
                color: 'var(--ink-4)',
                transform: isOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform .2s',
              }} />
            </button>

            {isOpen && (
              <div style={{ padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {r.wins.some(Boolean) && (
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Wins</div>
                    {r.wins.filter(Boolean).map((w, i) => (
                      <div key={i} style={{
                        fontSize: 13, color: 'var(--ink-2)', marginBottom: 4,
                        paddingLeft: 4, lineHeight: 1.5,
                      }}>
                        · {w}
                      </div>
                    ))}
                  </div>
                )}
                {r.nextWeekThing && (
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>Commitment</div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 14,
                      fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.55,
                    }}>
                      "{r.nextWeekThing}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
