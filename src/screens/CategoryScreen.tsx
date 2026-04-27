import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, addTask, deleteTask, updateCategory, deleteCategory, updateTask } from '../data/db'
import { DEFAULT_CATEGORIES, EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst, Seg } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { SwipeableRow } from '../components/SwipeableRow'
import { formatTime, formatDueLabel } from '../lib/parseDue'
import type { Screen, Task, Category } from '../types'

interface Props { catId: string; navigate: (s: Screen) => void; back: () => void; onAddTask?: () => void }
interface Burst { id: number; x: number; y: number; xp: number }

// ── Area icons ────────────────────────────────────────────────────────────────
const AREA_ICONS = ['home','heart','briefcase','book','dollar','family','leaf','drop','bolt','star','bell','layers','pet']
const BUILTIN_IDS = new Set(['home'])

// ── Edit Area Modal ───────────────────────────────────────────────────────────
function EditAreaModal({ cat, onClose, onDelete }: { cat: Category; onClose: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(cat.name)
  const [icon, setIcon] = useState(cat.icon)
  const [hue,  setHue]  = useState(cat.hue)

  async function handleSave() {
    if (!name.trim()) return
    await updateCategory(cat.id, { name: name.trim(), icon, hue })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 22 }}>Edit Area</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Name</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AREA_ICONS.map(ic => {
                const I = Icons[ic as keyof typeof Icons] ?? Icons.home
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
            Save changes
          </button>
          {onDelete && (
            <button onClick={onDelete} style={{
              width: '100%', padding: '12px', borderRadius: 12, fontSize: 13,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              color: 'var(--warn)', border: '1px solid var(--warn)',
              background: 'transparent', marginTop: 4,
            }}>
              Delete area
            </button>
          )}
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
            Tasks in this area will move to your Inbox. This can't be undone.
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

// ── Today ISO ─────────────────────────────────────────────────────────────────
const todayISO = new Date().toISOString().slice(0, 10)

// ── Habit check-in card ───────────────────────────────────────────────────────
// Shows "logged today" state without strikethrough — it's an ongoing habit, not
// a permanent completion.
function HabitRow({
  task, hue,
  onCheckin, onTap,
}: {
  task: Task
  hue: number
  onCheckin: (e: React.MouseEvent) => void
  onTap: () => void
}) {
  const loggedToday = task.done  // done=true means it was logged today; resets tomorrow
  const color = `hsl(${hue}, 55%, 42%)`
  const softBg = `hsl(${hue}, 40%, 93%)`
  const softColor = `hsl(${hue}, 55%, 35%)`

  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 13px 10px 10px',
        background: loggedToday ? softBg : 'var(--paper-2)',
        borderRadius: 12,
        border: `1px solid ${loggedToday ? `hsl(${hue}, 35%, 80%)` : 'var(--rule)'}`,
        borderLeft: `3px solid ${color}`,
        textAlign: 'left', width: '100%',
        transition: 'all .15s',
      }}
    >
      {/* Check-in button */}
      <button
        onClick={onCheckin}
        title={loggedToday ? 'Logged today' : 'Log check-in'}
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${loggedToday ? color : `hsl(${hue}, 30%, 72%)`}`,
          background: loggedToday ? color : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: loggedToday ? 'white' : color,
          transition: 'all .15s',
        }}
      >
        <Icons.flame size={13} />
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.3,
          color: loggedToday ? softColor : 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {loggedToday ? (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: softColor, fontWeight: 600,
            }}>
              ✓ logged today
            </span>
          ) : (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: 'var(--ink-4)',
            }}>
              tap flame to log
            </span>
          )}
          {task.streak > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icons.flame size={8} /> {task.streak}d streak
            </span>
          )}
          {task.recurring && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icons.repeat size={8} /> {task.recurring}
            </span>
          )}
        </div>
      </div>

      <Icons.arrow size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
    </button>
  )
}

// ── Compact task row for category view ───────────────────────────────────────
function CategoryTaskRow({
  task, hue, onTap, onComplete,
  isExpanded, onToggleExpand,
}: {
  task: Task
  hue: number
  onTap: () => void
  onComplete: (e: React.MouseEvent) => void
  isExpanded?: boolean
  onToggleExpand?: () => void
}) {
  const e = EFFORT[task.effort]
  const timeLabel = task.time ? formatTime(task.time) : null
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  const dueLabel = task.due
    ? (isoRe.test(task.due) ? formatDueLabel(task.due) : task.due)
    : ''
  const todayISO = new Date().toISOString().slice(0, 10)
  const dueColor = task.due === 'Today' ? 'var(--accent)'
    : (task.due === 'Overdue' || (isoRe.test(task.due) && task.due < todayISO)) ? 'var(--warn)'
    : task.due === 'Tomorrow' ? 'var(--ink-2)'
    : 'var(--ink-3)'
  const accentColor = `hsl(${hue}, 55%, 42%)`
  const subDone = task.sub?.filter(s => s.d).length ?? 0
  const subTotal = task.sub?.length ?? 0

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid var(--rule)',
        cursor: 'pointer',
        opacity: task.done ? 0.45 : 1,
      }}
    >
      {/* Complete button */}
      <button
        onClick={ev => { ev.stopPropagation(); onComplete(ev) }}
        style={{
          flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
          border: `1.5px solid ${task.done ? accentColor : 'var(--ink-3)'}`,
          background: task.done ? accentColor : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <Icons.check size={10} sw={2.5} stroke="var(--paper)" />}
      </button>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500,
          textDecoration: task.done ? 'line-through' : 'none',
          color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        <div style={{
          display: 'flex', gap: 6, marginTop: 2, alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
          flexWrap: 'wrap',
        }}>
          <span>{e?.label ?? 'Medium'}</span>

          {timeLabel && (
            <><span style={{ opacity: 0.4 }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Icons.timer size={9} /> {timeLabel}
            </span></>
          )}

          {task.recurring && (
            <><span style={{ opacity: 0.4 }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Icons.repeat size={9} /> {task.recurring}
            </span></>
          )}

          {task.streak > 0 && (
            <><span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Icons.flame size={9} /> {task.streak}d
            </span></>
          )}

          {subTotal > 0 && (
            <><span style={{ opacity: 0.4 }}>·</span>
            <span
              onClick={onToggleExpand ? ev => { ev.stopPropagation(); onToggleExpand() } : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                cursor: onToggleExpand ? 'pointer' : 'default',
                color: subDone === subTotal ? accentColor : 'var(--ink-3)',
              }}
            >
              <Icons.check size={9} sw={2} />
              {subDone}/{subTotal}
              {onToggleExpand && (
                <span style={{ opacity: 0.5, fontSize: 8 }}>{isExpanded ? '▲' : '▼'}</span>
              )}
            </span></>
          )}
        </div>
        {task.notes && (
          <div style={{
            fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)',
            marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {task.notes.replace(/\n/g, ' ').slice(0, 80)}{task.notes.length > 80 ? '…' : ''}
          </div>
        )}
      </div>

      {/* Due label */}
      {dueLabel && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, flexShrink: 0,
          color: dueColor, fontWeight: task.due === 'Today' ? 600 : 400,
        }}>
          {dueLabel}
        </span>
      )}
    </div>
  )
}

// ── Ghost inline task input ───────────────────────────────────────────────────
function GhostInput({
  catId, hue, onSaved,
}: {
  catId: string
  hue: number
  onSaved: () => void
}) {
  const [active, setActive] = useState(false)
  const [value,  setValue]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 40)
  }, [active])

  async function handleSave() {
    const t = value.trim()
    if (!t) { setActive(false); return }
    await addTask({
      id: `t${Date.now()}`,
      title: t,
      cat: catId,
      effort: 's',
      due: '',
      ctx: '@anywhere',
      quad: 'q2',
      recurring: null,
      done: false,
      streak: 0,
      sub: [],
    })
    setValue('')
    setActive(false)
    onSaved()
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '9px 13px',
          borderRadius: 12, border: `1px dashed var(--rule)`,
          color: 'var(--ink-4)', fontSize: 13,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          border: `1.5px dashed hsl(${hue}, 35%, 70%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: `hsl(${hue}, 45%, 60%)`, flexShrink: 0,
        }}>
          <Icons.plus size={11} />
        </span>
        New task…
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) handleSave()
          if (e.key === 'Escape') { setValue(''); setActive(false) }
        }}
        placeholder="Task title…"
        style={{
          flex: 1, padding: '10px 13px', borderRadius: 12,
          border: `2px solid hsl(${hue}, 45%, 60%)`,
          background: 'var(--paper-2)', fontSize: 14, color: 'var(--ink)',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSave}
        disabled={!value.trim()}
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: value.trim() ? `hsl(${hue}, 55%, 42%)` : 'var(--paper-3)',
          color: value.trim() ? 'white' : 'var(--ink-4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icons.check size={14} sw={2.5} />
      </button>
      <button
        onClick={() => { setValue(''); setActive(false) }}
        style={{ width: 38, height: 38, borderRadius: 10, color: 'var(--ink-3)', border: '1px solid var(--rule)', flexShrink: 0 }}
      >
        <Icons.close size={14} />
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export const CategoryScreen = ({ catId, navigate, back, onAddTask }: Props) => {
  const [filter, setFilter]       = useState<'all' | 'open' | 'done'>('open')
  const [bursts, setBursts]       = useState<Burst[]>([])
  const [savedFlash, setSavedFlash] = useState(false)
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const tasks = useLiveQuery(() => db.tasks.where('cat').equals(catId).toArray(), [catId])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const cat   = cats.find(c => c.id === catId)

  if (!tasks || !cat) return null

  // Split recurring tasks from regular tasks (habits now live in the habits table)
  const habitTasks   = tasks.filter(t => !!t.recurring)
  const regularTasks = tasks.filter(t => !t.recurring)

  const filteredRegular = regularTasks.filter(t =>
    filter === 'all'  ? true :
    filter === 'open' ? !t.done : t.done
  )

  const doneCount  = tasks.filter(t => t.done && !t.recurring).length
  const totalCount = regularTasks.length
  const hue = cat.hue

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== b[0]?.id)), 1400)
    }
  }

  async function handleHabitCheckin(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return  // already logged today
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== b[0]?.id)), 1400)
    }
  }

  const I = Icons[cat.icon] ?? Icons.home
  const isCustom = !BUILTIN_IDS.has(catId)

  async function handleDeleteArea() {
    const areaTasks = await db.tasks.where('cat').equals(catId).toArray()
    await Promise.all(areaTasks.map(t => updateTask(t.id, { cat: 'inbox' })))
    await deleteCategory(catId)
    setShowDelete(false)
    back()
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <Icons.back size={16} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowEdit(true)} style={{ color: 'var(--ink-3)' }} title="Edit area">
              <Icons.edit size={17} />
            </button>
            <ThemeToggle />
            <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
              <Icons.settings size={20} />
            </button>
          </div>
        </div>

        {/* Area identity row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: `hsl(${hue}, 40%, 90%)`,
            color: `hsl(${hue}, 55%, 38%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <I size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="t-display" style={{ fontSize: 22 }}>{cat.name}</h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 1 }}>
              {totalCount > 0
                ? `${doneCount}/${totalCount} done`
                : habitTasks.length > 0
                  ? `${habitTasks.length} recurring`
                  : 'empty'}
            </div>
          </div>
        </div>

        {/* Progress bar (regular tasks only) */}
        {totalCount > 0 && (
          <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: `hsl(${hue}, 55%, 42%)`, width: `${(doneCount / totalCount) * 100}%`, transition: 'width .4s' }} />
          </div>
        )}
      </div>

      {/* Filter (regular tasks only) */}
      {regularTasks.length > 0 && (
        <div style={{ padding: '9px 18px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
          <Seg
            value={filter}
            setValue={v => setFilter(v as typeof filter)}
            options={[{ v: 'open', l: 'Open' }, { v: 'all', l: 'All' }, { v: 'done', l: 'Done' }]}
          />
        </div>
      )}

      <div className="screen-scroll" style={{ padding: '14px 18px 48px' }}>

        {/* ── Recurring tasks section ── */}
        {habitTasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
              <Icons.repeat size={12} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Recurring Tasks
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                {habitTasks.filter(t => t.done).length}/{habitTasks.length} done today
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {habitTasks.map(task => (
                <SwipeableRow
                  key={task.id}
                  disabled={task.done}
                  onComplete={() => completeTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                >
                  <HabitRow
                    task={task}
                    hue={hue}
                    onCheckin={e => handleHabitCheckin(e, task)}
                    onTap={() => navigate({ name: 'task', taskId: task.id })}
                  />
                </SwipeableRow>
              ))}
            </div>
          </div>
        )}

        {/* ── Regular tasks section ── */}
        {(habitTasks.length > 0 && regularTasks.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Tasks
            </span>
          </div>
        )}

        {filteredRegular.length === 0 && regularTasks.length === 0 && habitTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            No tasks yet — use the input below to add one
          </div>
        ) : filteredRegular.length === 0 && regularTasks.length > 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            {filter === 'done' ? 'No completed tasks yet' : 'No open tasks — nice work!'}
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {filteredRegular.map(task => {
              const isExpanded = expandedIds.has(task.id)
              const hasSubs = (task.sub?.length ?? 0) > 0
              const accentColor = `hsl(${hue}, 55%, 42%)`
              return (
                <div key={task.id}>
                  <SwipeableRow
                    disabled={task.done}
                    onComplete={() => completeTask(task.id)}
                    onDelete={() => deleteTask(task.id)}
                  >
                    <CategoryTaskRow
                      task={task}
                      hue={hue}
                      onTap={() => navigate({ name: 'task', taskId: task.id })}
                      onComplete={e => handleComplete(e, task)}
                      isExpanded={isExpanded}
                      onToggleExpand={hasSubs ? () => toggleExpand(task.id) : undefined}
                    />
                  </SwipeableRow>
                  {isExpanded && hasSubs && (
                    <div style={{
                      marginLeft: 12, paddingLeft: 18,
                      borderLeft: `2px solid hsl(${hue}, 40%, 80%)`,
                      marginBottom: 2,
                    }}>
                      {task.sub.map((s, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 4px',
                          borderBottom: i < task.sub.length - 1 ? '1px solid var(--rule)' : 'none',
                          opacity: s.d ? 0.5 : 1,
                        }}>
                          <div style={{
                            width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                            border: `1.5px solid ${s.d ? accentColor : 'var(--rule)'}`,
                            background: s.d ? accentColor : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {s.d && <Icons.check size={8} sw={2.5} stroke="var(--paper)" />}
                          </div>
                          <span style={{
                            fontSize: 12, color: s.d ? 'var(--ink-3)' : 'var(--ink)',
                            textDecoration: s.d ? 'line-through' : 'none',
                          }}>
                            {s.t}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Ghost inline task input ── */}
        {filter !== 'done' && (
          <GhostInput catId={catId} hue={hue} onSaved={() => setSavedFlash(true)} />
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
      {showEdit && cat && (
        <EditAreaModal
          cat={cat}
          onClose={() => setShowEdit(false)}
          onDelete={isCustom ? () => { setShowEdit(false); setShowDelete(true) } : undefined}
        />
      )}
      {showDelete && cat && (
        <DeleteAreaSheet
          cat={cat}
          onConfirm={handleDeleteArea}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
