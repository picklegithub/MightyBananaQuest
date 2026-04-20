import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addGoal, updateGoal, deleteGoal } from '../data/db'
import { Icons } from '../components/ui/Icons'
import type { Screen, Goal } from '../types'

interface Props { navigate: (s: Screen) => void }

const HORIZONS = ['4 weeks', '12 weeks', '6 months', '1 year', 'Ongoing']

const AREA_COLORS: Record<string, { hue: number }> = {
  health:   { hue: 145 }, finance: { hue: 90 },
  learning: { hue: 280 }, family:  { hue: 15 },
  work:     { hue: 240 }, home:    { hue: 35 },
}

function getHue(area: string) {
  return AREA_COLORS[area]?.hue ?? Math.abs(area.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360
}

function ProgressRing({ progress, hue }: { progress: number; hue: number }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <svg width={64} height={64} style={{ flexShrink: 0 }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--rule)" strokeWidth={5} />
      <circle cx={32} cy={32} r={r} fill="none"
        stroke={`hsl(${hue}, 55%, 42%)`} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
        transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset .5s ease' }}
      />
      <text x={32} y={37} textAnchor="middle"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, fill: `hsl(${hue}, 55%, 38%)` }}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  )
}

export const GoalsScreen = ({ navigate }: Props) => {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [showAdd, setShowAdd] = useState(false)
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null)

  if (!goals) return null

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Long game</div>
            <h1 className="t-display" style={{ fontSize: 28 }}>Goals</h1>
          </div>
          <button onClick={() => setShowAdd(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            border: '1px solid var(--rule)', borderRadius: 20,
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.04em',
          }}>
            <Icons.plus size={14} /> Add goal
          </button>
        </div>
      </div>

      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>
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
              const hue = getHue(goal.area)
              return (
                <div key={goal.id} style={{
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  borderRadius: 16, padding: '16px', cursor: 'pointer',
                }} onClick={() => setDetailGoal(goal)}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <ProgressRing progress={goal.progress} hue={hue} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 20, fontSize: 10,
                            fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                            background: `hsl(${hue}, 40%, 92%)`, color: `hsl(${hue}, 55%, 38%)`,
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
                        <div style={{ height: '100%', borderRadius: 2, background: `hsl(${hue}, 55%, 42%)`, width: `${goal.progress * 100}%`, transition: 'width .5s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {goals.length > 0 && (
          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            {[
              { label: 'Active', val: goals.length },
              { label: 'Avg progress', val: `${Math.round(goals.reduce((a,g) => a + g.progress, 0) / goals.length * 100)}%` },
              { label: 'On track', val: goals.filter(g => g.progress >= 0.5).length },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '14px 10px', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 12, textAlign: 'center' }}>
                <div className="t-display" style={{ fontSize: 22 }}>{s.val}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      {showAdd && <AddGoalModal categories={categories ?? []} onClose={() => setShowAdd(false)} />}

      {/* Goal Detail */}
      {detailGoal && <GoalDetail goal={detailGoal} onClose={() => setDetailGoal(null)} navigate={navigate} />}
    </div>
  )
}

// ── Add Goal Modal ────────────────────────────────────────────────────────────
function AddGoalModal({ categories, onClose }: { categories: { id: string; name: string }[]; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [area, setArea] = useState(categories[0]?.id ?? 'home')
  const [horizon, setHorizon] = useState('12 weeks')
  const [why, setWhy] = useState('')

  async function handleSave() {
    if (!title.trim()) return
    await addGoal({
      id: `g${Date.now()}`,
      title: title.trim(),
      area, horizon,
      why: why.trim(),
      progress: 0,
      linked: [],
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
function GoalDetail({ goal, onClose, navigate }: { goal: Goal; onClose: () => void; navigate: (s: Screen) => void }) {
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const hue = getHue(goal.area)
  const linkedTasks = tasks?.filter(t => goal.linked.includes(t.id)) ?? []
  const [progress, setProgress] = useState(goal.progress)

  async function saveProgress(val: number) {
    setProgress(val)
    await updateGoal(goal.id, { progress: val })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--paper)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} /> Back
        </button>
        <button onClick={async () => { if (confirm('Delete this goal?')) { await deleteGoal(goal.id); onClose() } }}
          style={{ color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          <Icons.close size={14} /> Delete
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 40px' }}>
        {/* Area + horizon */}
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

        {/* Progress control */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="eyebrow">Progress</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: `hsl(${hue},55%,42%)` }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <input type="range" min={0} max={100} value={Math.round(progress * 100)}
            onChange={e => saveProgress(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: `hsl(${hue},55%,42%)` }} />
          <div style={{ height: 8, borderRadius: 4, background: 'var(--paper-3)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', borderRadius: 4, background: `hsl(${hue},55%,42%)`, width: `${progress * 100}%`, transition: 'width .3s' }} />
          </div>
        </div>

        {/* Milestones */}
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Quick milestones</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => saveProgress(p / 100)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                background: Math.round(progress * 100) === p ? `hsl(${hue},55%,42%)` : 'var(--paper-2)',
                color: Math.round(progress * 100) === p ? 'white' : 'var(--ink-2)',
                border: '1px solid', borderColor: Math.round(progress * 100) === p ? 'transparent' : 'var(--rule)',
              }}>{p}%</button>
            ))}
          </div>
        </div>

        {/* Linked tasks */}
        {linkedTasks.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Linked tasks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linkedTasks.map(t => (
                <button key={t.id} onClick={() => { onClose(); navigate({ name: 'task', taskId: t.id }) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--paper-2)', borderRadius: 10, border: '1px solid var(--rule)', textAlign: 'left' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${t.done ? 'var(--accent)' : 'var(--rule)'}`, background: t.done ? 'var(--accent)' : 'transparent', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--ink-3)' : 'var(--ink)' }}>{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
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
