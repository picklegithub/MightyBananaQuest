import { makeId } from '../lib/makeId'
import { localDateISO } from '../lib/useCurrentDate'
import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, uncompleteTask, addTask, deleteTask, updateCategory, deleteCategory, updateTask } from '../data/db'
import { DEFAULT_CATEGORIES, EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { SwipeableRow } from '../components/SwipeableRow'
import { formatTime, formatDueLabel, nextDueLabel, isDueToday, isDueTomorrow } from '../lib/parseDue'
import type { Screen, Task, Category } from '../types'
import { useNav } from '../lib/navContext'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props { catId: string; navigate?: (s: Screen) => void; back?: () => void; onAddTask?: () => void; allCatIds?: string[] }
interface Burst { id: number; x: number; y: number; xp: number }
interface NextBanner { id: number; text: string }

// ── Area icons ────────────────────────────────────────────────────────────────
const AREA_ICONS = ['home','heart','briefcase','book','dollar','family','leaf','drop','bolt','star','bell','layers','pet']
const BUILTIN_IDS = new Set<string>()

// ── Edit Area Modal ───────────────────────────────────────────────────────────
function EditAreaModal({ cat, onClose, onDelete }: { cat: Category; onClose: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(cat.name)
  const [icon, setIcon] = useState(cat.icon)
  const [hue,  setHue]  = useState(cat.hue)
  const isDark           = useIsDark()

  async function handleSave() {
    if (!name.trim()) return
    await updateCategory(cat.id, { name: name.trim(), icon, hue })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
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
                    background: icon === ic ? areaColor(hue, 'fg', isDark) : 'var(--paper-2)',
                    color: icon === ic ? 'var(--paper)' : 'var(--ink-2)',
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
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 110, display: 'flex', alignItems: 'flex-end' }}
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

// ── Today ISO (computed per-render; not module-level to avoid stale dates) ────
const todayISO = localDateISO()

// ── Recurring task row ────────────────────────────────────────────────────────
// Looks and behaves like a normal task row — complete circle, strikethrough on
// done. The repeat schedule is shown as metadata, not as a "check-in" action.
// Recurring ≠ habit: each occurrence is still a task that must be completed.
function RecurringTaskRow({
  task, hue,
  onComplete, onTap,
}: {
  task: Task
  hue: number
  onComplete: (e: React.MouseEvent) => void
  onTap: () => void
}) {
  const isDark = useIsDark()
  const color  = areaColor(hue, 'fg', isDark)

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px 10px 8px',
        borderBottom: '1px solid var(--rule)',
        borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
        opacity: task.done ? 0.45 : 1,
      }}
    >
      {/* Standard complete circle */}
      <button
        onClick={ev => { ev.stopPropagation(); onComplete(ev) }}
        title={task.done ? 'Completed' : 'Mark done'}
        style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          border: `1.5px solid ${task.done ? color : 'var(--ink-3)'}`,
          background: task.done ? color : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <Icons.check size={11} sw={2.5} stroke="var(--paper)" />}
      </button>

      {/* Title + schedule meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, lineHeight: 1.3,
          color: 'var(--ink)',
          textDecoration: task.done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {task.recurring && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icons.repeat size={8} /> {task.recurring}
            </span>
          )}
          {task.time && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icons.timer size={8} /> {task.time}
            </span>
          )}
        </div>
      </div>
    </div>
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
  const isDark = useIsDark()
  const e = EFFORT[task.effort]
  const timeLabel = task.time ? formatTime(task.time) : null
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  const dueLabel = task.due ? formatDueLabel(task.due) : ''
  const todayISO = localDateISO()
  const dueColor = isDueToday(task.due) ? 'var(--accent)'
    : (task.due === 'Overdue' || (isoRe.test(task.due) && task.due < todayISO)) ? 'var(--warn)'
    : isDueTomorrow(task.due) ? 'var(--ink-2)'
    : 'var(--ink-3)'
  const accentColor = areaColor(hue, 'fg', isDark)
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
  const isDark   = useIsDark()
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
      id: makeId(),
      title: t,
      cat: catId,
      effort: 's',
      due: '',
      
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
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '11px 0',
          borderBottom: '1px solid var(--rule)',
          color: 'var(--ink-4)', fontSize: 14,
        }}
      >
        <Icons.plus size={13} style={{ flexShrink: 0, color: areaColor(hue, 'fg', isDark) }} />
        <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>New task…</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
      <Icons.plus size={13} style={{ flexShrink: 0, color: areaColor(hue, 'fg', isDark) }} />
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) handleSave()
          if (e.key === 'Escape') { setValue(''); setActive(false) }
        }}
        onBlur={() => { if (!value.trim()) setActive(false) }}
        placeholder="Task title…"
        className="journal-input"
        style={{
          flex: 1, background: 'transparent', border: 'none',
          borderBottom: '1px solid var(--rule)', outline: 'none',
          padding: '8px 0', fontSize: 14, color: 'var(--ink)',
          transition: 'border-bottom-color .15s',
        }}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export const CategoryScreen = ({ catId, navigate: navProp, back: backProp, onAddTask: onAddTaskProp }: Props) => {
  const { navigate: ctxNavigate, back: ctxBack, openAddTask: ctxAddTask } = useNav()
  const navigate   = navProp      ?? ctxNavigate
  const back       = backProp     ?? ctxBack
  const onAddTask  = onAddTaskProp ?? ctxAddTask
  const isDark = useIsDark()
  const [activeCatId, setActiveCatId] = useState(catId)
  const [bursts, setBursts]         = useState<Burst[]>([])
  const [nextBanner, setNextBanner] = useState<NextBanner | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [showEdit,   setShowEdit]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [undoTask,    setUndoTask]    = useState<{ id: string; title: string } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const tasks = useLiveQuery(() => db.tasks.where('cat').equals(activeCatId).toArray(), [activeCatId])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const cat   = cats.find(c => c.id === activeCatId)

  if (!tasks || !cat) return null

  // Recurring tasks repeat on a schedule — each occurrence is still a task.
  // Habits live in their own table (db.habits) and are tracked separately by streak.
  const recurringTasks = tasks.filter(t => !!t.recurring)
  const regularTasks   = tasks.filter(t => !t.recurring)

  const openRegular = regularTasks.filter(t => !t.done)
  const doneRegular = regularTasks.filter(t => t.done)

  const doneCount  = doneRegular.length
  const totalCount = regularTasks.length
  const hue = cat.hue

  // Reset filter when switching areas
  function switchArea(id: string) {
    setActiveCatId(id)
    setExpandedIds(new Set())
  }

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) { await uncompleteTask(task.id); return }
    const { xp: gained, nextDue } = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== b[0]?.id)), 1400)
    }
    if (nextDue) {
      const bid = Date.now()
      setNextBanner({ id: bid, text: `✓ Done!  Next: ${nextDueLabel(nextDue)}` })
      setTimeout(() => setNextBanner(b => b?.id === bid ? null : b), 2500)
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoTask({ id: task.id, title: task.title })
    undoTimerRef.current = setTimeout(() => setUndoTask(null), 4000)
  }

  async function handleUndo() {
    if (!undoTask) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoTask(null)
    await uncompleteTask(undoTask.id)
  }

  const I = Icons[cat.icon] ?? Icons.home
  const isCustom = !BUILTIN_IDS.has(activeCatId)

  async function handleDeleteArea() {
    const areaTasks = await db.tasks.where('cat').equals(activeCatId).toArray()
    await Promise.all(areaTasks.map(t => updateTask(t.id, { cat: 'inbox' })))
    await deleteCategory(activeCatId)
    setShowDelete(false)
    back()
  }

  return (
    <div className="screen">
      <ScreenHeader
        iconHue={hue}
        title={cat.name}
        subtitle={
          totalCount > 0
            ? `${doneCount}/${totalCount} done`
            : recurringTasks.length > 0
              ? `${recurringTasks.length} on schedule`
              : 'empty'
        }
        back={back}
        rightActions={
          <button onClick={() => setShowEdit(true)} title="Edit area" style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: areaColor(hue, 'bg', isDark),
            color: areaColor(hue, 'fg', isDark),
            border: '1px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I size={16} />
          </button>
        }
        footer={totalCount > 0 ? (
          <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: areaColor(hue, 'fg', isDark), width: `${(doneCount / totalCount) * 100}%`, transition: 'width .4s' }} />
          </div>
        ) : undefined}
      />

      {/* ── Area tab carousel ── */}
      {cats.length > 1 && (
        <div
          className="no-scrollbar"
          style={{
            display: 'flex', gap: 20, overflowX: 'auto',
            padding: '0 18px',
            borderBottom: '1px solid var(--rule)',
            flexShrink: 0,
          }}
        >
          {cats.map(c => {
            const active = c.id === activeCatId
            return (
              <button
                key={c.id}
                onClick={() => switchArea(c.id)}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: active ? 22 : 17,
                  fontStyle: active ? 'italic' : 'normal',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  whiteSpace: 'nowrap',
                  paddingBottom: 10,
                  paddingTop: 10,
                  borderBottom: active ? `2px solid var(--ink)` : '2px solid transparent',
                  transition: 'all .2s',
                  flexShrink: 0,
                }}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}


      <div className="screen-scroll" style={{ padding: '14px 18px 48px' }}>

        {/* ── On-schedule tasks ── */}
        {/* These are tasks with a recurrence schedule — each occurrence is a    */}
        {/* normal task. Completing one creates the next. Not habits.            */}
        {recurringTasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
              <Icons.repeat size={12} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                On Schedule
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                {recurringTasks.filter(t => t.done).length}/{recurringTasks.length} done
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recurringTasks.map(task => (
                <SwipeableRow
                  key={task.id}
                  done={task.done}
                  onComplete={() => task.done ? uncompleteTask(task.id) : completeTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                >
                  <RecurringTaskRow
                    task={task}
                    hue={hue}
                    onComplete={e => handleComplete(e, task)}
                    onTap={() => navigate({ name: 'task', taskId: task.id })}
                  />
                </SwipeableRow>
              ))}
            </div>
          </div>
        )}

        {/* ── Regular tasks section ── */}
        {(recurringTasks.length > 0 && regularTasks.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Tasks
            </span>
          </div>
        )}

        {/* Open tasks — or empty state */}
        {regularTasks.length === 0 && recurringTasks.length === 0 ? (
          <div style={{ padding: '28px 0 4px', textAlign: 'center' }}>
            <div className="t-display t-italic" style={{ fontSize: 16, color: 'var(--ink-3)' }}>
              No tasks yet.
            </div>
          </div>
        ) : (
          <>
            {openRegular.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {openRegular.map(task => {
                  const isExpanded = expandedIds.has(task.id)
                  const hasSubs = (task.sub?.length ?? 0) > 0
                  const accentColor = areaColor(hue, 'fg', isDark)
                  return (
                    <div key={task.id}>
                      <SwipeableRow
                        done={task.done}
                        onComplete={() => task.done ? uncompleteTask(task.id) : completeTask(task.id)}
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
                        <div style={{ marginLeft: 12, paddingLeft: 18, borderLeft: `2px solid ${areaColor(hue, 'fg', isDark)}`, marginBottom: 2 }}>
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
                              <span style={{ fontSize: 12, color: s.d ? 'var(--ink-3)' : 'var(--ink)', textDecoration: s.d ? 'line-through' : 'none' }}>
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

            {openRegular.length === 0 && regularTasks.length > 0 && (
              <div style={{ padding: '12px 0 4px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                All done ✓
              </div>
            )}
          </>
        )}

        {/* Ghost input — always visible, whether area is empty or has tasks */}
        <GhostInput catId={activeCatId} hue={hue} onSaved={() => setSavedFlash(true)} />

        {/* Done tasks — always outside the empty/filled conditional */}
        {doneRegular.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingTop: 6, borderTop: '1px solid var(--rule)' }}>
              <Icons.check size={11} style={{ color: areaColor(hue, 'fg', isDark) }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Done · {doneRegular.length}
              </span>
            </div>
            <div style={{ opacity: 0.6 }}>
              {doneRegular.map(task => (
                <SwipeableRow
                  key={task.id}
                  done={task.done}
                  onComplete={() => uncompleteTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                >
                  <CategoryTaskRow
                    task={task}
                    hue={hue}
                    onTap={() => navigate({ name: 'task', taskId: task.id })}
                    onComplete={e => handleComplete(e, task)}
                    isExpanded={false}
                  />
                </SwipeableRow>
              ))}
            </div>
          </div>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}

      {/* ── Recurring "Next" banner ── */}
      {nextBanner && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: 'white',
          padding: '8px 18px', borderRadius: 20,
          fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.04em',
          boxShadow: 'var(--shadow-pop)',
          zIndex: 200, pointerEvents: 'none',
          animation: 'fadeInUp .2s ease',
          whiteSpace: 'nowrap',
        }}>
          {nextBanner.text}
        </div>
      )}

      {undoTask && (
        <div style={{
          position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16,
          background: 'var(--ink)', borderRadius: 12, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 300,
          boxShadow: 'var(--shadow-pop)',
          animation: 'slideUp .2s ease',
        }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--paper)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ✓ {undoTask.title}
          </span>
          <button
            onClick={handleUndo}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
              color: 'var(--accent)', padding: '4px 10px', borderRadius: 8,
              border: '1px solid var(--accent)', background: 'transparent', flexShrink: 0,
            }}
          >
            UNDO
          </button>
        </div>
      )}

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
