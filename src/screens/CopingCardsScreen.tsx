import { makeId } from '../lib/makeId'
import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAllCopingCards, addCopingCard, deleteCopingCard, pinCopingCard, updateCopingCard } from '../data/db'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'
import type { Screen, CopingCard, CopingCategory } from '../types'
import { useNav } from '../lib/navContext'
import { QuoteCard, GROW_QUOTES, todayQuote, CAT_LABEL, CAT_EMOJI } from '../components/journal/shared'

interface Props {
  navigate?: (s: Screen) => void
  back?: () => void
}

const CATEGORIES: { key: CopingCategory | 'all'; label: string }[] = [
  { key: 'all',              label: 'All'            },
  { key: 'anxiety',          label: 'Anxiety'        },
  { key: 'social',           label: 'Social'         },
  { key: 'low-mood',         label: 'Low mood'       },
  { key: 'grounding',        label: 'Grounding'      },
  { key: 'mindfulness',      label: 'Mindfulness'    },
  { key: 'self-compassion',  label: 'Self-compassion'},
  { key: 'values',           label: 'Values'         },
  { key: 'crisis',           label: 'Crisis'         },
]

const CAT_HUE: Record<CopingCategory, number> = {
  'anxiety':         275,
  'social':          28,
  'low-mood':        220,
  'grounding':       145,
  'mindfulness':     192,
  'self-compassion': 340,
  'values':          45,
  'crisis':          5,
}

const CAT_ORDER: CopingCategory[] = ['anxiety', 'social', 'low-mood', 'grounding', 'mindfulness', 'self-compassion', 'values', 'crisis']

// ── Shared body — usable standalone or embedded inside another screen ─────────
export function CopingCardsContent() {
  const allCards = useLiveQuery(() => getAllCopingCards(), []) ?? []
  const isDark   = useIsDark()
  const [activeCategory, setActiveCategory] = useState<CopingCategory | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CopingCard | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editCard, setEditCard] = useState<CopingCard | null>(null)

  const filtered = activeCategory === 'all'
    ? allCards
    : allCards.filter(c => c.category === activeCategory)

  const grouped = CAT_ORDER.reduce<Record<CopingCategory, CopingCard[]>>((acc, cat) => {
    acc[cat] = filtered.filter(c => c.category === cat)
    return acc
  }, {} as Record<CopingCategory, CopingCard[]>)

  async function handlePin(card: CopingCard) {
    await pinCopingCard(card.id)
    setSelectedCard(null)
  }

  async function handleUnpin(card: CopingCard) {
    await updateCopingCard(card.id, { isPinned: false })
    setSelectedCard(null)
  }

  async function handleDelete(card: CopingCard) {
    await deleteCopingCard(card.id)
    setSelectedCard(null)
  }

  return (
    <>
      {/* Category filter pills + add button */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px 12px',
        borderBottom: '1px solid var(--rule)', scrollbarWidth: 'none',
        alignItems: 'center', flexShrink: 0,
      }}>
        {CATEGORIES.map(c => {
          const active = activeCategory === c.key
          return (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              style={{
                flexShrink: 0, padding: '5px 13px', borderRadius: 20,
                fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                background: active ? 'var(--ink)' : 'var(--paper-2)',
                color: active ? 'var(--paper)' : 'var(--ink-2)',
                border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </button>
          )
        })}
        {/* Add button lives in the filter row so it's always visible */}
        <button
          onClick={() => { setEditCard(null); setShowAddSheet(true) }}
          style={{
            flexShrink: 0, marginLeft: 'auto',
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--paper)',
            fontSize: 20, fontWeight: 300, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Add card"
        >
          +
        </button>
      </div>

      {/* Card list */}
      <div className="screen-scroll" style={{ padding: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Grow header ── */}
        <div style={{ padding: '20px 18px 0' }}>
          <div style={{ paddingBottom: 18, borderBottom: '1px solid var(--rule)', marginBottom: 18 }}>
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
          {(() => {
            const pinned = allCards.find(c => c.isPinned)
            if (!pinned) return null
            return (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div className="eyebrow">📌 PINNED CARD</div>
                  <button
                    onClick={() => updateCopingCard(pinned.id, { isPinned: false })}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                      color: 'var(--ink-4)', padding: '3px 8px', borderRadius: 6,
                      border: '1px solid var(--rule)', background: 'transparent',
                    }}
                  >
                    Unpin
                  </button>
                </div>
                <div style={{
                  width: '100%', textAlign: 'left',
                  background: areaColor(CAT_HUE[pinned.category as CopingCategory] ?? 220, 'bg', isDark),
                  border: '1px solid var(--rule)', borderRadius: 14, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 6, color: areaColor(CAT_HUE[pinned.category as CopingCategory] ?? 220, 'fg', isDark) }}>
                    {CAT_EMOJI[pinned.category as CopingCategory]} {pinned.title.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                    {pinned.content.slice(0, 160)}{pinned.content.length > 160 ? '…' : ''}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        <div style={{ margin: '10px 0 4px', padding: '0 18px' }}>
          <div className="eyebrow">COPING CARDS</div>
        </div>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allCards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)', fontSize: 14 }}>
              No cards yet. Tap + to add one.
            </div>
          )}

          {CAT_ORDER.map(cat => {
            const cards = grouped[cat]
            if (!cards || cards.length === 0) return null
            const hue   = CAT_HUE[cat]
            const fgCol = areaColor(hue, 'fg', isDark)
            const bgCol = areaColor(hue, 'bg', isDark)
            const label = CATEGORIES.find(c => c.key === cat)?.label ?? cat
            return (
              <React.Fragment key={cat}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--ink-4)', marginTop: 6, padding: '0 2px',
                }}>
                  {label}
                </div>
                {cards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    style={{
                      background: 'var(--paper-2)', borderRadius: 14,
                      border: '1px solid var(--rule)', overflow: 'hidden',
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{ height: 3, background: fgCol }} />
                    <div style={{ padding: '12px 14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          padding: '3px 8px', borderRadius: 10,
                          background: bgCol, color: fgCol,
                        }}>
                          {label}
                        </span>
                        {card.isPinned && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                            📌 pinned
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>
                        {card.title}
                      </div>
                      <div style={{
                        fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {card.content}
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginTop: 10,
                        paddingTop: 8, borderTop: '1px solid var(--rule)',
                      }}>
                        <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                          {card.isDefault ? 'default' : '✏️ edited'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>›</span>
                      </div>
                    </div>
                  </button>
                ))}
              </React.Fragment>
            )
          })}
        </div>

        {/* Evidence-based pillars */}
        <div style={{ margin: '8px 16px 0', padding: '16px', background: 'var(--paper-2)', borderRadius: 14, border: '1px solid var(--rule)' }}>
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

      {/* Card detail sheet */}
      {selectedCard && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedCard(null) }}
        >
          <div
            style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
            </div>
            <div style={{ height: 4, background: areaColor(CAT_HUE[selectedCard.category], 'fg', isDark), marginTop: 14 }} />
            <div style={{ padding: '18px 20px 32px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
                textTransform: 'uppercase', padding: '3px 10px', borderRadius: 10,
                background: areaColor(CAT_HUE[selectedCard.category], 'bg', isDark),
                color: areaColor(CAT_HUE[selectedCard.category], 'fg', isDark),
                display: 'inline-block', marginBottom: 12,
              }}>
                {CATEGORIES.find(c => c.key === selectedCard.category)?.label}
              </span>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 14, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                {selectedCard.title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {selectedCard.content}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  onClick={() => setSelectedCard(null)}
                  style={{
                    flex: 1, padding: '13px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                    background: 'var(--paper-2)', color: 'var(--ink-2)',
                    border: '1px solid var(--rule)',
                  }}
                >
                  Close
                </button>
                {!selectedCard.isPinned && (
                  <button
                    onClick={() => handlePin(selectedCard)}
                    style={{
                      flex: 1, padding: '13px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                      background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)',
                    }}
                  >
                    📌 Pin to journal
                  </button>
                )}
                {selectedCard.isPinned && (
                  <button
                    onClick={() => handleUnpin(selectedCard)}
                    style={{
                      flex: 1, padding: '13px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                      background: 'var(--paper-2)', color: 'var(--ink-2)', border: '1px solid var(--rule)',
                    }}
                  >
                    Unpin
                  </button>
                )}
              </div>

              {!selectedCard.isDefault && (
                <button
                  onClick={() => handleDelete(selectedCard)}
                  style={{
                    width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
                    fontSize: 13, color: 'var(--danger, #d93025)',
                    background: 'transparent', border: '1px solid var(--rule)',
                  }}
                >
                  Delete card
                </button>
              )}

              {selectedCard.isDefault && (
                <button
                  onClick={() => { setEditCard(selectedCard); setShowAddSheet(true); setSelectedCard(null) }}
                  style={{
                    width: '100%', marginTop: 10, padding: '11px', borderRadius: 12,
                    fontSize: 13, color: 'var(--ink-2)',
                    background: 'transparent', border: '1px solid var(--rule)',
                  }}
                >
                  Edit &amp; save as my card
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit sheet */}
      {showAddSheet && (
        <CardEditSheet
          card={editCard}
          onClose={() => { setShowAddSheet(false); setEditCard(null) }}
        />
      )}
    </>
  )
}

// ── Standalone screen (direct nav to coping-cards route) ──────────────────────
export function CopingCardsScreen({ back: backProp }: Props) {
  const { back: ctxBack } = useNav()
  const back = backProp ?? ctxBack

  return (
    <div className="screen">
      <ScreenHeader title="Coping cards" back={back} />
      <CopingCardsContent />
    </div>
  )
}

// ── Add / Edit sheet ──────────────────────────────────────────────────────────
function CardEditSheet({ card, onClose }: { card: CopingCard | null; onClose: () => void }) {
  const [title,    setTitle]    = useState(card?.title ?? '')
  const [content,  setContent]  = useState(card?.content ?? '')
  const [category, setCategory] = useState<CopingCategory>(card?.category ?? 'anxiety')

  async function handleSave() {
    if (!title.trim() || !content.trim()) return
    await addCopingCard({
      id: makeId(),
      title: title.trim(),
      content: content.trim(),
      category,
      isDefault: false,
    })
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ flexShrink: 0, padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--rule)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>{card ? 'Edit card' : 'New card'}</h2>
            <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 20 }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Category</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key as CopingCategory)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 11,
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                    background: category === c.key ? 'var(--ink)' : 'var(--paper-2)',
                    color: category === c.key ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: category === c.key ? 'var(--ink)' : 'var(--rule)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Title</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="When I feel…"
              style={{
                width: '100%', padding: '12px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 15, color: 'var(--ink)',
              }}
            />
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Content</div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your coping statement in your own words…"
              rows={5}
              style={{
                width: '100%', padding: '12px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 14, resize: 'none', lineHeight: 1.6,
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--rule)' }}>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: title.trim() && content.trim() ? 'var(--ink)' : 'var(--paper-3)',
              color: title.trim() && content.trim() ? 'var(--paper)' : 'var(--ink-3)',
              fontSize: 15, fontWeight: 600,
            }}
          >
            Save card
          </button>
        </div>
      </div>
    </div>
  )
}
