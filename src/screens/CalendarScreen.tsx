import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { TaskRow } from './DashboardScreen'
import type { Screen, Task } from '../types'

interface Props { navigate: (s: Screen) => void }
interface Burst { id: number; x: number; y: number; xp: number }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const CalendarScreen = ({ navigate }: Props) => {
  const [selected, setSelected] = useState('Today')
  const [bursts, setBursts] = useState<Burst[]>([])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])

  if (!tasks) return null

  const dayOptions = ['Today', 'Tomorrow', ...DAYS]
  const dayTasks = tasks.filter(t => t.due === selected)
  const todayDow = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

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

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Week ahead</div>
        <h1 className="t-display" style={{ fontSize: 28 }}>Calendar</h1>
      </div>

      {/* Day strip */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6 }}>
        {dayOptions.map(d => {
          const count = tasks.filter(t => t.due === d && !t.done).length
          const isToday = d === 'Today' || d === todayDow
          return (
            <button key={d} onClick={() => setSelected(d)} style={{
              flexShrink: 0, padding: '8px 12px', borderRadius: 10, textAlign: 'center',
              background: selected === d ? 'var(--ink)' : 'var(--paper-2)',
              color: selected === d ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid', borderColor: selected === d ? 'var(--ink)' : 'var(--rule)',
              minWidth: 52,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', marginBottom: 3 }}>
                {d === 'Today' ? 'TODAY' : d === 'Tomorrow' ? 'TMRW' : d.toUpperCase()}
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', margin: '0 auto',
                background: count > 0 ? (selected === d ? 'rgba(255,255,255,0.2)' : 'var(--paper-3)') : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10,
              }}>
                {count > 0 ? count : ''}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tasks for selected day */}
      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>
        <div style={{ marginBottom: 14 }}>
          <div className="eyebrow">{selected === 'Today' ? "Today's tasks" : selected === 'Tomorrow' ? "Tomorrow's tasks" : `${selected}'s tasks`}</div>
        </div>

        {dayTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Icons.calendar size={36} style={{ color: 'var(--ink-4)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
              No tasks for {selected.toLowerCase()}
            </div>
            <button onClick={() => navigate({ name: 'add' })} style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 10,
              border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--ink-2)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, margin: '16px auto 0',
            }}>
              <Icons.plus size={14} /> Add task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayTasks.map(task => (
              <TaskRow key={task.id} task={task}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={(e) => handleComplete(e, task)}
              />
            ))}
          </div>
        )}

        {/* Upcoming summary */}
        <div style={{ marginTop: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Week overview</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dayOptions.map(d => {
              const count = tasks.filter(t => t.due === d).length
              const done  = tasks.filter(t => t.due === d && t.done).length
              if (count === 0) return null
              return (
                <button key={d} onClick={() => setSelected(d)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  background: selected === d ? 'var(--paper-2)' : 'transparent',
                  border: '1px solid', borderColor: selected === d ? 'var(--rule)' : 'transparent',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{d}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{done}/{count}</span>
                    <div style={{ width: 50, height: 3, borderRadius: 1.5, background: 'var(--paper-3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 1.5, background: 'var(--accent)', width: `${count ? (done/count)*100 : 0}%` }} />
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
