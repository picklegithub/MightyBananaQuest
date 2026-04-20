import React, { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, toggleSubTask, deleteTask } from '../data/db'
import { pushTask } from '../lib/sync'
import { EFFORT, QUAD, EFFORT_ORDER } from '../constants'
import { Icons } from '../components/ui/Icons'
import { EffortPip, Chip, ConfettiBurst, EisenhowerMatrix } from '../components/ui'
import { DueDatePicker } from '../components/ui/DueDatePicker'
import { RecurringPicker } from '../components/ui/RecurringPicker'
import type { Screen, EffortKey, QuadKey } from '../types'

interface Props {
  taskId: string
  navigate: (s: Screen) => void
  back: () => void
}

interface Burst { id: number; x: number; y: number; xp: number }

type TimerState = 'idle' | 'running' | 'paused' | 'done'

export const TaskDetailScreen = ({ taskId, navigate, back }: Props) => {
  const task = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const defaultMins = settings?.defaultPomodoroMins ?? 25
  const pomMins = task?.pomodoroMins ?? defaultMins

  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [secsLeft, setSecsLeft] = useState(pomMins * 60)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset timer when task changes
  useEffect(() => {
    setSecsLeft(pomMins * 60)
    setTimerState('idle')
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [taskId, pomMins])

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setSecsLeft(s => {
          if (s <= 1) {
            setTimerState('done')
            clearInterval(intervalRef.current!)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerState])

  // Derive breadcrumb label from the task's category
  const areaName = task
    ? (categories?.find(c => c.id === task.cat)?.name ?? task.cat)
    : null

  if (!task) return (
    <div className="screen">
      <div style={{ padding: 20 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)' }}>
          <Icons.back size={20} />
        </button>
      </div>
    </div>
  )

  const e = EFFORT[task.effort]
  const subDone = task.sub.filter(s => s.d).length
  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const progress = 1 - secsLeft / (pomMins * 60)
  const r = 54, circ = 2 * Math.PI * r

  async function handleComplete(ev: React.MouseEvent) {
    if (!task || task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (ev.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
  }

  function resetTimer() {
    setTimerState('idle')
    setSecsLeft(pomMins * 60)
  }

  return (
    <div className="screen">
      {/* Nav bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} />
          {areaName ? (
            <span style={{ color: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{areaName}</span>
          ) : 'Back'}
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={async () => {
            if (confirm('Delete this task?')) {
              await deleteTask(task.id)
              back()
            }
          }} style={{ color: 'var(--warn)' }}>
            <Icons.close size={18} />
          </button>
          <button onClick={() => navigate({ name: 'schedule', taskId: task.id })} style={{ color: 'var(--ink-2)' }}>
            <Icons.calendar size={18} />
          </button>
          <button onClick={() => setEditOpen(true)} style={{ color: 'var(--ink-2)' }}>
            <Icons.edit size={18} />
          </button>
        </div>
      </div>

      <div className="screen-scroll" style={{ padding: '20px 20px 40px' }}>
        {/* Title + meta */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Chip>{task.cat}</Chip>
            <Chip accent>{QUAD[task.quad].short}</Chip>
            {task.recurring && <Chip>{task.recurring}</Chip>}
            {task.streak > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>
                <Icons.flame size={13} /> {task.streak} day streak
              </span>
            )}
          </div>
          <h1 className="t-display" style={{ fontSize: 26, marginBottom: 8, textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? 0.5 : 1 }}>
            {task.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <EffortPip effort={task.effort} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              Due {task.due}
            </span>
            {task.ctx && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {task.ctx}
              </span>
            )}
          </div>
          {task.notes && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{task.notes}</p>
          )}
        </div>

        {/* Pomodoro timer */}
        <div style={{ background: 'var(--paper-2)', borderRadius: 16, padding: '24px 20px', border: '1px solid var(--rule)', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="eyebrow">Focus Timer</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{pomMins} min session</span>
          </div>

          {/* Ring */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <svg width={130} height={130}>
              <circle cx={65} cy={65} r={r} fill="none" stroke="var(--rule)" strokeWidth={6} />
              <circle cx={65} cy={65} r={r} fill="none"
                stroke={timerState === 'done' ? 'var(--accent)' : 'var(--ink)'}
                strokeWidth={6} strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - progress)}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: timerState === 'done' ? 'var(--accent)' : 'var(--ink)' }}>
                {timerState === 'done' ? '🎉' : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}
              </div>
              {timerState === 'done' && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 2 }}>DONE!</div>}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            {(timerState === 'idle' || timerState === 'done') && (
              <button onClick={() => { resetTimer(); setTimerState('running') }} style={{
                width: 52, height: 52, borderRadius: '50%', background: 'var(--ink)',
                color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.play size={20} />
              </button>
            )}
            {timerState === 'running' && (
              <button onClick={() => setTimerState('paused')} style={{
                width: 52, height: 52, borderRadius: '50%', background: 'var(--ink)',
                color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.pause size={20} />
              </button>
            )}
            {timerState === 'paused' && (
              <button onClick={() => setTimerState('running')} style={{
                width: 52, height: 52, borderRadius: '50%', background: 'var(--ink)',
                color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.play size={20} />
              </button>
            )}
            {timerState !== 'idle' && (
              <button onClick={resetTimer} style={{
                width: 52, height: 52, borderRadius: '50%', background: 'var(--paper-3)',
                border: '1px solid var(--rule)', color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.reset size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Sub-tasks */}
        {task.sub.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="eyebrow">Sub-tasks</div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{subDone}/{task.sub.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {task.sub.map((s, i) => (
                <button key={i} onClick={() => toggleSubTask(task.id, i)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'var(--paper-2)', borderRadius: 10, border: '1px solid var(--rule)',
                  textAlign: 'left',
                }}>
                  <div style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                    border: `1.5px solid ${s.d ? 'var(--accent)' : 'var(--rule)'}`,
                    background: s.d ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {s.d && <Icons.check size={10} sw={2.5} style={{ color: 'var(--paper)' }} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 400, textDecoration: s.d ? 'line-through' : 'none', color: s.d ? 'var(--ink-3)' : 'var(--ink)' }}>
                    {s.t}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Move to area */}
        <MoveToArea taskId={task.id} currentCat={task.cat} />

        {/* Complete button */}
        {!task.done && (
          <button onClick={handleComplete} style={{
            width: '100%', padding: '16px', borderRadius: 14, background: 'var(--ink)',
            color: 'var(--paper)', fontSize: 15, fontWeight: 600, letterSpacing: '0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icons.check size={18} sw={2.5} />
            Mark Complete · +{e.xp} XP
          </button>
        )}
        {task.done && (
          <div style={{ textAlign: 'center', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', letterSpacing: '0.06em' }}>
            ✓ COMPLETED · +{e.xp} XP EARNED
          </div>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}

      {/* Edit modal */}
      {editOpen && (
        <EditTaskSheet
          taskId={task.id}
          onClose={() => setEditOpen(false)}
          categories={categories ?? []}
        />
      )}
    </div>
  )
}

// ── Edit Task Bottom Sheet ────────────────────────────────────────────────────
function EditTaskSheet({
  taskId,
  onClose,
  categories,
}: {
  taskId: string
  onClose: () => void
  categories: { id: string; name: string; hue: number }[]
}) {
  const task = useLiveQuery(() => db.tasks.get(taskId), [taskId])

  const [title,     setTitle]     = useState('')
  const [cat,       setCat]       = useState('home')
  const [effort,    setEffort]    = useState<EffortKey>('m')
  const [due,       setDue]       = useState('Today')
  const [ctx,       setCtx]       = useState('@anywhere')
  const [quad,      setQuad]      = useState<QuadKey>('q2')
  const [recurring, setRecurring] = useState<string | null>(null)
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [inited,    setInited]    = useState(false)

  // Populate form once task loads
  useEffect(() => {
    if (task && !inited) {
      setTitle(task.title)
      setCat(task.cat)
      setEffort(task.effort)
      setDue(task.due ?? 'Today')
      setCtx(task.ctx ?? '@anywhere')
      setQuad(task.quad ?? 'q2')
      setRecurring(task.recurring ?? null)
      setNotes(task.notes ?? '')
      setInited(true)
    }
  }, [task, inited])

  if (!task || !inited) return null

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await db.tasks.update(taskId, { title: title.trim(), cat, effort, due, ctx, quad, recurring, notes })
    const updated = await db.tasks.get(taskId)
    if (updated) pushTask(updated)
    setSaving(false)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 14px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ color: 'var(--ink-2)', fontSize: 14 }}>Cancel</button>
          <div className="t-display" style={{ fontSize: 18 }}>Edit Task</div>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            style={{
              fontSize: 14, fontWeight: 600,
              color: title.trim() ? 'var(--ink)' : 'var(--ink-3)',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 20px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Title */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Title</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%', padding: '13px 16px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 15, color: 'var(--ink)',
              }}
            />
          </div>

          {/* Area */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Area</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} style={{
                  padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                  background: cat === c.id ? 'var(--ink)' : 'var(--paper-2)',
                  color: cat === c.id ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: cat === c.id ? 'var(--ink)' : 'var(--rule)',
                }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Effort */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Effort</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {EFFORT_ORDER.map(k => {
                const label = { xs:'Micro', s:'Small', m:'Medium', l:'Long', xl:'Mammoth', xxl:'Gargantuan' }[k]
                const range = { xs:'1–5m', s:'6–30m', m:'31–60m', l:'1–4h', xl:'4–8h', xxl:'1d+' }[k]
                return (
                  <button key={k} onClick={() => setEffort(k)} style={{
                    padding: '10px 8px', borderRadius: 10, fontSize: 11, textAlign: 'left',
                    background: effort === k ? 'var(--ink)' : 'var(--paper-2)',
                    color: effort === k ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid', borderColor: effort === k ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7 }}>{range}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due date */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Due date</div>
            <DueDatePicker value={due} onChange={setDue} />
          </div>

          {/* Priority */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Priority</div>
            <EisenhowerMatrix quad={quad} onChange={v => setQuad(v as QuadKey)} />
          </div>

          {/* Repeat */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Repeat</div>
            <RecurringPicker value={recurring} onChange={setRecurring} />
          </div>

          {/* Notes */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              style={{
                width: '100%', minHeight: 70, padding: '12px 16px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 14, resize: 'none', lineHeight: 1.5,
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Move to area ──────────────────────────────────────────────────────────────
function MoveToArea({ taskId, currentCat }: { taskId: string; currentCat: string }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const currentName = categories?.find(c => c.id === currentCat)?.name ?? currentCat

  async function moveTo(catId: string) {
    if (catId === currentCat) { setOpen(false); return }
    setSaving(true)
    await db.tasks.update(taskId, { cat: catId })
    const updated = await db.tasks.get(taskId)
    if (updated) pushTask(updated)
    setSaving(false)
    setOpen(false)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 12, border: '1px solid var(--rule)',
          background: 'var(--paper-2)', color: 'var(--ink)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icons.layers size={15} style={{ color: 'var(--ink-3)' }} />
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Area</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{currentName}</span>
        </div>
        {saving ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>saving…</span>
        ) : (
          <Icons.arrow size={14} style={{ color: 'var(--ink-3)' }} />
        )}
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="t-display" style={{ fontSize: 18 }}>Move to area</div>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--ink-3)' }}>
                <Icons.close size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(categories ?? []).map(c => (
                <button
                  key={c.id}
                  onClick={() => moveTo(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 16px', borderRadius: 10, textAlign: 'left', fontSize: 14,
                    background: c.id === currentCat ? `hsl(${c.hue},40%,92%)` : 'var(--paper-2)',
                    color:      c.id === currentCat ? `hsl(${c.hue},55%,35%)` : 'var(--ink)',
                    border: '1px solid', borderColor: c.id === currentCat ? `hsl(${c.hue},40%,80%)` : 'var(--rule)',
                  }}
                >
                  <span>{c.name}</span>
                  {c.id === currentCat && <Icons.check size={16} sw={2.5} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
