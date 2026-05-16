import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDateISO } from '../lib/useCurrentDate'
import { db, completeTask, uncompleteTask, toggleSubTask, deleteTask, updateTask, countActiveTasks } from '../data/db'
import { EFFORT, EFFORT_ORDER } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { UnifiedDuePicker } from '../components/ui/UnifiedDuePicker'
import { formatTime, formatDueLabel } from '../lib/parseDue'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { TaskPomodoro } from '../components/TaskPomodoro'
import type { Screen, Task, EffortKey, Goal } from '../types'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props {
  taskId: string
  navigate: (s: Screen) => void
  back: () => void
}

interface Burst { id: number; x: number; y: number; xp: number }

// ── Which pill is currently expanded for editing ──────────────────────────────
type EditingField = null | 'area' | 'effort' | 'status'

// ── Effort short labels for pills ────────────────────────────────────────────
const EFFORT_SHORT: Record<EffortKey, string> = {
  xs: 'Micro', s: 'Small', m: 'Medium', l: 'Long', xl: 'Mammoth', xxl: 'Gargantuan',
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
  const isDark = useIsDark()
  const bg = active
    ? hue !== undefined
      ? areaColor(hue, 'bg', isDark)
      : accent ? 'var(--accent-soft)' : warn ? 'var(--warn-soft)' : 'var(--paper-3)'
    : 'var(--paper-2)'
  const color = active
    ? hue !== undefined
      ? areaColor(hue, 'fg', isDark)
      : accent ? 'var(--accent)' : warn ? 'var(--warn)' : 'var(--ink)'
    : 'var(--ink-2)'
  const border = active
    ? hue !== undefined
      ? areaColor(hue, 'bg', isDark)
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
  const isDark = useIsDark()
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
          background: currentCat === 'inbox' ? areaColor(200, 'bg', isDark) : 'var(--paper-2)',
          color: currentCat === 'inbox' ? areaColor(200, 'fg', isDark) : 'var(--ink)',
          border: '1px solid', borderColor: currentCat === 'inbox' ? areaColor(200, 'bg', isDark) : 'var(--rule)',
        }}>
          <span>Inbox</span>
          {currentCat === 'inbox' && <Icons.check size={14} sw={2.5} />}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => { onSelect(c.id); onClose() }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 10, textAlign: 'left',
              background: c.id === currentCat ? areaColor(c.hue, 'bg', isDark) : 'var(--paper-2)',
              color: c.id === currentCat ? areaColor(c.hue, 'fg', isDark) : 'var(--ink)',
              border: '1px solid', borderColor: c.id === currentCat ? areaColor(c.hue, 'bg', isDark) : 'var(--rule)',
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
  const task        = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const settings    = useLiveQuery(() => db.settings.get(1), [])
  const categories  = useLiveQuery(() => db.categories.toArray(), [])
  const activeTasks = useLiveQuery(
    () => db.tasks.filter(t => t.status === 'active' && !t.done && t.id !== taskId).toArray(),
    [taskId],
  )
  const linkedGoal = useLiveQuery<Goal | undefined>(
    () => task?.goalId ? db.goals.get(task.goalId) : Promise.resolve(undefined),
    [task?.goalId],
  )

  // ── Local editing state ───────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [localTitle,   setLocalTitle]   = useState('')
  const [localNotes,   setLocalNotes]   = useState('')
  const [capWarning,    setCapWarning]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sub-task entry
  const [addingSub, setAddingSub] = useState(false)
  const [newSub,    setNewSub]    = useState('')
  const subInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Bursts + flash
  const [bursts,     setBursts]     = useState<Burst[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  // Init local title/notes from task
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title)
      setLocalNotes(task.notes ?? '')
    }
  }, [task?.id])  // only reset when task id changes, not on every update

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
    const { xp: gained } = await completeTask(task.id)
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

  // ── Save Changes — commits any pending title/notes, then navigates back ──
  function handleSaveChanges() {
    // Commit title if editing
    const trimmedTitle = localTitle.trim()
    if (trimmedTitle && trimmedTitle !== task?.title) save({ title: trimmedTitle })
    setEditingTitle(false)
    // Flush notes debounce immediately
    if (notesTimer.current) { clearTimeout(notesTimer.current); notesTimer.current = null }
    save({ notes: localNotes })
    setSavedFlash(true)
    // Brief "Saved!" flash then exit
    setTimeout(() => { setSavedFlash(false); back() }, 700)
  }

  if (!task) return (
    <div className="screen">
      <ScreenHeader title="" back={back} />
    </div>
  )

  // Derived values
  const area     = categories?.find(c => c.id === task.cat)
  const areaName = area?.name ?? (task.cat === 'inbox' ? 'Inbox' : task.cat)
  const areaHue  = area?.hue
  const e        = EFFORT[task.effort]
  const subDone  = task.sub.filter(s => s.d).length

  return (
    <div className="screen">
      <ScreenHeader
        title={areaName}
        iconHue={areaHue}
        back={back}
      />

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
          {linkedGoal?.why && (
            <div style={{
              fontSize: 12, fontFamily: 'var(--font-sans)',
              color: 'var(--ink-3)', marginTop: 4,
            }}>
              Towards {linkedGoal.title} — {linkedGoal.why}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            {task.streak > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>
                <Icons.flame size={12} /> {task.streak} day streak
              </div>
            )}
          </div>
        </div>

        {/* ── Type — Task / Habit ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
            Type
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Pill label="Task"  active={!task.isHabit} onClick={() => save({ isHabit: false })} />
            <Pill label="Habit" active={!!task.isHabit} onClick={() => save({ isHabit: true })} />
          </div>
        </div>

        {/* ── Pill row — Area · Effort · Status ── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {/* Recurring badge — informational, not editable here (edit via schedule) */}
          {task.recurring && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 20,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              color: 'var(--ink-3)',
            }}>
              <Icons.repeat size={10} /> {task.recurring === 'Biweekly' ? 'Fortnightly' : task.recurring}
            </span>
          )}

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
                  3 active tasks — demote one first
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
                  Slow Productivity keeps focus sharp. Move a current task to backlog to make room.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {(activeTasks ?? []).map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8,
                      background: 'var(--paper)', border: '1px solid var(--rule)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, minWidth: 0, marginRight: 8,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </span>
                      <button
                        onClick={() => { updateTask(t.id, { status: 'backlog' }); save({ status: 'active' }); setEditingField(null); setCapWarning(false) }}
                        style={{
                          flexShrink: 0, padding: '4px 10px', borderRadius: 6,
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          background: 'var(--ink)', color: 'var(--paper)', border: 'none',
                        }}
                      >
                        Demote
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCapWarning(false)} style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: 'var(--paper-3)', color: 'var(--ink-2)',
                  border: '1px solid var(--rule)',
                }}>
                  Keep as backlog
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Schedule ── */}
        <div style={{ marginBottom: 16 }}>
          <UnifiedDuePicker
            due={task.due}
            recurring={task.recurring}
            time={task.time}
            onChange={(d, r, t) => save({ due: d, recurring: r, time: t })}
          />
        </div>

        {/* ── Notes ── */}
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
            Notes
          </div>
          <textarea
            value={localNotes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Optional notes…"
            rows={localNotes ? Math.min(Math.max(localNotes.split('\n').length, 2), 5) : 2}
            style={{
              width: '100%', minHeight: 72, padding: '12px 14px',
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              borderRadius: 12, fontSize: 14, resize: 'none', lineHeight: 1.5,
              color: 'var(--ink)',
            }}
          />
        </div>


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

        {/* ── Pomodoro timer ── */}
        <div style={{ marginBottom: 20 }}>
          <TaskPomodoro
            effort={task.effort}
            xp={e.xp}
            pomodoroMins={task.pomodoroMins}
          />
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
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            <div style={{
              flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12,
              color: areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--accent)',
              letterSpacing: '0.06em',
            }}>
              ✓ COMPLETED · +{e.xp} XP EARNED
            </div>
            <button
              onClick={() => task && uncompleteTask(task.id)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                color: 'var(--ink-3)', padding: '4px 10px', borderRadius: 8,
                border: '1px solid var(--rule)', background: 'transparent', flexShrink: 0,
              }}
            >
              UNDO
            </button>
          </div>
        )}

        {/* ── Save Changes + Delete ── */}
        <div style={{ marginTop: 24, paddingBottom: 8, display: 'flex', gap: 8 }}>

          {/* Save — hidden while confirming delete */}
          {!confirmDelete && (
            <button
              onClick={handleSaveChanges}
              style={{
                flex: 6, padding: '11px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: savedFlash ? 'var(--accent)' : (areaHue !== undefined ? `hsl(${areaHue}, 55%, 42%)` : 'var(--ink)'),
                color: 'var(--paper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background .2s',
              }}
            >
              {savedFlash ? (
                <><Icons.check size={13} sw={2.5} /> Saved!</>
              ) : (
                <><Icons.check size={13} sw={2} /> Save</>
              )}
            </button>
          )}

          {/* Delete — confirm/cancel only (no Save when confirming) */}
          {confirmDelete ? (
            <>
              <button
                onClick={async () => { await deleteTask(taskId); back() }}
                style={{
                  flex: 4, padding: '11px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: 'var(--warn)', color: 'white',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 2, padding: '11px 8px', borderRadius: 10, fontSize: 12,
                  background: 'var(--paper-2)', color: 'var(--ink-3)',
                  border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)',
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                flex: 3, padding: '11px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                background: 'var(--warn-soft)', color: 'var(--warn)',
                border: '1px solid var(--warn-soft)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
