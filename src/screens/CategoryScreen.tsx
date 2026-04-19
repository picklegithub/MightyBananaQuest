import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { SectionHeader, ConfettiBurst, Seg } from '../components/ui'
import { TaskRow } from './DashboardScreen'
import type { Screen, Task } from '../types'

interface Props { catId: string; navigate: (s: Screen) => void }
interface Burst { id: number; x: number; y: number; xp: number }

export const CategoryScreen = ({ catId, navigate }: Props) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const [bursts, setBursts] = useState<Burst[]>([])

  const tasks = useLiveQuery(() => db.tasks.where('cat').equals(catId).toArray(), [catId])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const cat   = cats.find(c => c.id === catId)

  if (!tasks || !cat) return null

  const filtered = tasks.filter(t =>
    filter === 'all'  ? true :
    filter === 'open' ? !t.done : t.done
  )

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

  const doneCount = tasks.filter(t => t.done).length
  const I = Icons[cat.icon] ?? Icons.home

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => navigate({ name: 'dashboard' })} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <Icons.back size={18} /> Back
          </button>
          <button onClick={() => navigate({ name: 'add' })} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
            fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.06em',
          }}>
            <Icons.plus size={16} /> ADD
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `hsl(${cat.hue}, 40%, 92%)`,
            color: `hsl(${cat.hue}, 55%, 38%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I size={20} />
          </div>
          <div>
            <h1 className="t-display" style={{ fontSize: 24 }}>{cat.name}</h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
              {doneCount}/{tasks.length} complete
            </div>
          </div>
        </div>

        {tasks.length > 0 && (
          <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: `hsl(${cat.hue}, 55%, 42%)`, width: `${tasks.length ? (doneCount/tasks.length)*100 : 0}%`, transition: 'width .4s' }} />
          </div>
        )}
      </div>

      {/* Filter */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <Seg
          value={filter}
          setValue={v => setFilter(v as typeof filter)}
          options={[
            { v: 'open', l: 'Open' },
            { v: 'all',  l: 'All' },
            { v: 'done', l: 'Done' },
          ]}
        />
      </div>

      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            {filter === 'done' ? 'No completed tasks yet' : 'No open tasks — nice work!'}
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
