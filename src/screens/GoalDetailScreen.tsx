import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateGoal, deleteGoal, completeTask } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { AddTaskSheet } from '../components/AddTaskSheet'
import type { Screen, Task } from '../types'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props {
  goalId: string
  navigate: (s: Screen) => void
  back: () => void
}

const HORIZONS = ['4 weeks', '12 weeks', '6 months', '1 year', 'Ongoing']

function getHue(area: string, cats: { id: string; hue: number }[]) {
  return cats.find(c => c.id === area)?.hue
    ?? Math.abs(area.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360
}

export const GoalDetailScreen = ({ goalId, navigate, back }: Props) => {
  const goal       = useLiveQuery(() => db.goals.get(goalId), [goalId])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const allTasks   = useLiveQuery(() => db.tasks.toArray(), [])
  const isColorful = useIsColorful()
  const isDark     = useIsDark()

  const [editing,     setEditing]     = useState(false)
  const [editTitle,   setEditTitle]   = useState('')
  const [editWhy,     setEditWhy]     = useState('')
  const [editArea,    setEditArea]    = useState('')
  const [editHorizon, setEditHorizon] = useState('')
  const [showPicker,  setShowPicker]  = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)

  useEffect(() => {
    if (goal) {
      setEditTitle(goal.title)
      setEditWhy(goal.why ?? '')
      setEditArea(goal.area)
      setEditHorizon(goal.horizon)
    }
  }, [goal?.id])

  // Auto-sync progress from linked task completion
  const linkedKey = (goal && allTasks)
    ? allTasks.filter(t => goal.linked.includes(t.id)).map(t => `${t.id}:${t.done}`).join(',')
    : ''
  useEffect(() => {
    if (!goal || !allTasks) return
    const linked = allTasks.filter(t => goal.linked.includes(t.id))
    if (linked.length === 0) return
    // Granular rollup: sub-task completion counts for in-progress tasks
    const scores = linked.map(t => {
      if (t.done) return 1
      if (t.sub && t.sub.length > 0) return t.sub.filter(s => s.d).length / t.sub.length
      return 0
    })
    const computed = scores.reduce((a, b) => a + b, 0) / scores.length
    if (Math.abs(computed - goal.progress) > 0.005) updateGoal(goal.id, { progress: computed })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedKey, goal?.id, goal?.progress])

  if (!goal || !allTasks) return null

  const cats        = categories ?? []
  const cat         = cats.find(c => c.id === goal.area)
  const CatIcon     = cat?.icon ? (Icons as Record<string, any>)[cat.icon] : null
  const hue         = getHue(goal.area, cats)
  const goalColor   = isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'
  const linkedTasks = allTasks.filter(t => goal.linked.includes(t.id))
  const unlinked    = allTasks.filter(t => !goal.linked.includes(t.id) && !t.done)

  // Rollup: for tasks with sub-tasks, use sub-task completion as fractional progress.
  // For tasks without sub-tasks: 0 = incomplete, 1 = complete.
  const autoProgress = (() => {
    if (linkedTasks.length === 0) return goal.progress
    const scores = linkedTasks.map(t => {
      if (t.done) return 1
      if (t.sub && t.sub.length > 0) {
        return t.sub.filter(s => s.d).length / t.sub.length
      }
      return 0
    })
    return scores.reduce((a, b) => a + b, 0) / scores.length
  })()

  const saveEdit = async () => {
    await updateGoal(goal.id, {
      title:   editTitle.trim(),
      why:     editWhy.trim(),
      area:    editArea,
      horizon: editHorizon,
    })
    setEditing(false)
  }

  const linkTask = async (taskId: string) => {
    await updateGoal(goal.id, { linked: [...goal.linked, taskId] })
    setShowPicker(false)
  }

  const unlinkTask = async (taskId: string) => {
    await updateGoal(goal.id, { linked: goal.linked.filter(id => id !== taskId) })
  }

  return (
    <div className="screen">
      <ScreenHeader
        title={editing ? 'Edit goal' : goal.title}
        back={back}
        rightActions={
          <button
            onClick={() => setEditing(e => !e)}
            style={{ color: editing ? 'var(--accent)' : 'var(--ink-3)', padding: '4px 8px' }}
          >
            {editing ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }}>DONE</span>
            ) : (
              <Icons.edit size={18} />
            )}
          </button>
        }
      />

      <div className="screen-scroll" style={{ paddingBottom: 48 }}>

        {editing ? (
          /* ── Edit mode ── */
          <div style={{ padding: '4px 22px 0' }}>
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="What does success look like?"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)',
                padding: 0, lineHeight: 1.2,
              }}
            />

            <input
              value={editWhy}
              onChange={e => setEditWhy(e.target.value)}
              placeholder="Why this matters"
              style={{
                width: '100%', marginTop: 10, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)',
                padding: 0,
              }}
            />

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Area</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cats.map(c => {
                  const on = editArea === c.id
                  return (
                    <button key={c.id} onClick={() => setEditArea(c.id)} style={{
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
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Horizon</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {HORIZONS.map(h => {
                  const on = editHorizon === h
                  return (
                    <button key={h} onClick={() => setEditHorizon(h)} style={{
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
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={!editTitle.trim()} style={{
                flex: 1, padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 500,
                background: editTitle.trim() ? 'var(--ink)' : 'var(--paper-3)',
                color: editTitle.trim() ? 'var(--paper)' : 'var(--ink-3)',
              }}>
                Save changes
              </button>
              <button onClick={() => setEditing(false)} style={{
                padding: '13px 16px', borderRadius: 12, border: '1px solid var(--rule)',
                background: 'var(--paper-2)', color: 'var(--ink-2)', fontSize: 14,
              }}>
                Cancel
              </button>
            </div>

            {/* Delete zone */}
            <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
              {!confirmDel ? (
                <button
                  onClick={() => setConfirmDel(true)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)',
                    letterSpacing: '0.06em', padding: '8px 0',
                  }}
                >
                  Delete goal
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Remove this goal?</span>
                  <button onClick={() => { deleteGoal(goal.id); back() }} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12,
                    background: 'var(--warn)', color: '#fff', fontWeight: 500,
                  }}>
                    Delete
                  </button>
                  <button onClick={() => setConfirmDel(false)} style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            <div style={{ padding: '4px 22px 0' }}>

              {/* Category + horizon eyebrow */}
              <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {CatIcon && <CatIcon size={11} />}
                {cat?.name ?? goal.area} · {goal.horizon}
              </div>

              {/* Why — mission statement */}
              {goal.why ? (
                <div style={{ marginTop: 14, paddingLeft: 12, borderLeft: `2px solid ${goalColor}` }}>
                  <div className="t-display t-italic" style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    {goal.why}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditing(true)}
                  style={{
                    marginTop: 10, fontSize: 13, fontFamily: 'var(--font-sans)',
                    color: 'var(--ink-4)', cursor: 'pointer',
                  }}
                >
                  Add why this goal matters →
                </div>
              )}

              {/* Progress */}
              <div style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="eyebrow">Progress</div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: goalColor, fontWeight: 600 }}>
                    {Math.round(autoProgress * 100)}%
                    {linkedTasks.length > 0 && (
                      <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10, marginLeft: 6 }}>
                        {linkedTasks.filter(t => t.done).length}/{linkedTasks.length} tasks
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-3)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: goalColor,
                    width: `${Math.round(autoProgress * 100)}%`,
                    transition: 'width .4s ease',
                  }} />
                </div>
                {linkedTasks.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 6 }}>
                    Link tasks below to auto-track progress
                  </div>
                )}
              </div>
            </div>

            {/* Linked tasks */}
            <div style={{ padding: '24px 22px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: 12, borderBottom: '1px solid var(--rule)',
              }}>
                <div className="eyebrow">Linked tasks</div>
                {unlinked.length > 0 && (
                  <button onClick={() => setShowPicker(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--ink-2)', letterSpacing: '0.06em',
                  }}>
                    <Icons.plus size={12} /> LINK
                  </button>
                )}
              </div>

              {linkedTasks.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <div className="t-display t-italic" style={{ fontSize: 15, color: 'var(--ink-3)' }}>
                    No linked tasks yet.
                  </div>
                  {unlinked.length > 0 && (
                    <button onClick={() => setShowPicker(true)} style={{
                      marginTop: 12, padding: '9px 18px', borderRadius: 999,
                      background: 'var(--ink)', color: 'var(--paper)',
                      fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                    }}>
                      Link a task
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ paddingLeft: 10, borderLeft: '2px solid var(--rule)', marginTop: 4 }}>
                  {linkedTasks.map((t: Task) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0', borderBottom: '1px solid var(--rule)',
                    }}>
                      <button
                        onClick={() => !t.done && completeTask(t.id)}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          border: `1.5px solid ${t.done ? goalColor : 'var(--ink-3)'}`,
                          background: t.done ? goalColor : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {t.done && <Icons.check size={9} sw={2.5} style={{ color: 'white' }} />}
                      </button>
                      <span
                        onClick={() => navigate({ name: 'task', taskId: t.id })}
                        style={{
                          flex: 1, fontSize: 13, cursor: 'pointer',
                          textDecoration: t.done ? 'line-through' : 'none',
                          color: t.done ? 'var(--ink-3)' : 'var(--ink)',
                        }}
                      >
                        {t.title}
                      </span>
                      <button onClick={() => unlinkTask(t.id)} style={{ color: 'var(--ink-4)', padding: '2px' }}>
                        <Icons.close size={13} />
                      </button>
                    </div>
                  ))}

                  {unlinked.length > 0 && (
                    <button onClick={() => setShowPicker(true)} style={{
                      width: '100%', marginTop: 12, padding: '10px',
                      borderRadius: 10, fontSize: 12,
                      border: '1px dashed var(--rule)', background: 'transparent',
                      color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                    }}>
                      + Link another task
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Task picker bottom sheet */}
      {showPicker && (() => {
        const areaOrder = Array.from(new Set(unlinked.map(t => t.cat)))
        areaOrder.sort((a, b) => (a === goal.area ? -1 : b === goal.area ? 1 : 0))

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowPicker(false) }}
          >
            <div style={{
              background: 'var(--paper)', borderRadius: '20px 20px 0 0',
              padding: '20px 22px 44px', width: '100%', maxHeight: '70vh', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="t-display" style={{ fontSize: 20 }}>Link a task</div>
                <button onClick={() => setShowPicker(false)} style={{ color: 'var(--ink-3)' }}>
                  <Icons.close size={20} />
                </button>
              </div>

              <button
                onClick={() => { setShowPicker(false); setShowAddTask(true) }}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 16,
                  background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, color: 'var(--accent)',
                }}
              >
                <Icons.plus size={14} /> Create new task for this goal
              </button>

              {unlinked.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-3)', fontSize: 13 }}>
                  No open tasks to link
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {areaOrder.map(catId => {
                    const group = unlinked.filter(t => t.cat === catId)
                    if (group.length === 0) return null
                    const c    = cats.find(x => x.id === catId)
                    const name = c?.name ?? (catId === 'inbox' ? 'Inbox' : catId)
                    return (
                      <div key={catId}>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>{name}</div>
                        <div style={{ paddingLeft: 10, borderLeft: '2px solid var(--rule)' }}>
                          {group.map(t => (
                            <div key={t.id} onClick={() => linkTask(t.id)} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 0', borderBottom: '1px solid var(--rule)',
                              cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
                            }}>
                              <Icons.plus size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                              {t.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {showAddTask && (
        <AddTaskSheet
          onClose={() => setShowAddTask(false)}
          defaultCatId={goal.area}
          linkToGoalId={goalId}
        />
      )}
    </div>
  )
}
