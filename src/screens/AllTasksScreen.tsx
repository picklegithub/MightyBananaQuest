import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask } from '../data/db'
import { DEFAULT_CATEGORIES, EFFORT_ORDER } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst, Seg } from '../components/ui'
import { TaskRow } from './DashboardScreen'
import type { Screen, Task, EffortKey } from '../types'

interface Props { navigate: (s: Screen) => void }
interface Burst { id: number; x: number; y: number; xp: number }

export const AllTasksScreen = ({ navigate }: Props) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [bursts, setBursts] = useState<Burst[]>([])

  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES

  if (!tasks) return null

  const filtered = tasks
    .filter(t => filter === 'all' ? true : filter === 'open' ? !t.done : t.done)
    .filter(t => catFilter === 'all' ? true : t.cat === catFilter)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={() => navigate({ name: 'dashboard' })} style={{ color: 'var(--ink-2)' }}>
          <Icons.back size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="t-display" style={{ fontSize: 22 }}>All Tasks</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            {tasks.filter(t => !t.done).length} open · {tasks.filter(t => t.done).length} done
          </div>
        </div>
        <button onClick={() => navigate({ name: 'add' })} style={{ color: 'var(--ink-2)' }}>
          <Icons.plus size={22} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <Seg value={filter} setValue={v => setFilter(v as typeof filter)} options={[
          { v: 'open', l: 'Open' },
          { v: 'all',  l: 'All' },
          { v: 'done', l: 'Done' },
        ]} />
      </div>

      {/* Category chips */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6 }}>
        <button onClick={() => setCatFilter('all')} style={{
          flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
          background: catFilter === 'all' ? 'var(--ink)' : 'var(--paper-2)',
          color: catFilter === 'all' ? 'var(--paper)' : 'var(--ink-2)',
          border: '1px solid', borderColor: catFilter === 'all' ? 'var(--ink)' : 'var(--rule)',
        }}>
          All
        </button>
        {cats.map(c => (
          <button key={c.id} onClick={() => setCatFilter(c.id)} style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
            background: catFilter === c.id ? 'var(--ink)' : 'var(--paper-2)',
            color: catFilter === c.id ? 'var(--paper)' : 'var(--ink-2)',
            border: '1px solid', borderColor: catFilter === c.id ? 'var(--ink)' : 'var(--rule)',
          }}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="screen-scroll" style={{ padding: '12px 20px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            No tasks match this filter
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(task => (
              <TaskRow key={task.id} task={task}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={(e) => handleComplete(e, task)}
              />
            ))}
          </div>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
