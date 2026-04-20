import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, addCategory, deleteCategory } from '../data/db'
import { EFFORT, DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { EffortPip, SectionHeader, ConfettiBurst, Chip } from '../components/ui'
import type { Screen, Task, Category } from '../types'

// ── Area icons available for custom areas ─────────────────────────────────────
const AREA_ICONS = ['home','heart','briefcase','book','dollar','family','leaf','drop','bolt','star','bell','layers','pet']

// Built-in category IDs — these cannot be deleted
const BUILTIN_IDS = new Set(['home','work','health','finance','learning','family'])

// ── Add Area Modal ────────────────────────────────────────────────────────────
function AddAreaModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('home')
  const [hue, setHue] = useState(200)

  async function handleSave() {
    if (!name.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await addCategory({ id: `${id}-${Date.now()}`, name: name.trim(), icon, hue })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 22 }}>New Area</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Name</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Pets, Pool, Mindfulness…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AREA_ICONS.map(ic => {
                const I = Icons[ic] ?? Icons.home
                return (
                  <button key={ic} onClick={() => setIcon(ic)} style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: icon === ic ? `hsl(${hue},55%,42%)` : 'var(--paper-2)',
                    color: icon === ic ? 'white' : 'var(--ink-2)',
                    border: '1px solid', borderColor: icon === ic ? 'transparent' : 'var(--rule)',
                  }}>
                    <I size={18} />
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Colour — hue {hue}°</div>
            <input type="range" min={0} max={360} value={hue} onChange={e => setHue(Number(e.target.value))}
              style={{ width: '100%', accentColor: `hsl(${hue},55%,42%)` }} />
            <div style={{ height: 24, borderRadius: 8, marginTop: 8, background: `hsl(${hue},55%,42%)` }} />
          </div>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: name.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: name.trim() ? 'var(--paper)' : 'var(--ink-3)',
          }}>
            Add area
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Area confirm sheet ─────────────────────────────────────────────────
function DeleteAreaSheet({ cat, onConfirm, onCancel }: { cat: Category; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 44px', width: '100%' }}>
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🗑️</div>
          <div className="t-display" style={{ fontSize: 20, marginBottom: 8 }}>Delete "{cat.name}"?</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Tasks in this area will move to Home. This can't be undone.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 500,
            background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: 'var(--warn)', color: 'white',
          }}>
            Delete area
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  navigate: (s: Screen) => void
}

interface Burst { id: number; x: number; y: number; xp: number }

const today = new Date()
const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()]
const DATE = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })

export const DashboardScreen = ({ navigate }: Props) => {
  const [bursts, setBursts]           = useState<Burst[]>([])
  const [showAddArea, setShowAddArea] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const tasks    = useLiveQuery(() => db.tasks.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const inboxCount = useLiveQuery(() => db.inbox.where('processed').equals(0).count(), [])

  if (!tasks || !settings) return null

  const allTodayTasks = tasks.filter(t => t.due === 'Today')
  const doneTodayCount = allTodayTasks.filter(t => t.done).length
  const totalToday = allTodayTasks.length
  const xp = settings.xp ?? 0
  const streak = settings.streak ?? 0

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
  }

  async function handleDeleteArea(cat: Category) {
    // Move tasks from deleted area to 'home'
    const areaTasks = await db.tasks.where('cat').equals(cat.id).toArray()
    await Promise.all(areaTasks.map(t => db.tasks.update(t.id, { cat: 'home' })))
    await deleteCategory(cat.id)
    setDeleteTarget(null)
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>{DAY}</div>
            <div className="t-display" style={{ fontSize: 28 }}>{DATE}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
            {streak > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>
                <Icons.flame size={14} />
                <span style={{ fontWeight: 600 }}>{streak}</span>
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {xp.toLocaleString()} XP
            </div>
            <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
              <Icons.settings size={20} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {totalToday > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>TODAY'S TASKS</span>
              <span>{doneTodayCount}/{totalToday} done</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${totalToday ? (doneTodayCount / totalToday) * 100 : 0}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        )}
      </div>

      <div className="screen-scroll" style={{ padding: '0 0 16px' }}>
        {/* Area grid — Inbox first, then categories */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>

            {/* ── Inbox card — always first ── */}
            <button
              onClick={() => navigate({ name: 'inbox' })}
              style={{
                padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ color: `hsl(200, 55%, 42%)` }}>
                  <Icons.inbox size={16} />
                </div>
                {(inboxCount ?? 0) > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'white', letterSpacing: '0.06em',
                    background: 'var(--warn)', borderRadius: 10, padding: '1px 6px', fontWeight: 600,
                  }}>
                    {inboxCount}
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Inbox</div>
                {(inboxCount ?? 0) > 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                    {inboxCount} uncategorised
                  </div>
                )}
              </div>
            </button>

            {/* ── Area cards ── */}
            {cats.map((cat: Category) => {
              const catTasks = tasks.filter(t => t.cat === cat.id)
              const catDone  = catTasks.filter(t => t.done).length
              const catTotal = catTasks.length
              const I = Icons[cat.icon] ?? Icons.home
              const isCustom = !BUILTIN_IDS.has(cat.id)

              return (
                <div key={cat.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => navigate({ name: 'category', catId: cat.id })}
                    style={{
                      width: '100%', padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                      background: 'var(--paper-2)', border: '1px solid var(--rule)',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ color: `hsl(${cat.hue}, 55%, 42%)` }}>
                        <I size={16} />
                      </div>
                      {catTotal > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                          {catDone}/{catTotal}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{cat.name}</div>
                      {catTotal > 0 && (
                        <div style={{ height: 2, borderRadius: 1, background: 'var(--paper-3)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 1, background: `hsl(${cat.hue}, 55%, 42%)`, width: `${(catDone/catTotal)*100}%` }} />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Delete button — custom areas only, top-right corner */}
                  {isCustom && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(cat) }}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--paper-3)', border: '1px solid var(--rule)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--ink-4)',
                      }}
                    >
                      <Icons.close size={9} />
                    </button>
                  )}
                </div>
              )
            })}

            {/* Add Area button */}
            <button onClick={() => setShowAddArea(true)} style={{
              padding: '12px 10px', borderRadius: 12, textAlign: 'left',
              background: 'transparent', border: '1px dashed var(--rule)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 72,
            }}>
              <Icons.plus size={18} style={{ color: 'var(--ink-4)' }} />
              <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>ADD AREA</span>
            </button>
          </div>
        </div>

        {/* Today's tasks */}
        {allTodayTasks.length > 0 && (
          <div style={{ padding: '20px 20px 0' }}>
            <SectionHeader title="Today" action={
              <button onClick={() => navigate({ name: 'all-tasks' })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                ALL <Icons.arrow size={12} />
              </button>
            } />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allTodayTasks.map(task => (
                <TaskRow key={task.id} task={task}
                  onTap={() => navigate({ name: 'task', taskId: task.id })}
                  onComplete={(e) => handleComplete(e, task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming — non-today tasks with a due date */}
        <UpcomingSection tasks={tasks} navigate={navigate} handleComplete={handleComplete} />
      </div>

      {/* Confetti bursts */}
      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
      {showAddArea && <AddAreaModal onClose={() => setShowAddArea(false)} />}
      {deleteTarget && (
        <DeleteAreaSheet
          cat={deleteTarget}
          onConfirm={() => handleDeleteArea(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ── Task row ────────────────────────────────────────────────────────────────
function TaskRow({ task, onTap, onComplete, onDelete }: { task: Task; onTap: () => void; onComplete: (e: React.MouseEvent) => void; onDelete?: (e: React.MouseEvent) => void }) {
  const doneRing = task.sub.length > 0
    ? task.sub.filter(s => s.d).length / task.sub.length
    : task.done ? 1 : 0
  const subDone = task.sub.filter(s => s.d).length

  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: 'var(--paper-2)', borderRadius: 12, border: '1px solid var(--rule)',
      textAlign: 'left', width: '100%',
      opacity: task.done ? 0.55 : 1,
    }}>
      {/* Complete button */}
      <button onClick={onComplete} style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        border: `1.5px solid ${task.done ? 'var(--accent)' : 'var(--rule)'}`,
        background: task.done ? 'var(--accent)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: task.done ? 'var(--paper)' : 'transparent',
      }}>
        {task.done && <Icons.check size={12} sw={2.5} />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: task.done ? 'line-through' : 'none', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title}
        </div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <EffortPip effort={task.effort} mono />
          {task.streak > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warn)', letterSpacing: '0.06em' }}>
              <Icons.flame size={10} />
              {task.streak}
            </span>
          )}
          {task.sub.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              {subDone}/{task.sub.length}
            </span>
          )}
        </div>
      </div>

      {/* Sub-progress ring if has subs */}
      {task.sub.length > 0 && (
        <MiniRing progress={doneRing} />
      )}

      {onDelete ? (
        <button onClick={onDelete} style={{ flexShrink: 0, padding: '4px', color: 'var(--ink-4)' }}>
          <Icons.close size={14} />
        </button>
      ) : (
        <Icons.arrow size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      )}
    </button>
  )
}

function MiniRing({ progress }: { progress: number }) {
  const r = 8, c = 2 * Math.PI * r
  return (
    <svg width={20} height={20} style={{ flexShrink: 0 }}>
      <circle cx={10} cy={10} r={r} fill="none" stroke="var(--rule)" strokeWidth={2} />
      <circle cx={10} cy={10} r={r} fill="none" stroke="var(--accent)" strokeWidth={2}
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
        strokeLinecap="round" transform="rotate(-90 10 10)" />
    </svg>
  )
}

function UpcomingSection({ tasks, navigate, handleComplete }: {
  tasks: Task[]
  navigate: (s: Screen) => void
  handleComplete: (e: React.MouseEvent, task: Task) => void
}) {
  const upcoming = tasks.filter(t => !t.done && t.due !== 'Today' && t.due !== '')
  if (upcoming.length === 0) return null

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <SectionHeader title="Upcoming" />
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {upcoming.slice(0, 5).map(task => (
          <TaskRow key={task.id} task={task}
            onTap={() => navigate({ name: 'task', taskId: task.id })}
            onComplete={(e) => handleComplete(e, task)}
          />
        ))}
        {upcoming.length > 5 && (
          <button onClick={() => navigate({ name: 'all-tasks' })} style={{
            padding: '10px 14px', borderRadius: 12, background: 'transparent',
            border: '1px dashed var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--ink-3)', letterSpacing: '0.06em',
          }}>
            +{upcoming.length - 5} more tasks
          </button>
        )}
      </div>
    </div>
  )
}

// Re-export TaskRow for use in other screens
export { TaskRow }
