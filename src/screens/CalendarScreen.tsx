import { localDateISO } from '../lib/useCurrentDate'
import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, completeTask, updateTask, deleteTask } from '../data/db'
import { EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { ConfettiBurst } from '../components/ui'
import { SwipeableRow } from '../components/SwipeableRow'
import { UnifiedDuePicker } from '../components/ui/UnifiedDuePicker'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen, Task } from '../types'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props { navigate: (s: Screen) => void; back?: () => void; onAddTask?: (due?: string) => void }
interface Burst { id: number; x: number; y: number; xp: number }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Monthly mini-grid ─────────────────────────────────────────────────────────
// Shows the current month as a heatmap: each day cell is coloured by task count.
// Tapping a cell calls onSelectISO(iso) to jump to that day in the day strip.
function MonthGrid({ tasks, now, onSelectISO }: {
  tasks: Task[]
  now: Date
  onSelectISO: (iso: string) => void
}) {
  const year  = now.getFullYear()
  const month = now.getMonth()
  const todayISO = localDateISO(now)

  const monthName = now.toLocaleDateString(undefined, { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Day index of the 1st (0=Sun…6=Sat), then convert to Mon-first offset
  const firstDay = new Date(year, month, 1).getDay()
  const offset = (firstDay + 6) % 7   // Mon=0, Tue=1 … Sun=6

  // Build a map: ISO → pending task count for heatmap intensity
  const taskMap: Record<string, number> = {}
  for (const t of tasks) {
    if (!t.done && t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due)) {
      taskMap[t.due] = (taskMap[t.due] ?? 0) + 1
    }
  }
  const maxCount = Math.max(1, ...Object.values(taskMap))

  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div style={{ marginTop: 28 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {monthName} overview
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 9, color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)', padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {/* Leading empty cells for offset */}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day    = i + 1
          const iso    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = iso === todayISO
          const count   = taskMap[iso] ?? 0
          const intensity = count > 0 ? Math.max(15, Math.round((count / maxCount) * 55)) : 0

          return (
            <button
              key={iso}
              onClick={() => onSelectISO(iso)}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: isToday
                  ? 'var(--ink)'
                  : intensity > 0
                    ? `color-mix(in oklch, var(--accent) ${intensity}%, var(--paper-2))`
                    : 'var(--paper-2)',
                color: isToday ? 'var(--paper)' : 'var(--ink-2)',
                border: '1px solid',
                borderColor: isToday ? 'var(--ink)' : 'var(--rule)',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Flat calendar row — matches AllTasksScreen compact style ──────────────────
// No opaque background so SwipeableRow's full green/red reveal shows through.
function CalendarTaskRow({
  task, hue, onTap, onComplete, onRescheduleToggle, onAreaToggle,
}: {
  task: Task
  hue?: number
  onTap: () => void
  onComplete: (e: React.MouseEvent) => void
  onRescheduleToggle?: (e: React.MouseEvent) => void
  onAreaToggle?: (e: React.MouseEvent) => void
}) {
  const isDark = useIsDark()
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid var(--rule)',
        borderLeft: hue !== undefined ? `3px solid ${areaColor(hue, 'fg', isDark)}` : '3px solid transparent',
        paddingLeft: 8,
        cursor: 'pointer',
        opacity: task.done ? 0.45 : 1,
      }}
    >
      {/* ── Complete circle (A5: standardised to 24 px) ── */}
      <button
        onClick={e => { e.stopPropagation(); onComplete(e) }}
        style={{
          flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
          border: `1.5px solid ${task.done
            ? (hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--accent)')
            : 'var(--ink-3)'}`,
          background: task.done
            ? (hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--accent)')
            : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <Icons.check size={12} sw={2.5} stroke="var(--paper)" />}
      </button>

      {/* ── Title + meta ── */}
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
          display: 'flex', gap: 6, marginTop: 2,
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
          flexWrap: 'wrap',
        }}>
          <span>{EFFORT[task.effort]?.label ?? 'Medium'}</span>
          {task.recurring && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Icons.repeat size={9} /> {task.recurring}
              </span>
            </>
          )}
          {task.streak > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ color: 'var(--accent)' }}>{task.streak}d</span>
            </>
          )}
        </div>
      </div>

      {/* ── Calendar action buttons ── */}
      {onRescheduleToggle && (
        <button
          onClick={e => { e.stopPropagation(); onRescheduleToggle(e) }}
          style={{ padding: 4, color: 'var(--ink-4)', flexShrink: 0 }}
        >
          <Icons.calendar size={13} />
        </button>
      )}
      {onAreaToggle && (
        <button
          onClick={e => { e.stopPropagation(); onAreaToggle(e) }}
          style={{ padding: 4, color: 'var(--ink-4)', flexShrink: 0 }}
        >
          <Icons.folder size={13} />
        </button>
      )}
    </div>
  )
}

// ── Inline ghost input for calendar day ──────────────────────────────────────
function CalendarGhostInput({ due, defaultCat = 'inbox' }: { due: string; defaultCat?: string }) {
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
      id: crypto.randomUUID(),
      title: t,
      cat: defaultCat,
      effort: 's',
      due,
      quad: 'q2',
      recurring: null,
      done: false,
      streak: 0,
      sub: [],
    })
    setValue('')
    setActive(false)
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '10px 0',
          borderBottom: '1px solid var(--rule)',
          color: 'var(--ink-4)', fontSize: 13,
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '1.5px dashed var(--rule)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icons.plus size={11} />
        </span>
        <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>New task…</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '4px 0' }}>
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
          flex: 1, padding: '10px 12px', borderRadius: 10,
          border: '2px solid var(--accent)',
          background: 'var(--paper-2)', fontSize: 14, color: 'var(--ink)',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSave}
        disabled={!value.trim()}
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: value.trim() ? 'var(--ink)' : 'var(--paper-3)',
          color: value.trim() ? 'var(--paper)' : 'var(--ink-4)',
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

export const CalendarScreen = ({ navigate, back, onAddTask }: Props) => {
  const [selected,           setSelected]           = useState('Today')
  const [bursts,             setBursts]             = useState<Burst[]>([])
  const [expandedReschedule, setExpandedReschedule] = useState<string | null>(null)
  const [expandedArea,       setExpandedArea]       = useState<string | null>(null)

  const tasks    = useLiveQuery(() => db.tasks.toArray(), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const isColorful = useIsColorful()
  const isDark     = useIsDark()

  if (!tasks) return null

  // ── Date helpers ─────────────────────────────────────────────────────────
  const now        = new Date()
  const todayISO   = localDateISO(now)
  const todayDowIdx = now.getDay() === 0 ? 6 : now.getDay() - 1  // 0=Mon…6=Sun

  const isoRe = /^\d{4}-\d{2}-\d{2}$/

  function dateForSlot(slot: string): Date {
    if (slot === 'Today')    return new Date(now)
    if (slot === 'Tomorrow') { const d = new Date(now); d.setDate(d.getDate() + 1); return d }
    // Raw ISO string (e.g. from month-grid tap)
    if (isoRe.test(slot)) { const d = new Date(slot); d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); return d }
    const targetIdx = DAYS.indexOf(slot)
    let ahead = targetIdx - todayDowIdx
    if (ahead <= 0) ahead += 7
    const d = new Date(now)
    d.setDate(d.getDate() + ahead)
    return d
  }

  function isoForSlot(slot: string) {
    if (isoRe.test(slot)) return slot
    return localDateISO(dateForSlot(slot))
  }

  const todaySlotISO    = isoForSlot('Today')
  const tomorrowSlotISO = isoForSlot('Tomorrow')

  // Hide any DAYS entry whose date matches Today or Tomorrow
  const visibleSlots = ['Today', 'Tomorrow', ...DAYS].filter(d => {
    if (d === 'Today' || d === 'Tomorrow') return true
    const iso = isoForSlot(d)
    return iso !== todaySlotISO && iso !== tomorrowSlotISO
  })

  // ── Selected-day ISO (works for named slots and raw ISO strings) ─────────
  const selectedISO = isoForSlot(selected)

  const overdueTasks = tasks.filter(t => !t.done && isoRe.test(t.due) && t.due < todayISO)
  const dayTasks     = tasks.filter(t => t.due === selected || t.due === selectedISO)

  function hueFor(task: Task) { return isColorful ? cats.find(c => c.id === task.cat)?.hue : undefined }

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const { xp: gained } = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.slice(1)), 1400)
    }
  }

  const sectionLabel = (() => {
    if (selected === 'Today')    return "Today's tasks"
    if (selected === 'Tomorrow') return "Tomorrow's tasks"
    if (isoRe.test(selected)) {
      const d = dateForSlot(selected)
      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + "'s tasks"
    }
    return `${selected}'s tasks`
  })()

  return (
    <div className="screen">
      <ScreenHeader
        title="Calendar"
        back={back}
        rightActions={<>
          <ThemeToggle />
          <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
            <Icons.settings size={20} />
          </button>
        </>}
        footer={
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>{selected === 'Today' ? "TODAY'S TASKS" : selected === 'Tomorrow' ? "TOMORROW'S TASKS" : isoRe.test(selected) ? dateForSlot(selected).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase() + "'S TASKS" : `${selected.toUpperCase()}'S TASKS`}</span>
              <span>{dayTasks.filter(t => t.done).length}/{dayTasks.length} done</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${dayTasks.length ? (dayTasks.filter(t => t.done).length / dayTasks.length) * 100 : 0}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        }
      />

      {/* Day strip */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--rule)',
        flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6,
      }}>
        {visibleSlots.map(slot => {
          const d     = dateForSlot(slot)
          const count = tasks.filter(t => t.due === slot && !t.done).length
          // also highlight when an ISO from the month grid maps to this slot
          const sel   = selected === slot || isoForSlot(slot) === selectedISO
          return (
            <button key={slot} onClick={() => setSelected(slot)} style={{
              flexShrink: 0, padding: '7px 10px', borderRadius: 10, textAlign: 'center',
              background:  sel ? 'var(--ink)' : 'var(--paper-2)',
              color:       sel ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid', borderColor: sel ? 'var(--ink)' : 'var(--rule)',
              minWidth: 50,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', marginBottom: 2, opacity: 0.7 }}>
                {slot === 'Today' ? 'TODAY' : slot === 'Tomorrow' ? 'TMRW' : slot.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, lineHeight: 1, marginBottom: 3 }}>
                {d.getDate()}
              </div>
              <div style={{ height: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {count > 0 && (
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: sel ? 'rgba(255,255,255,0.55)' : 'var(--accent)',
                  }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Scroll area */}
      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>

        {/* ── Overdue section (Today view only) ───────────────────────────── */}
        {selected === 'Today' && overdueTasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--warn)', letterSpacing: '0.12em' }}>
              Overdue · {overdueTasks.length}
            </div>
            <div>
              {overdueTasks.map(task => (
                <SwipeableRow
                  key={task.id}
                  disabled={task.done}
                  onComplete={() => handleComplete(
                    { stopPropagation: () => {}, target: document.body } as unknown as React.MouseEvent,
                    task,
                  )}
                  onDelete={() => deleteTask(task.id)}
                >
                  <CalendarTaskRow
                    task={task}
                    hue={hueFor(task)}
                    onTap={() => navigate({ name: 'task', taskId: task.id })}
                    onComplete={e => handleComplete(e, task)}
                  />
                </SwipeableRow>
              ))}
            </div>
            <div style={{ borderBottom: '1px solid var(--rule)', marginTop: 16 }} />
          </div>
        )}

        {/* ── Selected-day tasks ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 14 }}>
          <div className="eyebrow">{sectionLabel}</div>
        </div>

        {dayTasks.length === 0 ? (
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', paddingBottom: 12 }}>
              No tasks for {selected.toLowerCase()}
            </div>
          </div>
        ) : (
          <div>
            {dayTasks.map(task => (
              <div key={task.id}>
                <SwipeableRow
                  disabled={task.done}
                  onComplete={() => handleComplete(
                    { stopPropagation: () => {}, target: document.body } as unknown as React.MouseEvent,
                    task,
                  )}
                  onDelete={() => deleteTask(task.id)}
                >
                  <CalendarTaskRow
                    task={task}
                    hue={hueFor(task)}
                    onTap={() => navigate({ name: 'task', taskId: task.id })}
                    onComplete={e => handleComplete(e, task)}
                    onRescheduleToggle={e => {
                      e.stopPropagation()
                      setExpandedReschedule(expandedReschedule === task.id ? null : task.id)
                      setExpandedArea(null)
                    }}
                    onAreaToggle={e => {
                      e.stopPropagation()
                      setExpandedArea(expandedArea === task.id ? null : task.id)
                      setExpandedReschedule(null)
                    }}
                  />
                </SwipeableRow>

                {/* Reschedule inline picker */}
                {expandedReschedule === task.id && (
                  <div style={{
                    padding: '10px 12px', background: 'var(--paper-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: 10, marginTop: 4, marginBottom: 4,
                  }}>
                    <UnifiedDuePicker
                      due={task.due}
                      recurring={task.recurring ?? null}
                      time={task.time}
                      onChange={(d, r, t) => {
                        updateTask(task.id, { due: d, recurring: r, time: t })
                        setExpandedReschedule(null)
                      }}
                    />
                  </div>
                )}

                {/* MOVE TO area strip */}
                {expandedArea === task.id && (
                  <div style={{
                    padding: '8px 12px', display: 'flex', gap: 5, overflowX: 'auto',
                    alignItems: 'center', background: 'var(--paper-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: 10, marginTop: 4, marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
                      letterSpacing: '0.08em', flexShrink: 0, marginRight: 2,
                    }}>MOVE TO</span>
                    {cats.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { updateTask(task.id, { cat: c.id }); setExpandedArea(null) }}
                        style={{
                          flexShrink: 0, padding: '5px 10px', borderRadius: 20,
                          fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                          background: task.cat === c.id ? areaColor(c.hue, 'fg', isDark) : 'var(--paper-3)',
                          color: task.cat === c.id ? 'var(--paper)' : 'var(--ink-2)',
                          border: '1px solid var(--rule)', whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Inline add — always visible ─────────────────────────────────── */}
        <CalendarGhostInput
          due={selected === 'Today' || selected === 'Tomorrow' ? selected : selectedISO}
        />

        {/* ── Week overview ────────────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Week overview</div>

          {/* Overdue row */}
          {overdueTasks.length > 0 && (
            <button onClick={() => setSelected('Today')} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10, width: '100%', marginBottom: 4,
              background: 'var(--warn-soft)',
              border: '1px solid var(--warn-soft)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--warn)' }}>Overdue</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warn)' }}>
                {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''}
              </span>
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {visibleSlots.map(slot => {
              const count = tasks.filter(t => t.due === slot).length
              const done  = tasks.filter(t => t.due === slot && t.done).length
              if (count === 0) return null
              return (
                <button key={slot} onClick={() => setSelected(slot)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  background: selected === slot ? 'var(--paper-2)' : 'transparent',
                  border: '1px solid', borderColor: selected === slot ? 'var(--rule)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{slot}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                      {dateForSlot(slot).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{done}/{count}</span>
                    <div style={{ width: 50, height: 3, borderRadius: 1.5, background: 'var(--paper-3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 1.5, background: 'var(--accent)', width: `${count ? (done / count) * 100 : 0}%` }} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Monthly overview mini-grid ────────────────────────────────────── */}
        <MonthGrid tasks={tasks} now={now} onSelectISO={iso => { setSelected(iso) }} />

      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
