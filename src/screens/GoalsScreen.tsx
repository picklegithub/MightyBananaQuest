import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addGoal } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen } from '../types'

interface Props { navigate: (s: Screen) => void; back?: () => void; onAddTask?: () => void }

const HORIZONS = ['4 weeks', '12 weeks', '6 months', '1 year', 'Ongoing']

export const GoalsScreen = ({ navigate, back }: Props) => {
  const goals    = useLiveQuery(() => db.goals.toArray(), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('main'), [])

  const [adding, setAdding] = useState(false)
  const [draft, setDraft]   = useState({ title: '', area: '', horizon: '12 weeks', why: '' })

  if (!goals || !allTasks) return null

  const defaultArea = cats[0]?.id ?? ''

  const openAdd = () => {
    setDraft({ title: '', area: defaultArea, horizon: '12 weeks', why: '' })
    setAdding(true)
  }

  const submit = async () => {
    if (!draft.title.trim()) return
    await addGoal({
      id:       `g${Date.now()}`,
      title:    draft.title.trim(),
      area:     draft.area || defaultArea,
      horizon:  draft.horizon,
      why:      draft.why.trim(),
      progress: 0,
      linked:   [],
    })
    setDraft({ title: '', area: '', horizon: '12 weeks', why: '' })
    setAdding(false)
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Goals"
        back={back}
        rightActions={<>
          <ThemeToggle />
          <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
            <Icons.settings size={20} />
          </button>
        </>}
        footer={
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>IN MOTION</span>
              <span>{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${goals.length > 0 ? Math.round(goals.reduce((sum, g) => { const linked = allTasks.filter(t => g.linked.includes(t.id)); const p = linked.length > 0 ? linked.filter(t => t.done).length / linked.length : g.progress; return sum + p }, 0) / goals.length * 100) : 0}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        }
      />

      <div className="screen-scroll" style={{ paddingBottom: 48 }}>

        {/* ── Editorial header ── */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Goals · begin with the end in mind</div>
          <div className="t-display t-italic" style={{ fontSize: 20, lineHeight: 1.3, marginBottom: 6 }}>
            A goal lives above the tasks.
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Link any task to one — your daily work compounds toward something.
          </div>
        </div>

        {/* Goal list */}
        <div style={{ padding: '10px 20px 0' }}>

          {/* Empty state */}
          {goals.length === 0 && !adding && (
            <div style={{ padding: '20px 0 8px', textAlign: 'center' }}>
              <div className="t-display t-italic" style={{ fontSize: 18, color: 'var(--ink-3)' }}>
                No goals yet.
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
                Set your first to start compounding.
              </div>
            </div>
          )}

          {/* Goals */}
          {goals.map(g => {
            const cat      = cats.find(c => c.id === g.area)
            const CatIcon  = cat?.icon ? (Icons as Record<string, any>)[cat.icon] : null
            const linked   = allTasks.filter(t => g.linked.includes(t.id))
            const progress = linked.length > 0
              ? linked.filter(t => t.done).length / linked.length
              : g.progress

            return (
              <div
                key={g.id}
                style={{ padding: '18px 0', borderBottom: '1px solid var(--rule)', cursor: 'pointer' }}
                onClick={() => navigate({ name: 'goal', goalId: g.id })}
              >
                {/* Area + horizon eyebrow */}
                <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {CatIcon && <CatIcon size={11} />}
                  {cat?.name ?? g.area} · {g.horizon}
                </div>

                {/* Title */}
                <div className="t-display" style={{ fontSize: 22, lineHeight: 1.2, marginTop: 6 }}>
                  {g.title}
                </div>

                {/* Why — italic display */}
                {g.why && (
                  <div className="t-display t-italic" style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45 }}>
                    "{g.why}"
                  </div>
                )}

                {/* Progress bar */}
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--paper-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.round(progress * 100)}%`, height: '100%',
                      background: 'var(--accent)', borderRadius: 2, transition: 'width .4s',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', minWidth: 30, textAlign: 'right' }}>
                    {Math.round(progress * 100)}%
                  </span>
                </div>

                {/* Linked tasks preview */}
                {linked.length > 0 && (
                  <div style={{ marginTop: 12, paddingLeft: 10, borderLeft: '2px solid var(--rule)' }}>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>
                      Linked tasks · {linked.filter(t => t.done).length}/{linked.length}
                    </div>
                    {linked.slice(0, 3).map(t => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                        fontSize: 13,
                        color: t.done ? 'var(--ink-3)' : 'var(--ink)',
                        textDecoration: t.done ? 'line-through' : 'none',
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                          background: t.done ? 'var(--accent)' : 'var(--ink-3)',
                        }} />
                        {t.title}
                      </div>
                    ))}
                    {linked.length > 3 && (
                      <div style={{
                        fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 3,
                      }}>
                        +{linked.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Inline add form or dashed button */}
          {!adding ? (
            <button onClick={openAdd} style={{
              width: '100%', marginTop: goals.length > 0 ? 16 : 8, padding: '14px',
              borderRadius: 14, background: 'transparent',
              border: '1px dashed var(--rule)', color: 'var(--ink-2)',
              fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icons.plus size={14} /> Set a new goal
            </button>
          ) : (
            <div style={{
              marginTop: 16, padding: 18, borderRadius: 14,
              background: 'var(--paper-2)', border: '1px solid var(--ink)',
            }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>New goal</div>

              <input
                autoFocus
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
                placeholder="What does success look like?"
                style={{
                  width: '100%', border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', padding: 0,
                }}
              />

              <input
                value={draft.why}
                onChange={e => setDraft({ ...draft, why: e.target.value })}
                placeholder="Why does this matter?"
                style={{
                  width: '100%', marginTop: 8, border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14,
                  color: 'var(--ink-2)', padding: 0,
                }}
              />

              {/* Area pills */}
              <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cats.map(c => {
                  const on = draft.area === c.id
                  return (
                    <button key={c.id} onClick={() => setDraft({ ...draft, area: c.id })} style={{
                      padding: '6px 10px', borderRadius: 999, fontSize: 11,
                      background: on ? 'var(--ink)' : 'transparent',
                      color: on ? 'var(--paper)' : 'var(--ink-2)',
                      border: '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                    }}>
                      {c.name}
                    </button>
                  )
                })}
              </div>

              {/* Horizon pills */}
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {HORIZONS.map(h => {
                  const on = draft.horizon === h
                  return (
                    <button key={h} onClick={() => setDraft({ ...draft, horizon: h })} style={{
                      padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)',
                      background: on ? 'var(--paper-3)' : 'transparent',
                      color: on ? 'var(--ink)' : 'var(--ink-3)',
                      border: '1px solid var(--rule)',
                    }}>
                      {h}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setAdding(false)}
                  style={{ padding: '8px 14px', fontSize: 12, color: 'var(--ink-3)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!draft.title.trim()}
                  style={{
                    padding: '8px 18px', borderRadius: 999,
                    background: 'var(--accent)', color: 'var(--paper)',
                    fontSize: 12, fontWeight: 500,
                    opacity: draft.title.trim() ? 1 : 0.4,
                  }}
                >
                  Set goal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Motivational quote */}
        <div style={{ margin: '24px 20px 0', padding: 18, borderRadius: 14, background: 'var(--accent-soft)' }}>
          <div className="t-display t-italic" style={{ fontSize: 18, lineHeight: 1.45 }}>
            "People don't decide their futures, they decide their habits.
            Their habits decide their futures."
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)', marginTop: 10 }}>
            — F. M. ALEXANDER
          </div>
        </div>

      </div>
    </div>
  )
}
