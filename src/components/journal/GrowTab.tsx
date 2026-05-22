import React from 'react'
import { areaColor } from '../../lib/areaColor'
import { updateCopingCard } from '../../data/db'
import type { CopingCard, CopingCategory, Screen } from '../../types'
import { QuoteCard, GROW_QUOTES, todayQuote, CAT_HUE, CAT_LABEL, CAT_EMOJI } from './shared'

interface Props {
  cards: CopingCard[]
  navigate: (s: Screen) => void
  isDark: boolean
}

export function GrowTab({ cards, navigate, isDark }: Props) {
  const categories = Object.keys(CAT_HUE) as CopingCategory[]

  const byCategory: Record<CopingCategory, CopingCard[]> = {} as Record<CopingCategory, CopingCard[]>
  for (const cat of categories) byCategory[cat] = []
  for (const card of cards) {
    const c = card.category as CopingCategory
    if (byCategory[c]) byCategory[c].push(card)
  }

  const pinnedCard = cards.find(c => c.isPinned) ?? null
  const hasCards   = cards.length > 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--rule)' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Wellbeing · grow steadily</div>
        <div className="t-display t-italic" style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 6 }}>
          Your inner toolkit.
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Evidence-based strategies for resilience, calm, and staying grounded.
        </div>
      </div>

      <QuoteCard quote={todayQuote(GROW_QUOTES)} />

      {/* Pinned card */}
      {pinnedCard && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="eyebrow">📌 PINNED CARD</div>
            <button
              onClick={() => updateCopingCard(pinnedCard.id, { isPinned: false })}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                color: 'var(--ink-4)', padding: '3px 8px', borderRadius: 6,
                border: '1px solid var(--rule)', background: 'transparent',
              }}
            >
              Unpin
            </button>
          </div>
          <button
            onClick={() => navigate({ name: 'coping-cards' })}
            style={{
              width: '100%', textAlign: 'left',
              background: areaColor(CAT_HUE[pinnedCard.category as CopingCategory] ?? 220, 'bg', isDark),
              border: '1px solid var(--rule)', borderRadius: 14, padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 6, color: areaColor(CAT_HUE[pinnedCard.category as CopingCategory] ?? 220, 'fg', isDark) }}>
              {CAT_EMOJI[pinnedCard.category as CopingCategory]} {pinnedCard.title.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {pinnedCard.content.slice(0, 160)}{pinnedCard.content.length > 160 ? '…' : ''}
            </div>
          </button>
        </div>
      )}

      {/* Category grid */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="eyebrow">COPING CARDS</div>
          <button onClick={() => navigate({ name: 'coping-cards' })}
            style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            Manage →
          </button>
        </div>

        {hasCards ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {categories.map(cat => {
              const count = byCategory[cat].length
              if (count === 0) return null
              const hue = CAT_HUE[cat]
              return (
                <button key={cat} onClick={() => navigate({ name: 'coping-cards' })}
                  style={{ textAlign: 'left', background: areaColor(hue, 'bg', isDark), borderRadius: 12, padding: '12px 14px', border: '1px solid var(--rule)' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{CAT_EMOJI[cat]}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: areaColor(hue, 'fg', isDark) }}>{CAT_LABEL[cat]}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>{count} card{count !== 1 ? 's' : ''}</div>
                </button>
              )
            })}
          </div>
        ) : (
          <button onClick={() => navigate({ name: 'coping-cards' })}
            style={{ width: '100%', padding: '28px 20px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🫂</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>Build your toolkit</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Add coping cards — evidence-based strategies<br />for moments when you need support.
            </div>
          </button>
        )}
      </div>

      {/* Evidence-based pillars */}
      <div style={{ marginTop: 24, padding: '16px', background: 'var(--paper-2)', borderRadius: 14, border: '1px solid var(--rule)' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>EVIDENCE-BASED PILLARS</div>
        {[
          { emoji: '🧠', title: 'Notice your thoughts',     sub: 'Observe patterns without judgement. Thoughts are not facts.' },
          { emoji: '🌱', title: 'Take small steps',         sub: 'Behaviour change compounds slowly. One action at a time.' },
          { emoji: '🫂', title: 'Practice self-compassion', sub: 'Treat yourself as you would a trusted friend.' },
          { emoji: '⚓', title: 'Stay grounded',            sub: 'Return to your senses when overwhelmed. You\'re here, now.' },
        ].map((p, i, arr) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--rule)' : 'none' }}>
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.4 }}>{p.emoji}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55 }}>{p.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
