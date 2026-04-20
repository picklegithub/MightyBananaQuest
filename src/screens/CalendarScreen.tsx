import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import type { Screen, Task } from '../types'

interface Props { navigate: (s: Screen) => void; onAddTask?: (due?: string) => void }
interface Burst { id: number; x: number; y: number; xp: number }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CalendarScreen = ({ navigate, onAddTask }: Props) => {
  const [selected, setSelected] = useState('Today')
  const [bursts, setBursts]     = useState<Burst[]>([])

  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? []

  if (!tasks) return null

  // ── Date helpers ─────────────────────────────────────────────────────────
  const now        = new Date()
  const todayISO   = now.toISOString().slice(0, 10)
  const todayDowIdx = now.getDay() === 0 ? 6 : now.getDay() - 1  // 0=Mon…6=Sun

  function dateForSlot(slot: string): Date {
    if (slot === 'Today')    return new Date(now)
    if (slot === 'Tomorrow') { const d = new Date(now); d.setDate(d.getDate() + 1); return d }
    const targetIdx = DAYS.indexOf(slot)
    let ahead = targetIdx - todayDowIdx
    if (ahead <= 0) ahead += 7
    const d = new Date(now)
    d.setDate(d.getDate() + ahead)
    return d
  }

  function isoForSlot(slot: string) { return dateForSlot(slot).toISOString().slice(0, 10) }

  const todaySlotISO    = isoForSlot('Today')
  const tomorrowSlotISO = isoForSlot('Tomorrow')

  // Hide any DAYS entry whose date matches Today or Tomorrow (avoids "Tue / Today" duplication)
  const visibleSlots = ['Today', 'Tomorrow', ...DAYS].filter(d => {
    if (d === 'Today' || d === 'Tomorrow') return true
    const iso = isoForSlot(d)
    return iso !== todaySlotISO && iso !== tomorrowSlotISO
  })

  // ── Overdue: ISO-dated tasks before today ────────────────────────────────
  const isoRe      = /^\d{4}-\d{2}-\d{2}$/
  const selectedISO = isoForSlot(selected)

  const overdueTasks = tasks.filter(t => !t.done && isoRe.test(t.due) && t.due < todayISO)
  // Match tasks by slot label OR by their ISO date (so "2025-04-21" shows under "Today")
  const dayTasks = tasks.filter(t => t.due === selected || t.due === selectedISO)

  function hueFor(task: Task) { return cats.find(c => c.id === task.cat)?.hue }

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.slice(1)), 1400)
    }
  }

  const sectionLabel =
    selected === 'Today'    ? "Today's tasks"
    : selected === 'Tomorrow' ? "Tomorrow's tasks"
    : `${selected}'s tasks`

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Week ahead</div>
        <h1 className="t-display" style={{ fontSize: 28 }}>Calendar</h1>
      </div>

      {/* Day strip */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--rule)',
        flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6,
      }}>
        {visibleSlots.map(slot => {
          const d     = dateForSlot(slot)
          const count = tasks.filter(t => t.due === slot && !t.done).length
          const sel   = selected === slot
          return (
            <button key={slot} onClick={() => setSelected(slot)} style={{
              flexShrink: 0, padding: '7px 10px', borderRadius: 10, textAlign: 'center',
              background:  sel ? 'var(--ink)' : 'var(--paper-2)',
              color:       sel ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid', borderColor: sel ? 'var(--ink)' : 'var(--rule)',
              minWidth: 50,
            }}>
              {/* Day label */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', marginBottom: 2, opacity: 0.7 }}>
                {slot === 'Today' ? 'TODAY' : slot === 'Tomorrow' ? 'TMRW' : slot.toUpperCase()}
              </div>
              {/* Date number */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, lineHeight: 1, marginBottom: 3 }}>
                {d.getDate()}
              </div>
              {/* Task-count dot */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {overdueTasks.map(task => (
                <TaskCard key={task.id} task={task}
                  hue={hueFor(task)}
                  onTap={() => navigate({ name: 'task', taskId: task.id })}
                  onComplete={(e: React.MouseEvent) => handleComplete(e, task)}
                />
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
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Icons.calendar size={36} style={{ color: 'var(--ink-4)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
              No tasks for {selected.toLowerCase()}
            </div>
            <button onClick={() => onAddTask?.(selected)} style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 10,
              border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--ink-2)', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 6, margin: '16px auto 0',
            }}>
              <Icons.plus size={14} /> Add task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayTasks.map(task => (
              <TaskCard key={task.id} task={task}
                hue={hueFor(task)}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={(e: React.MouseEvent) => handleComplete(e, task)}
              />
            ))}
          </div>
        )}

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
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
