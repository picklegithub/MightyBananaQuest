import React from 'react'

interface Props {
  wins:             [string, string, string]
  onWinChange:      (i: 0 | 1 | 2, v: string) => void
  nextThing:        string
  onNextChange:     (v: string) => void
  prevCommitment?:  string
}

const WIN_PLACEHOLDERS = [
  "A task you're proud of finishing…",
  "A moment you showed up when it was hard…",
  "Something small that still counted…",
]

export function PromptsStep({ wins, onWinChange, nextThing, onNextChange, prevCommitment }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Wins */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Three wins</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
            Celebrate before you analyse — both big and small count.
          </p>
        </div>
        {([0, 1, 2] as const).map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)',
              paddingTop: 15, flexShrink: 0, width: 16, textAlign: 'right',
            }}>
              {i + 1}
            </span>
            <input
              value={wins[i]}
              onChange={e => onWinChange(i, e.target.value)}
              placeholder={WIN_PLACEHOLDERS[i]}
              style={{
                flex: 1, padding: '12px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 10, fontSize: 14, color: 'var(--ink)', lineHeight: '1.5',
              }}
            />
          </div>
        ))}
      </div>

      {/* Commitment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>One thing next week</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
            The non-urgent thing that actually matters — protect it before it becomes a fire.
          </p>
        </div>

        {prevCommitment && (
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
              color: 'var(--ink-4)', marginBottom: 6,
            }}>
              LAST WEEK YOU COMMITTED TO
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic',
              color: 'var(--ink-2)', lineHeight: 1.6,
            }}>
              "{prevCommitment}"
            </div>
            <button
              onClick={() => onNextChange(prevCommitment)}
              style={{
                marginTop: 8, padding: '5px 10px', borderRadius: 8,
                background: 'transparent', border: '1px solid var(--rule)',
                fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)',
              }}
            >
              Carry forward →
            </button>
          </div>
        )}

        <textarea
          value={nextThing}
          onChange={e => onNextChange(e.target.value)}
          placeholder="Next week I will…"
          rows={3}
          style={{
            width: '100%', padding: '14px',
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
            borderRadius: 12, fontSize: 15, color: 'var(--ink)',
            lineHeight: '1.65', resize: 'none',
          }}
        />
      </div>
    </div>
  )
}
