import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icons } from '../components/ui/Icons'
import { displayRange, PULSE_OPTIONS } from '../components/weekly-review/shared'
import type { WeeklyReview } from '../types'

interface Props { token: string }

export function SharedReviewScreen({ token }: Props) {
  const [review,  setReview]  = useState<WeeklyReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } =
          await (supabase.rpc('get_shared_review', { p_token: token }) as unknown as Promise<{ data: unknown[] | null; error: unknown }>)
        if (error || !data || data.length === 0) { setNotFound(true); setLoading(false); return }
        const row = data[0] as Record<string, unknown>
        setReview({
          id:             row.id as string,
          weekStart:      (row.week_start as string) ?? '',
          weekEnd:        (row.week_end as string) ?? '',
          tasksCompleted: (row.tasks_completed as number) ?? 0,
          xpGained:       (row.xp_gained as number) ?? 0,
          journalDays:    (row.journal_days as number) ?? 0,
          quadCounts:     (row.quad_counts as WeeklyReview['quadCounts']) ?? { q1: 0, q2: 0, q3: 0, q4: 0 },
          wins:           (row.wins as string[]) ?? [],
          goalPulse:      (row.goal_pulse as WeeklyReview['goalPulse']) ?? [],
          nextWeekThing:  (row.next_week_thing as string) ?? '',
          completedAt:    (row.completed_at as number | undefined) ?? undefined,
        })
        setLoading(false)
      } catch { setNotFound(true); setLoading(false) }
    })()
  }, [token])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--ink-4)', letterSpacing: '0.08em',
      }}>
        Loading review…
      </div>
    )
  }

  if (notFound || !review) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        background: 'var(--paper)', padding: 32,
      }}>
        <Icons.close size={32} stroke="var(--ink-4)" />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>
          This review link has been revoked or doesn't exist.
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px 64px', background: 'var(--paper)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', marginBottom: 4 }}>
          WEEKLY REVIEW · READ ONLY
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
          {displayRange(review.weekStart, review.weekEnd)}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        marginBottom: 20,
      }}>
        {[
          { label: 'Tasks',   value: review.tasksCompleted },
          { label: 'XP',      value: review.xpGained },
          { label: 'Journal', value: `${review.journalDays}d` },
        ].map(s => (
          <div key={s.label} style={{
            padding: '14px 10px', borderRadius: 12, textAlign: 'center',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
              {s.value}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
              {s.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Wins */}
      {review.wins.some(Boolean) && (
        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)', marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Wins</div>
          {review.wins.filter(Boolean).map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
              <Icons.check size={13} stroke="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Goal pulse */}
      {review.goalPulse.length > 0 && (
        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)', marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Goals pulse</div>
          {review.goalPulse.map(p => {
            const opt = PULSE_OPTIONS.find(o => o.status === p.status)
            return (
              <div key={p.goalId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{opt?.emoji}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                  {opt?.label.toUpperCase() ?? p.status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Commitment */}
      {review.nextWeekThing && (
        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule)', marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Next week's commitment</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.6 }}>
            "{review.nextWeekThing}"
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textAlign: 'center', marginTop: 32 }}>
        Shared via MightyBananaQuest
      </div>
    </div>
  )
}
