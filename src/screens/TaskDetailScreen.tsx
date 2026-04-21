import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, toggleSubTask, deleteTask, updateTask, countActiveTasks } from '../data/db'
import { EFFORT, QUAD, EFFORT_ORDER } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { UnifiedDuePicker } from '../components/ui/UnifiedDuePicker'
import { ThemeToggle } from '../components/ThemeToggle'
import type { Screen, Task, EffortKey, QuadKey } from '../types'

interface Props {
  taskId: string
  navigate: (s: Screen) => void
  back: () => void
}

interface Burst { id: number; x: number; y: number; xp: number }

// ── Which pill is currently expanded for editing ──────────────────────────────
type EditingField = null | 'area' | 'effort' | 'due' | 'priority' | 'recurring' | 'isHabit' | 'status'

// ── Compact quadrant colours ──────────────────────────────────────────────────
const QUAD_COLOR: Record<QuadKey, string> = {
  q1: 'var(--warn)', q2: 'var(--accent)', q3: 'var(--ink-3)', q4: 'var(--ink-4)',
}

// ── Effort short labels for pills ────────────────────────────────────────────
const EFFORT_SHORT: Record<EffortKey, string> = {
  xs: 'Micro', s: 'Small', m: 'Medium', l: 'Long', xl: 'Mammoth', xxl: 'Giant',
}
const EFFORT_TIME: Record<EffortKey, string> = {
  xs: '1–5m', s: '15m', m: '1h', l: '2h', xl: '6h', xxl: '1d+',
}

// ── Pill component — tappable, fills with area colour when active ─────────────
function Pill({
  label, icon, active, hue, accent, warn, onClick, children,
}: {
  label?: string
  icon?: React.ReactNode
  active?: boolean
  hue?: number
  accent?: boolean
  warn?: boolean
  onClick: () => void
  children?: React.ReactNode
}) {
  const bg = active
    ? hue !== undefined
      ? `hsl(${hue}, 40%, 88%)`
      : accent ? 'var(--accent-soft)' : warn ? 'var(--warn-soft)' : 'var(--paper-3)'
    : 'var(--paper-2)'
  const color = active
    ? hue !== undefined
      ? `hsl(${hue}, 55%, 32%)`
      : accent ? 'var(--accent)' : warn ? 'var(--warn)' : 'var(--ink)'
    : 'var(--ink-2)'
  const border = active
    ? hue !== undefined
      ? `hsl(${hue}, 35%, 76%)`
      : 'var(--rule)'
    : 'var(--rule)'

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 999,
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em',
        background: bg, color, border: `1px solid ${border}`,
        whiteSpace: 'nowrap', transition: 'background .12s, color .12s',
      }}
    >
      {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
      {label || children}
    </button>
  )
}

// ── Compact 4-button priority selector ───────────────────────────────────────
function PrioritySelector({ value, onChange }: { value: QuadKey; onChange: (q: QuadKey) => void }) {
  const opts: { id: QuadKey; label: string; sub: string }[] = [
    { id: 'q1', label: 'Do',       sub: 'Urgent & important' },
    { id: 'q2', label: 'Plan',     sub: 'Important, not urgent' },
    { id: 'q3', label: 'Delegate', sub: 'Urgent, not important' },
    { id: 'q4', label: 'Drop',     sub: 'Neither' },
  ]
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
      {opts.map(o => {
        const active = o.id === value
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            flex: '1 1 calc(50% - 3px)', minWidth: 100,
            padding: '8px 10px', borderRadius: 10, textAlign: 'left',
            background: active ? 'var(--ink)' : 'var(--paper-2)',
            color: active ? 'var(--paper)' : 'var(--ink)',
            border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
            transition: 'all .12s',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.65, marginTop: 3, letterSpacing: '0.05em' }}>{o.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

// ── Compact effort selector (horizontal scrollable chips) ─────────────────────
function EffortSelector({ value, onChange }: { value: EffortKey; onChange: (k: EffortKey) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2, marginTop: 8 }}>
      {EFFORT_ORDER.map(k => {
        const active = k === value
        const e = EFFORT[k]
        return (
          <button key={k} onClick={() => onChange(k)} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 10, textAlign: 'left',
            background: active ? 'var(--ink)' : 'var(--paper-2)',
            color: active ? 'var(--paper)' : active ? 'var(--ink)' : 'var(--ink-2)',
            border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
            opacity: active ? 1 : 0.7,
            transition: 'all .12s',
          }}>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{EFFORT_SHORT[k]}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7, marginTop: 2 }}>{EFFORT_TIME[k]}</div>
          </button>
        )
      })}
    </div>
  )
}

// ── Area selector bottom sheet ────────────────────────────────────────────────
function AreaSheet({
  currentCat,
  categories,
  onSelect,
  onClose,
}: {
  currentCat: string
  categories: { id: string; name: string; hue: number }[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Move to Area</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={18} /></button>
        </div>
        {/* Inbox */}
        <button onClick={() => { onSelect('inbox'); onClose() }} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 10, marginBottom: 6, textAlign: 'left',
          background: currentCat === 'inbox' ? 'hsl(200, 40%, 92%)' : 'var(--paper-2)',
          color: currentCat === 'inbox' ? 'hsl(200, 55%, 35%)' : 'var(--ink)',
          border: '1px solid', borderColor: currentCat === 'inbox' ? 'hsl(200, 40%, 80%)' : 'var(--rule)',
        }}>
          <span>Inbox</span>
          {currentCat === 'inbox' && <Icons.check size={14} sw={2.5} />}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => { onSelect(c.id); onClose() }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 10, textAlign: 'left',
              background: c.id === currentCat ? `hsl(${c.hue}, 40%, 92%)` : 'var(--paper-2)',
              color: c.id === currentCat ? `hsl(${c.hue}, 55%, 35%)` : 'var(--ink)',
              border: '1px solid', borderColor: c.id === currentCat ? `hsl(${c.hue}, 40%, 80%)` : 'var(--rule)',
            }}>
              <span>{c.name}</span>
              {c.id === currentCat && <Icons.check size={14} sw={2.5} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export const TaskDetailScreen = ({ taskId, navigate, back }: Props) => {
  const task       = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const settings   = useLiveQuery(() => db.settings.get(1), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const defaultMins = settings?.defaultPomodoroMins ?? 25
  const pomMins     = task?.pomodoroMins ?? defaultMins

  // ── Local editing state ───────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [localTitle,   setLocalTitle]   = useState('')
  const [localNotes,   setLocalNotes]   = useState('')
  const [advanced,     setAdvanced]     = useState(false)
  const [capWarning,   setCapWarning]   = useState(false)

  // Sub-task entry
  const [addingSub, setAddingSub] = useState(false)
  const [newSub,    setNewSub]    = useState('')
  const subInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Bursts + timer
  const [bursts,     setBursts]     = useState<Burst[]>([])
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused' | 'done'>('idle')
  const [secsLeft,   setSecsLeft]   = useState(pomMins * 60)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Init local title/notes from task
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title)
      setLocalNotes(task.notes ?? '')
    }
  }, [task?.id])  // only reset when task id changes, not on every update

  // Timer sync to pomMins
  useEffect(() => {
    setSecsLeft(pomMins * 60)
    setTimerState('idle')
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [taskId, pomMins])

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setSecsLeft(s => {
          if (s <= 1) { setTimerState('done'); clearInterval(intervalRef.current!); return 0 }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerState])

  useEffect(() => {
    if (addingSub) setTimeout(() => subInputRef.current?.focus(), 60)
  }, [addingSub])

  useEffect(() => {
    if (editingTitle) setTimeout(() => titleInputRef.current?.focus(), 30)
  }, [editingTitle])

  // ── Immediate save helpers ────────────────────────────────────────────────
  const save = useCallback((patch: Parameters<typeof updateTask>[1]) => {
    updateTask(taskId, patch)
  }, [taskId])

  function toggleField(f: EditingField) {
    setEditingField(prev => prev === f ? null : f)
    setCapWarning(false)
  }

  // ── Status change with Slow Productivity cap check ─────────────────────────
  async function handleSetStatus(s: Task['status']) {
    setCapWarning(false)
    if (s === 'active') {
      const activeCount = await countActiveTasks()
      // Don't count current task if it's already active
      const current = task?.status === 'active' ? 1 : 0
      if (activeCount - current >= 3) {
        setCapWarning(true)
        return
      }
    }
    save({ status: s })
    setEditingField(null)
  }

  // ── Notes debounce save ───────────────────────────────────────────────────
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleNotesChange(val: string) {
    setLocalNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => save({ notes: val }), 600)
  }

  // ── Title save ────────────────────────────────────────────────────────────
  function commitTitle() {
    const trimmed = localTitle.trim()
    if (trimmed && trimmed !== task?.title) save({ title: trimmed })
    setEditingTitle(false)
  }

  // ── Complete ──────────────────────────────────────────────────────────────
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

  // ── Sub-tasks ─────────────────────────────────────────────────────────────
  async function handleAddSub() {
    const t = newSub.trim()
    if (!t || !task) { setAddingSub(false); return }
    await updateTask(taskId, { sub: [...task.sub, { t, d: false }] })
    setNewSub('')
    setTimeout(() => subInputRef.current?.focus(), 30)
  }

  function resetTimer() { setTimerState('idle'); setSecsLeft(pomMins * 60) }

  if (!task) return (
    <div className="screen">
      <div style={{ padding: 20 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)' }}><Icons.back size={20} /></button>
      </div>
    </div>
  )

  // Derived values
  const area     = categories?.find(c => c.id === task.cat)
  const areaName = area?.name ?? (task.cat === 'inbox' ? 'Inbox' : task.cat)
  const areaHue  = area?.hue
  const e        = EFFORT[task.effort]
  const subDone  = task.sub.filter(s => s.d).length
  const mins     = Math.floor(secsLeft / 60)
  const secs     = secsLeft % 60
  const progress = 1 - secsLeft / (pomMins * 60)
  const r = 54, circ = 2 * Math.PI * r

  return (
    <div className="screen">
      {/* ── Nav bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
          <Icons.back size={16} />
          <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {areaName}
          </span>
        </button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <ThemeToggle />
          <button onClick={() => navigate({ name: 'schedule', taskId: task.id })} style={{ color: 'var(--ink-3)' }}>
            <Icons.calendar size={17} />
          </button>
          <button onClick={async () => {
            if (confirm('Delete this task?')) { await deleteTask(taskId); back() }
          }} style={{ color: 'var(--warn)' }}>
            <Icons.close size={17} />
          </button>
        </div>
      </div>

      <div className="screen-scroll" style={{ padding: '18px 18px 48px' }}>

        {/* ── Title ── */}
        <div style={{ marginBottom: 14 }}>
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setLocalTitle(task.title); setEditingTitle(false) } }}
              style={{
                width: '100%', fontSize: 24, fontFamily: 'var(--font-display)',
                fontStyle: 'italic', fontWeight: 600, color: 'var(--ink)',
                background: 'transparent', border: 'none', outline: 'none',
                borderBottom: '2px solid var(--accent)', paddingBottom: 4,
              }}
            />
          ) : (
            <h1
              className="t-display"
              onClick={() => { setLocalTitle(task.title); setEditingTitle(true) }}
              style={{
                fontSize: 24, marginBottom: 0, cursor: 'text',
                textDecoration: task.done ? 'line-through' : 'none',
                opacity: task.done ? 0.5 : 1,
              }}
            >
              {task.title}
            </h1>
          )}
          {task.streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>
              <Icons.flame size={12} /> {task.streak} day streak
            </div>
          )}
        </div>

        {/* ── Pill row ── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {/* Area */}
          <Pill
            label={areaName}
            active={editingField === 'area'}
            hue={areaHue}
            onClick={() => toggleField('area')}
          />

          {/* Effort */}
          <Pill
            label={`${EFFORT_SHORT[task.effort]} · ${EFFORT_TIME[task.effort]}`}
            active={editingField === 'effort'}
            onClick={() => toggleField('effort')}
          />

          {/* Due + Repeat */}
          <Pill
            label={task.recurring
              ? `${task.due || 'No date'} · ${task.recurring}`
              : (task.due || 'No date')
            }
            active={editingField === 'due'}
            accent={task.due === 'Today'}
            warn={task.due === 'Overdue'}
            onClick={() => toggleField('due')}
          />

          {/* Priority */}
          <Pill
            label={QUAD[task.quad].short}
            active={editingField === 'priority'}
            warn={task.quad === 'q1'}
            accent={task.quad === 'q2'}
            onClick={() => toggleField('priority')}
          />

          {/* Habit pill — only shown when this IS a habit */}
          {!!task.isHabit && (
            <Pill
              icon={<Icons.flame size={10} />}
              label="Habit"
              active
              warn
              onClick={() => save({ isHabit: false })}
            />
          )}

          {/* Status — Slow Productivity workflow state */}
          <Pill
            label={task.status === 'active' ? '⚡ Active' : task.status === 'someday' ? 'Someday' : 'Backlog'}
            active={editingField === 'status'}
            accent={task.status === 'active'}
            onClick={() => toggleField('status')}
          />
        </div>

        {/* ── Inline editor panels ── */}
        {editingField === 'area' && categories && (
          <AreaSheet
            currentCat={task.cat}
            categories={categories}
            onSelect={id => save({ cat: id })}
            onClose={() => setEditingField(null)}
          />
        )}

        {editingField === 'effort' && (
          <div style={{ padding: '0 0 12px' }}>
            <EffortSelector value={task.effort} onChange={k => { save({ effort: k }); setEditingField(null) }} />
          </div>
        )}

        {editingField === 'due' && (
          <div style={{ padding: '8px 0 12px' }}>
            <UnifiedDuePicker
              due={task.due}
              recurring={task.recurring}
              onChange={(d, r) => { save({ due: d, recurring: r }); setEditingField(null) }}
            />
          </div>
        )}

        {editingField === 'priority' && (
          <div style={{ padding: '0 0 12px' }}>
            <PrioritySelector value={task.quad} onChange={q => { save({ quad: q }); setEditingField(null) }} />
          </div>
        )}

        {editingField === 'status' && (
          <div style={{ padding: '0 0 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: capWarning ? 10 : 0 }}>
              {(['backlog', 'someday', 'active'] as const).map(s => {
                const labels = { backlog: 'Backlog', someday: 'Someday', active: '⚡ Active' }
                const current = (task.status ?? 'backlog') === s
                return (
                  <button key={s} onClick={() => handleSetStatus(s)} style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10,
                    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.03em',
                    background: current ? (s === 'active' ? 'var(--accent)' : 'var(--ink)') : 'var(--paper-2)',
                    color: current ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: current ? 'transparent' : 'var(--rule)',
                  }}>
                    {labels[s]}
                  </button>
                )
              })}
            </div>
            {/* Slow Productivity cap warning */}
            {capWarning && (
              <div style={{
                background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  You already have 3 active tasks
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
                  Slow Productivity works best with a max of 3 active tasks — it keeps your focus sharp and prevents the overwhelm of too many open commitments.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { save({ status: 'active' }); setEditingField(null); setCapWarning(false) }} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    background: 'var(--ink)', color: 'var(--paper)', border: 'none',
                  }}>
                    Activate anyway
                  </button>
                  <button onClick={() => setCapWarning(false)} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    background: 'var(--paper-3)', color: 'var(--ink-2)',
                    border: '1px solid var(--rule)',
                  }}>
                    Keep as backlog
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notes — always visible inline textarea ── */}
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
            Notes
          </div>
          <textarea
            value={localNotes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Add notes…"
            rows={localNotes ? Math.min(Math.max(localNotes.split('\n').length, 2), 6) : 2}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              borderRadius: 10, fontSize: 13, resize: 'none', lineHeight: 1.55,
              color: 'var(--ink)', fontFamily: 'inherit',
              transition: 'border-color .15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--rule)' }}
          />
        </div>

        {/* ── Basic / Advanced toggle ── */}
        <button
          onClick={() => setAdvanced(a => !a)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
            color: 'var(--ink-3)', textTransform: 'uppercase',
          }}
        >
          <span style={{
            width: 14, height: 14, borderRadius: 3, border: '1px solid var(--rule)',
            background: advanced ? 'var(--ink)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {advanced && <Icons.check size={8} sw={2.5} style={{ color: 'var(--paper)' }} />}
          </span>
          {advanced ? 'Advanced options' : 'Show advanced options'}
        </button>

        {/* ── Advanced panel ── */}
        {advanced && (
          <div style={{
            marginBottom: 20, padding: '14px 14px 16px',
            background: 'var(--paper-2)', borderRadius: 12, border: '1px solid var(--rule)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Context */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                Context
              </div>
              <input
                defaultValue={task.ctx ?? '@anywhere'}
                onBlur={e => save({ ctx: e.target.value })}
                placeholder="@anywhere"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9,
                  border: '1px solid var(--rule)', background: 'var(--paper)',
                  fontSize: 13, color: 'var(--ink)',
                }}
              />
            </div>

            {/* Habit — shown in Advanced only when task is NOT a habit */}
            {!task.isHabit && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                  Habit tracking
                </div>
                <button
                  onClick={() => save({ isHabit: true })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10, width: '100%',
                    background: 'var(--paper)', border: '1px solid var(--rule)',
                  }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--paper-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-3)',
                  }}>
                    <Icons.flame size={13} />
                  </span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Mark as habit</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 1, letterSpacing: '0.04em' }}>
                      Tracks daily check-ins &amp; streaks
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Pomodoro override */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                Focus duration — {pomMins} min
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {[15, 25, 35, 50, 90].map(m => (
                  <button key={m} onClick={() => save({ pomodoroMins: m })} style={{
                    padding: '6px 10px', borderRadius: 8,
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    background: pomMins === m ? 'var(--ink)' : 'var(--paper)',
                    color: pomMins === m ? 'var(--paper)' : 'var(--ink-3)',
                    border: '1px solid', borderColor: pomMins === m ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-tasks ── */}
        <div style={{ marginBottom: 20 }}>
          {task.sub.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Sub-tasks
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                  {subDone}/{task.sub.length}
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 2, borderRadius: 1, background: 'var(--paper-3)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  background: areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--accent)',
                  width: `${task.sub.length > 0 ? (subDone / task.sub.length) * 100 : 0}%`,
                  transition: 'width .3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {task.sub.map((s, i) => (
                  <button key={i} onClick={() => toggleSubTask(task.id, i)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: 'var(--paper-2)', borderRadius: 9, border: '1px solid var(--rule)',
                    textAlign: 'left', opacity: s.d ? 0.5 : 1, transition: 'opacity .15s',
                  }}>
                    <div style={{
                      flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                      border: `1.5px solid ${s.d ? (areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--accent)') : 'var(--rule)'}`,
                      background: s.d ? (areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--accent)') : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {s.d && <Icons.check size={9} sw={2.5} style={{ color: 'var(--paper)' }} />}
                    </div>
                    <span style={{
                      fontSize: 13, textDecoration: s.d ? 'line-through' : 'none',
                      color: s.d ? 'var(--ink-3)' : 'var(--ink)',
                    }}>
                      {s.t}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Ghost input for sub-task entry */}
          {addingSub ? (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <input
                ref={subInputRef}
                value={newSub}
                onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSub()
                  if (e.key === 'Escape') { setAddingSub(false); setNewSub('') }
                }}
                placeholder="Sub-task title…"
                style={{
                  flex: 1, padding: '9px 11px', borderRadius: 9,
                  border: '1px solid var(--accent)', background: 'var(--paper-2)',
                  fontSize: 13, color: 'var(--ink)',
                }}
              />
              <button
                onClick={handleAddSub} disabled={!newSub.trim()}
                style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: newSub.trim() ? 'var(--ink)' : 'var(--paper-3)',
                  color: newSub.trim() ? 'var(--paper)' : 'var(--ink-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icons.check size={13} sw={2.5} />
              </button>
              <button
                onClick={() => { setAddingSub(false); setNewSub('') }}
                style={{ width: 34, height: 34, borderRadius: 9, color: 'var(--ink-3)', flexShrink: 0, border: '1px solid var(--rule)' }}
              >
                <Icons.close size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSub(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
                borderRadius: 9, border: '1px dashed var(--rule)',
                color: 'var(--ink-3)', fontSize: 13, width: '100%',
              }}
            >
              <Icons.plus size={13} />
              Add sub-task
            </button>
          )}
        </div>

        {/* ── Complete button ── */}
        {!task.done ? (
          <button onClick={handleComplete} style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--ink)',
            color: 'var(--paper)', fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 20,
          }}>
            <Icons.check size={17} sw={2.5} />
            Mark Complete · +{e.xp} XP
          </button>
        ) : (
          <div style={{
            textAlign: 'center', padding: '15px', marginBottom: 20,
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--accent)',
            letterSpacing: '0.06em',
          }}>
            ✓ COMPLETED · +{e.xp} XP EARNED
          </div>
        )}

        {/* ── Pomodoro timer (always visible at bottom) ── */}
        <div style={{
          background: 'var(--paper-2)', borderRadius: 14, padding: '18px 18px 22px',
          border: '1px solid var(--rule)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Focus Timer
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              {pomMins} min
            </span>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width={120} height={120}>
              <circle cx={60} cy={60} r={r} fill="none" stroke="var(--rule)" strokeWidth={5} />
              <circle cx={60} cy={60} r={r} fill="none"
                stroke={timerState === 'done' ? 'var(--accent)' : areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--ink)'}
                strokeWidth={5} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em',
                color: timerState === 'done' ? 'var(--accent)' : 'var(--ink)',
              }}>
                {timerState === 'done' ? '🎉' : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            {(timerState === 'idle' || timerState === 'done') && (
              <button onClick={() => { resetTimer(); setTimerState('running') }} style={{
                width: 48, height: 48, borderRadius: '50%', background: 'var(--ink)',
                color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.play size={16} />
              </button>
            )}
            {timerState === 'running' && (
              <button onClick={() => setTimerState('paused')} style={{
                width: 48, height: 48, borderRadius: '50%', background: 'var(--ink)',
                color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.pause size={16} />
              </button>
            )}
            {timerState === 'paused' && (
              <button onClick={() => setTimerState('running')} style={{
                width: 48, height: 48, borderRadius: '50%', background: 'var(--ink)',
                color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.play size={16} />
              </button>
            )}
            {timerState !== 'idle' && (
              <button onClick={resetTimer} style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--paper-3)', border: '1px solid var(--rule)',
                color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.reset size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
