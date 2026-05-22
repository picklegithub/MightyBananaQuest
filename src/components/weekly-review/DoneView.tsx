import React, { useState } from 'react'
import { Icons } from '../ui/Icons'
import { displayRange, PULSE_OPTIONS } from './shared'
import type { WeeklyReview, Goal } from '../../types'

interface Props {
  review:    WeeklyReview
  onHistory: () => void
  goals:     Goal[]
  onShare?:  () => Promise<string>   // generates token, returns share URL
  onRevoke?: () => Promise<void>
}

export function DoneView({ review, onHistory, goals, onShare, onRevoke }: Props) {
  const [sharing, setSharing] = useState(false)
  const [copied,  setCopied]  = useState(false)

  async function handleShare() {
    if (!onShare) return
    setSharing(true)
    try {
      const url = await onShare()
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } finally {
      setSharing(false)
    }
  }

  async function handleRevoke() {
    if (!onRevoke) return
    setSharing(true)
    try { await onRevoke() } finally { setSharing(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 44 }}>
      {/* Celebration header */}
      <div style={{
        padding: '28px 20px 24px', borderRadius: 18,
        background: 'var(--ink)', color: 'var(--paper)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🎯</div>
        <div className="t-display" style={{ fontSize: 22, marginBottom: 6 }}>Week reviewed</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.45, letterSpacing: '0.12em' }}>
          {displayRange(review.weekStart, review.weekEnd).toUpperCase()}
        </div>
        <div style={{
          marginTop: 16,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '7px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
        }}>
          <Icons.bolt size={12} /> +15 XP REFLECTION BONUS
        </div>
      </div>

      {/* Stats summary */}
      <div style={{
        padding: '16px', borderRadius: 14,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
      }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>The numbers</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Tasks',   value: review.tasksCompleted },
            { label: 'XP',      value: review.xpGained       },
            { label: 'Journal', value: `${review.journalDays}d` },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
                {s.value}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wins */}
      {review.wins.some(Boolean) && (
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Wins this week</div>
          {review.wins.filter(Boolean).map((win, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, paddingTop: 1 }}>
                <Icons.check size={14} sw={2.5} />
              </span>
              <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{win}</span>
            </div>
          ))}
        </div>
      )}

      {/* Goal pulse summary */}
      {review.goalPulse.length > 0 && (
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Goals pulse</div>
          {review.goalPulse.map(p => {
            const opt  = PULSE_OPTIONS.find(o => o.status === p.status)
            const goal = goals.find(g => g.id === p.goalId)
            return (
              <div key={p.goalId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{opt?.emoji}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, lineHeight: 1.4 }}>
                  {goal?.title ?? p.goalId}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--ink-4)' }}>
                  {opt?.label.toUpperCase() ?? p.status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Next week commitment */}
      {review.nextWeekThing && (
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Next week's commitment</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic',
            color: 'var(--ink)', lineHeight: 1.6,
          }}>
            "{review.nextWeekThing}"
          </div>
        </div>
      )}

      {/* Share */}
      {onShare && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              flex: 1, padding: '12px', borderRadius: 12,
              background: review.shareToken ? 'var(--paper-2)' : 'var(--ink)',
              color: review.shareToken ? 'var(--ink)' : 'var(--paper)',
              border: review.shareToken ? '1px solid var(--rule)' : 'none',
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em',
              opacity: sharing ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Icons.link size={13} />
            {sharing ? 'Working…' : copied ? 'Copied!' : review.shareToken ? 'Copy share link' : 'Share this review'}
          </button>
          {review.shareToken && onRevoke && (
            <button
              onClick={handleRevoke}
              disabled={sharing}
              style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--destructive-fg)',
                opacity: sharing ? 0.6 : 1,
              }}
            >
              Revoke
            </button>
          )}
        </div>
      )}

      <button onClick={onHistory} style={{
        padding: '14px', borderRadius: 12, width: '100%',
        background: 'transparent', border: '1px solid var(--rule)',
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--ink-3)', letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Icons.list size={14} /> VIEW REVIEW HISTORY
      </button>
    </div>
  )
}
