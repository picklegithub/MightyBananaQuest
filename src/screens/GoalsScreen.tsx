import { makeId } from '../lib/makeId'
import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addGoal } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { HeroBar } from '../components/layout/HeroBar'
import type { Screen } from '../types'
import { useNav } from '../lib/navContext'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props { navigate?: (s: Screen) => void; back?: () => void; onAddTask?: () => void }

const HORIZONS = ['4 weeks', '12 weeks', '6 months', '1 year', 'Ongoing']

export const GoalsScreen = ({ navigate: navProp, back: backProp }: Props) => {
  const { navigate: ctxNavigate, back: ctxBack } = useNav()
  const navigate = navProp ?? ctxNavigate
  const back     = backProp ?? ctxBack
  const goals    = useLiveQuery(() => db.goals.toArray(), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [])
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get(1), [])

  const isColorful = useIsColorful()
  const isDark     = useIsDark()

  const [adding, setAdding]           = useState(false)
  const [draft, setDraft]             = useState({ title: '', area: '', horizon: '12 weeks', why: '' })
  const [statusFilter, setStatusFilter] = useState<'active' | 'achieved' | 'dropped'>('active')

  if (!goals || !allTasks) return null

  const defaultArea = cats[0]?.id ?? ''

  const openAdd = () => {
    setDraft({ title: '', area: defaultArea, horizon: '12 weeks', why: '' })
    setAdding(true)
  }

  const submit = async () => {
    if (!draft.title.trim()) return
    await addGoal({
      id:       makeId(),
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

  const activeGoals   = goals.filter(g => !g.status || g.status === 'active')
  const filteredGoals = goals.filter(g => {
    if (statusFilter === 'active') return !g.status || g.status === 'active'
    return g.status === statusFilter
  })

  return (
    <div className="screen">
      <ScreenHeader
        title="Goals"
        back={back}
        icon={<Icons.target size={22} />}
        footer={
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>IN MOTION</span>
              <span>{activeGoals.length} {activeGoals.length === 1 ? 'goal' : 'goals'}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${activeGoals.length > 0 ? Math.round(activeGoals.reduce((sum, g) => { const linked = allTasks.filter(t => g.linked.includes(t.id) || t.goalId === g.id); const p = linked.length > 0 ? linked.filter(t => t.done).length / linked.length : g.progress; return sum + p }, 0) / activeGoals.length * 100) : 0}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        }
      />

      {/* HeroBar — goals at-a-glance */}
      {(() => {
        const active   = activeGoals.length
        const onTrack  = activeGoals.filter(g => {
          const linked = allTasks.filter(t => g.linked.includes(t.id) || t.goalId === g.id)
          const prog   = linked.length > 0 ? linked.filter(t => t.done).length / linked.length : g.progress
          return prog >= 0.5
        }).length
        const atRisk   = active - onTrack
        return (
          <HeroBar stats={[
            { label: 'Active', value: active },
            { label: 'On track', value: onTrack, tone: onTrack > 0 ? 'success' : 'default' },
            { label: 'At risk', value: atRisk, tone: atRisk > 0 ? 'warning' : 'default' },
          ]} />
        )
      })()}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 14px', overflowX: 'auto' }}>
        {(['active', 'achieved', 'dropped'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r-pill)', border: 'none',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
              background: statusFilter === s ? 'var(--accent)' : 'var(--paper-2)',
              color: statusFilter === s ? 'var(--paper)' : 'var(--ink-2)',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

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
          {filteredGoals.length === 0 && !adding && (
            <div style={{ padding: '32px 0 8px', textAlign: 'center' }}>
              <div className="t-display t-italic" style={{ fontSize: 18, color: 'var(--ink-3)' }}>
                {statusFilter === 'active' ? 'No goals yet.' : `No ${statusFilter} goals.`}
              </div>
              {statusFilter === 'active' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, marginBottom: 20 }}>
                    Set your first to start compounding.
                  </div>
                  <button
                    onClick={() => setAdding(true)}
                    style={{
                      padding: '11px 24px', borderRadius: 12,
                      background: 'var(--ink)', color: 'var(--paper)',
                      fontSize: 14, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <Icons.plus size={16} /> Add first goal
                  </button>
                </>
              )}
            </div>
          )}

          {/* Goals */}
          {filteredGoals.map(g => {
            const cat      = cats.find(c => c.id === g.area)
            const CatIcon  = cat?.icon ? (Icons as Record<string, any>)[cat.icon] : null
            const hue      = isColorful && cat?.hue !== undefined ? cat.hue : undefined
            const linked   = allTasks.filter(t => g.linked.includes(t.id) || t.goalId === g.id)
            const progress = linked.length > 0
              ? linked.filter(t => t.done).length / linked.length
              : g.progress
            const linkedHabits = allHabits.filter(h => h.goalId === g.id && !h.isArchived)
            const isAchieved   = g.status === 'achieved'

            // Pace indicator — only when targetDate + createdAt set + goal is active
            let pace: 'ahead' | 'on-track' | 'behind' | null = null
            if (g.targetDate && g.createdAt && !isAchieved && (!g.status || g.status === 'active')) {
              const now       = Date.now()
              const target    = new Date(g.targetDate).getTime()
              if (target > now) {
                const totalTime = target - g.createdAt
                const elapsed   = now - g.createdAt
                const expected  = totalTime > 0 ? elapsed / totalTime : 0
                if (progress >= expected + 0.1)      pace = 'ahead'
                else if (progress >= expected - 0.1) pace = 'on-track'
                else                                 pace = 'behind'
              }
            }

            return (
              <div
                key={g.id}
                style={{
                  position: 'relative',
                  padding: '18px 0 18px 12px',
                  borderBottom: '1px solid var(--rule)',
                  borderLeft: hue !== undefined
                    ? `3px solid ${areaColor(hue, 'fg', isDark)}`
                    : '3px solid var(--rule)',
                  cursor: 'pointer',
                  opacity: g.status === 'dropped' ? 0.6 : 1,
                }}
                onClick={() => navigate({ name: 'goal', goalId: g.id })}
              >
                {/* Achieved badge */}
                {isAchieved && (
                  <span style={{
                    position: 'absolute', top: 10, right: 0,
                    background: 'var(--accent)', color: 'var(--paper)',
                    borderRadius: 'var(--r-pill)', padding: '2px 8px',
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                  }}>ACHIEVED</span>
                )}

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

                {/* Stats row: tasks + habits + pace */}
                <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {linked.length > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                      {linked.filter(t => t.done).length}/{linked.length} task{linked.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {linkedHabits.length > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                      {linkedHabits.length} habit{linkedHabits.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pace && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                      padding: '2px 8px', borderRadius: 999,
                      background: pace === 'ahead' ? 'var(--accent-soft)'
                                : pace === 'on-track' ? 'var(--accent-soft)'
                                : 'var(--warn-soft)',
                      color: pace === 'behind' ? 'var(--warn)' : 'var(--accent)',
                    }}>
                      {pace === 'ahead' ? '↑ Ahead' : pace === 'on-track' ? '✓ On track' : '↓ Behind'}
                    </span>
                  )}
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

          {/* Inline add form or dashed button — only on active filter */}
          {statusFilter === 'active' && (
            !adding ? (
              <button onClick={openAdd} style={{
                width: '100%', marginTop: filteredGoals.length > 0 ? 16 : 8, padding: '14px',
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
            )
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
