import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addGoal, updateGoal, deleteGoal, completeTask } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { Seg } from '../components/ui'
import type { Screen, Goal, Task } from '../types'

interface Props { navigate: (s: Screen) => void }

const HORIZONS = ['4 weeks', '12 weeks', '6 months', '1 year', 'Ongoing']

function getHue(area: string, cats: { id: string; hue: number }[]) {
  return cats.find(c => c.id === area)?.hue
    ?? Math.abs(area.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360
}

// ── ISO date string for N days ago ────────────────────────────────────────────
function isoDateOffset(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

const TODAY_ISO = new Date().toISOString().slice(0, 10)

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ progress, hue }: { progress: number; hue: number }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <svg width={64} height={64} style={{ flexShrink: 0 }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--rule)" strokeWidth={5} />
      <circle cx={32} cy={32} r={r} fill="none"
        stroke={`hsl(${hue},55%,42%)`} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dashoffset .5s ease' }}
      />
      <text x={32} y={37} textAnchor="middle"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, fill: `hsl(${hue},55%,38%)` }}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  )
}

// ── Goals list screen ─────────────────────────────────────────────────────────
export const GoalsScreen = ({ navigate }: Props) => {
  const goals      = useLiveQuery(() => db.goals.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const allTasks   = useLiveQuery(() => db.tasks.toArray(), [])
  const [tab,        setTab]        = useState<'goals' | 'habits'>('goals')
  const [showAdd,    setShowAdd]    = useState(false)
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null)

  if (!goals || !allTasks) return null

  const cats = categories ?? []
  const habits = allTasks.filter(t => t.recurring)

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Long game</div>
            <h1 className="t-display" style={{ fontSize: 28 }}>Goals</h1>
          </div>
          {tab === 'goals' && (
            <button onClick={() => setShowAdd(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              border: '1px solid var(--rule)', borderRadius: 20,
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.04em',
            }}>
              <Icons.plus size={14} /> Add goal
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <Seg value={tab} setValue={v => setTab(v as typeof tab)} options={[
          { v: 'goals',  l: '🎯 Goals' },
          { v: 'habits', l: '🔥 Habits' },
        ]} />
      </div>

      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>
        {/* ── Goals tab ── */}
        {tab === 'goals' && (
          <>
            {goals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Icons.target size={40} style={{ color: 'var(--ink-4)', margin: '0 auto 16px', display: 'block' }} />
                <div className="t-display" style={{ fontSize: 20, marginBottom: 8 }}>No goals yet</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 20 }}>Set your first goal to start tracking progress.</div>
                <button onClick={() => setShowAdd(true)} style={{
                  padding: '12px 24px', borderRadius: 12, background: 'var(--ink)', color: 'var(--paper)',
                  fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  <Icons.plus size={16} /> Set a goal
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {goals.map(goal => {
                  const hue         = getHue(goal.area, cats)
                  const linked      = allTasks.filter(t => goal.linked.includes(t.id))
                  const autoProgress = linked.length > 0
                    ? linked.filter(t => t.done).length / linked.length
                    : goal.progress
                  return (
                    <div key={goal.id} style={{
                      background: 'var(--paper-2)', border: '1px solid var(--rule)',
                      borderRadius: 16, padding: '16px', cursor: 'pointer',
                    }} onClick={() => setDetailGoal(goal)}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <ProgressRing progress={autoProgress} hue={hue} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                padding: '3px 8px', borderRadius: 20, fontSize: 10,
                                fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                                background: `hsl(${hue},40%,92%)`, color: `hsl(${hue},55%,38%)`,
                              }}>{goal.area.toUpperCase()}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{goal.horizon}</span>
                            </div>
                            <button onClick={e => { e.stopPropagation(); if (confirm('Delete this goal?')) deleteGoal(goal.id) }}
                              style={{ color: 'var(--ink-4)', padding: 4 }}>
                              <Icons.close size={14} />
                            </button>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, lineHeight: 1.3 }}>{goal.title}</div>
                          {goal.why && (
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 10 }}>"{goal.why}"</div>
                          )}
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-3)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              background: `hsl(${hue},55%,42%)`,
                              width: `${autoProgress * 100}%`,
                              transition: 'width .5s ease',
                            }} />
                          </div>
                          {linked.length > 0 && (
                            <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                              {linked.filter(t => t.done).length}/{linked.length} TASKS DONE
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Summary stats */}
            {goals.length > 0 && (
              <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                {[
                  { label: 'Active',       val: goals.length },
                  { label: 'Avg progress', val: `${Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length * 100)}%` },
                  { label: 'On track',     val: goals.filter(g => g.progress >= 0.5).length },
                ].map(s => (
                  <div key={s.label} style={{
                    flex: 1, padding: '14px 10px',
                    background: 'var(--paper-2)', border: '1px solid var(--rule)',
                    borderRadius: 12, textAlign: 'center',
                  }}>
                    <div className="t-display" style={{ fontSize: 22 }}>{s.val}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Habits tab ── */}
        {tab === 'habits' && (
          <HabitsTab habits={habits} cats={cats} navigate={navigate} />
        )}
      </div>

      {showAdd && <AddGoalModal categories={cats} onClose={() => setShowAdd(false)} />}
      {detailGoal && (
        <GoalDetail
          goal={detailGoal}
          allTasks={allTasks}
          categories={cats}
          onClose={() => setDetailGoal(null)}
          navigate={navigate}
        />
      )}
    </div>
  )
}

// ── Habits tab ────────────────────────────────────────────────────────────────
function HabitsTab({ habits, cats, navigate }: { habits: Task[]; cats: { id: string; name: string; hue: number }[]; navigate: (s: Screen) => void }) {
  const logs = useLiveQuery(() => db.habitLog.toArray(), [])

  if (!logs) return null

  if (habits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔁</div>
        <div className="t-display" style={{ fontSize: 20, marginBottom: 8 }}>No habits yet</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 20 }}>
          Tasks with a recurring schedule appear here as habits.
        </div>
        <button onClick={() => navigate({ name: 'add' })} style={{
          padding: '12px 24px', borderRadius: 12, background: 'var(--ink)', color: 'var(--paper)',
          fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Icons.plus size={16} /> Add a recurring task
        </button>
      </div>
    )
  }

  // Build set of logged dates per task for fast lookup
  const logSet = new Set(logs.map(l => l.id)) // `${taskId}:${date}`

  // Build the 16-week date grid (112 days, oldest first)
  const DAYS = 112
  const grid: string[] = []
  for (let i = DAYS - 1; i >= 0; i--) grid.push(isoDateOffset(i))

  // Group by week for display (16 weeks × 7 days)
  const weeks: string[][] = []
  for (let w = 0; w < 16; w++) weeks.push(grid.slice(w * 7, w * 7 + 7))

  const dayLabels = ['S','M','T','W','T','F','S']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {habits.map(task => {
        const hue = cats.find(c => c.id === task.cat)?.hue ?? 200
        const completedToday = task.done && logSet.has(`${task.id}:${TODAY_ISO}`)
        const streak = task.streak

        async function handleDone() {
          if (task.done) return
          await completeTask(task.id)
        }

        return (
          <div key={task.id} style={{
            background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 16, padding: '16px',
          }}>
            {/* Habit header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => navigate({ name: 'task', taskId: task.id })}
                  style={{ textAlign: 'left', display: 'block', width: '100%' }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--ink-3)' : 'var(--ink)' }}>
                    {task.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 9,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                      background: `hsl(${hue},40%,92%)`, color: `hsl(${hue},55%,38%)`,
                    }}>{task.cat.toUpperCase()}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                      {task.recurring}
                    </span>
                  </div>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 10 }}>
                {/* Streak */}
                {streak > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icons.flame size={16} style={{ color: 'var(--warn)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--warn)' }}>
                      {streak}
                    </span>
                  </div>
                )}

                {/* Complete today button */}
                <button
                  onClick={handleDone}
                  disabled={task.done}
                  style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${task.done ? `hsl(${hue},55%,42%)` : 'var(--rule)'}`,
                    background: task.done ? `hsl(${hue},55%,42%)` : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: task.done ? 'white' : 'var(--ink-3)',
                    transition: 'all .2s',
                  }}
                >
                  <Icons.check size={16} sw={2.5} />
                </button>
              </div>
            </div>

            {/* Heatmap */}
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                {/* Day-of-week labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 2 }}>
                  {dayLabels.map((d, i) => (
                    <div key={i} style={{
                      width: 10, height: 10,
                      fontFamily: 'var(--font-mono)', fontSize: 7,
                      color: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i % 2 === 0 ? d : ''}
                    </div>
                  ))}
                </div>
                {/* Week columns */}
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {week.map((date, di) => {
                      const logged = logSet.has(`${task.id}:${date}`)
                      const isToday = date === TODAY_ISO
                      return (
                        <div
                          key={di}
                          title={date}
                          style={{
                            width: 10, height: 10, borderRadius: 2,
                            background: logged
                              ? `hsl(${hue},55%,42%)`
                              : isToday
                                ? 'var(--rule)'
                                : 'var(--paper-3)',
                            opacity: isToday && !logged ? 0.5 : 1,
                            outline: isToday ? `1.5px solid hsl(${hue},55%,60%)` : 'none',
                            outlineOffset: 1,
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Streak summary */}
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              <span>{streak > 0 ? `${streak}-DAY STREAK` : 'NO STREAK YET'}</span>
              <span>{logs.filter(l => l.taskId === task.id).length} TOTAL COMPLETIONS</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Add Goal Modal ────────────────────────────────────────────────────────────
function AddGoalModal({ categories, onClose }: { categories: { id: string; name: string }[]; onClose: () => void }) {
  const [title,   setTitle]   = useState('')
  const [area,    setArea]    = useState(categories[0]?.id ?? 'home')
  const [horizon, setHorizon] = useState('12 weeks')
  const [why,     setWhy]     = useState('')

  async function handleSave() {
    if (!title.trim()) return
    await addGoal({
      id: `g${Date.now()}`,
      title: title.trim(), area, horizon,
      why: why.trim(), progress: 0, linked: [],
    })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 22 }}>New Goal</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Goal">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Run a 10km under 50 minutes…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </Field>
          <Field label="Area">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setArea(c.id)} style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)',
                  background: area === c.id ? 'var(--ink)' : 'var(--paper-2)',
                  color: area === c.id ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: area === c.id ? 'var(--ink)' : 'var(--rule)',
                }}>{c.name}</button>
              ))}
            </div>
          </Field>
          <Field label="Horizon">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HORIZONS.map(h => (
                <button key={h} onClick={() => setHorizon(h)} style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)',
                  background: horizon === h ? 'var(--ink)' : 'var(--paper-2)',
                  color: horizon === h ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: horizon === h ? 'var(--ink)' : 'var(--rule)',
                }}>{h}</button>
              ))}
            </div>
          </Field>
          <Field label="Why does this matter?">
            <textarea value={why} onChange={e => setWhy(e.target.value)}
              placeholder="Energy for the year ahead…"
              style={{ width: '100%', minHeight: 70, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 14, resize: 'none', lineHeight: 1.5, color: 'var(--ink)' }} />
          </Field>
          <button onClick={handleSave} disabled={!title.trim()} style={{
            width: '100%', padding: '15px', borderRadius: 14, fontSize: 15, fontWeight: 600,
            background: title.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: title.trim() ? 'var(--paper)' : 'var(--ink-3)',
          }}>
            Save goal
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Goal Detail ───────────────────────────────────────────────────────────────
function GoalDetail({
  goal, allTasks, categories, onClose, navigate,
}: {
  goal: Goal
  allTasks: Task[]
  categories: { id: string; name: string; hue: number }[]
  onClose: () => void
  navigate: (s: Screen) => void
}) {
  const hue         = getHue(goal.area, categories)
  const linkedTasks = allTasks.filter(t => goal.linked.includes(t.id))
  const unlinked    = allTasks.filter(t => !goal.linked.includes(t.id) && t.cat === goal.area && !t.done)

  // Auto-derive progress whenever linked task states change
  useEffect(() => {
    if (linkedTasks.length === 0) return
    const computed = linkedTasks.filter(t => t.done).length / linkedTasks.length
    if (Math.abs(computed - goal.progress) > 0.005) {
      updateGoal(goal.id, { progress: computed })
    }
  }, [linkedTasks.map(t => `${t.id}:${t.done}`).join(',')])

  const autoProgress = linkedTasks.length > 0
    ? linkedTasks.filter(t => t.done).length / linkedTasks.length
    : goal.progress

  // Edit mode
  const [editing,    setEditing]    = useState(false)
  const [editTitle,  setEditTitle]  = useState(goal.title)
  const [editWhy,    setEditWhy]    = useState(goal.why ?? '')
  const [editArea,   setEditArea]   = useState(goal.area)
  const [editHorizon, setEditHorizon] = useState(goal.horizon)

  // Task picker sheet
  const [showPicker, setShowPicker] = useState(false)

  async function saveEdit() {
    await updateGoal(goal.id, {
      title:   editTitle.trim(),
      why:     editWhy.trim(),
      area:    editArea,
      horizon: editHorizon,
    })
    setEditing(false)
  }

  async function linkTask(taskId: string) {
    const newLinked = [...goal.linked, taskId]
    await updateGoal(goal.id, { linked: newLinked })
    setShowPicker(false)
  }

  async function unlinkTask(taskId: string) {
    const newLinked = goal.linked.filter(id => id !== taskId)
    await updateGoal(goal.id, { linked: newLinked })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--paper)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} /> Back
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setEditing(e => !e)} style={{ color: 'var(--ink-2)' }}>
            <Icons.edit size={18} />
          </button>
          <button
            onClick={async () => { if (confirm('Delete this goal?')) { await deleteGoal(goal.id); onClose() } }}
            style={{ color: 'var(--warn)' }}
          >
            <Icons.close size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 40px' }}>
        {/* ── Edit mode ──────────────────────────────────── */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Goal">
              <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
            </Field>
            <Field label="Why it matters">
              <textarea value={editWhy} onChange={e => setEditWhy(e.target.value)}
                style={{ width: '100%', minHeight: 70, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 14, resize: 'none', lineHeight: 1.5, color: 'var(--ink)' }} />
            </Field>
            <Field label="Area">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setEditArea(c.id)} style={{
                    padding: '7px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)',
                    background: editArea === c.id ? 'var(--ink)' : 'var(--paper-2)',
                    color: editArea === c.id ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: editArea === c.id ? 'var(--ink)' : 'var(--rule)',
                  }}>{c.name}</button>
                ))}
              </div>
            </Field>
            <Field label="Horizon">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {HORIZONS.map(h => (
                  <button key={h} onClick={() => setEditHorizon(h)} style={{
                    padding: '7px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)',
                    background: editHorizon === h ? 'var(--ink)' : 'var(--paper-2)',
                    color: editHorizon === h ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: editHorizon === h ? 'var(--ink)' : 'var(--rule)',
                  }}>{h}</button>
                ))}
              </div>
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={!editTitle.trim()} style={{
                flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600, fontSize: 14,
                background: editTitle.trim() ? 'var(--ink)' : 'var(--paper-3)',
                color: editTitle.trim() ? 'var(--paper)' : 'var(--ink-3)',
              }}>Save</button>
              <button onClick={() => setEditing(false)} style={{
                padding: '14px 18px', borderRadius: 12,
                border: '1px solid var(--rule)', background: 'var(--paper-2)', color: 'var(--ink-2)',
              }}>Cancel</button>
            </div>
          </div>
        ) : (
          /* ── View mode ──────────────────────────────────── */
          <>
            {/* Tags */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontFamily: 'var(--font-mono)', background: `hsl(${hue},40%,92%)`, color: `hsl(${hue},55%,38%)` }}>
                {goal.area.toUpperCase()}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontFamily: 'var(--font-mono)', border: '1px solid var(--rule)', color: 'var(--ink-3)' }}>
                {goal.horizon}
              </span>
            </div>

            <h1 className="t-display" style={{ fontSize: 26, marginBottom: 12, lineHeight: 1.2 }}>{goal.title}</h1>

            {goal.why && (
              <div style={{ padding: '14px 16px', background: 'var(--paper-2)', borderRadius: 12, border: '1px solid var(--rule)', marginBottom: 24 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Why it matters</div>
                <div style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--ink-2)', lineHeight: 1.5 }}>"{goal.why}"</div>
              </div>
            )}

            {/* Auto progress */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="eyebrow">Progress</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: `hsl(${hue},55%,42%)` }}>
                  {Math.round(autoProgress * 100)}%
                  {linkedTasks.length > 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 11 }}>
                      {' '}({linkedTasks.filter(t => t.done).length}/{linkedTasks.length} tasks)
                    </span>
                  )}
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--paper-3)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 5,
                  background: `hsl(${hue},55%,42%)`,
                  width: `${autoProgress * 100}%`,
                  transition: 'width .4s ease',
                }} />
              </div>
              {linkedTasks.length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6 }}>
                  Link tasks below to auto-track progress
                </div>
              )}
            </div>

            {/* Linked tasks */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="eyebrow">Linked tasks</div>
                {unlinked.length > 0 && (
                  <button onClick={() => setShowPicker(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--ink-2)', letterSpacing: '0.06em',
                  }}>
                    <Icons.plus size={12} /> LINK TASK
                  </button>
                )}
              </div>

              {linkedTasks.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--paper-2)', borderRadius: 12, border: '1px dashed var(--rule)' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No linked tasks yet</div>
                  {unlinked.length > 0 && (
                    <button onClick={() => setShowPicker(true)} style={{
                      marginTop: 10, padding: '8px 16px', borderRadius: 8, fontSize: 12,
                      background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)',
                    }}>
                      + Link a task
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {linkedTasks.map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                      background: 'var(--paper-2)', borderRadius: 10, border: '1px solid var(--rule)',
                    }}>
                      <button
                        onClick={() => !t.done && completeTask(t.id)}
                        style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${t.done ? `hsl(${hue},55%,42%)` : 'var(--rule)'}`,
                          background: t.done ? `hsl(${hue},55%,42%)` : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {t.done && <Icons.check size={10} sw={3} style={{ color: 'white' }} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--ink-3)' : 'var(--ink)' }}>
                        {t.title}
                      </span>
                      <button onClick={() => { onClose(); navigate({ name: 'task', taskId: t.id }) }}
                        style={{ color: 'var(--ink-4)', padding: '0 2px' }}>
                        <Icons.arrow size={14} />
                      </button>
                      <button onClick={() => unlinkTask(t.id)} style={{ color: 'var(--ink-4)' }}>
                        <Icons.close size={13} />
                      </button>
                    </div>
                  ))}
                  {unlinked.length > 0 && (
                    <button onClick={() => setShowPicker(true)} style={{
                      padding: '10px', borderRadius: 10, fontSize: 12,
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
      {showPicker && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPicker(false) }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="t-display" style={{ fontSize: 18 }}>Link a task</div>
              <button onClick={() => setShowPicker(false)} style={{ color: 'var(--ink-3)' }}>
                <Icons.close size={20} />
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: 14 }}>
              {goal.area.toUpperCase()} AREA · OPEN TASKS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unlinked.map(t => (
                <button key={t.id} onClick={() => linkTask(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: 'var(--paper-2)', borderRadius: 10, border: '1px solid var(--rule)',
                  textAlign: 'left',
                }}>
                  <Icons.plus size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14 }}>{t.title}</span>
                </button>
              ))}
              {unlinked.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-3)', fontSize: 13 }}>
                  No more open tasks in {goal.area}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}
