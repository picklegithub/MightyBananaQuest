import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, deleteTask, deleteTasks } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst, Seg } from '../components/ui'
import { TaskRow } from './DashboardScreen'
import type { Screen, Task } from '../types'

interface Props { navigate: (s: Screen) => void; back: () => void }
interface Burst { id: number; x: number; y: number; xp: number }

export const AllTasksScreen = ({ navigate, back }: Props) => {
  const [filter, setFilter]       = useState<'all' | 'open' | 'done'>('open')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [bursts, setBursts]       = useState<Burst[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())

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

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} task${selected.size > 1 ? 's' : ''}?`)) return
    await deleteTasks([...selected])
    setSelected(new Set())
    setSelectMode(false)
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={() => selectMode ? exitSelectMode() : back()} style={{ color: 'var(--ink-2)' }}>
          {selectMode ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cancel</span> : <Icons.back size={20} />}
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="t-display" style={{ fontSize: 22 }}>{selectMode ? `${selected.size} selected` : 'All Tasks'}</h1>
          {!selectMode && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              {tasks.filter(t => !t.done).length} open · {tasks.filter(t => t.done).length} done
            </div>
          )}
        </div>
        {selectMode ? (
          <button onClick={handleBulkDelete} disabled={selected.size === 0} style={{
            padding: '7px 14px', borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 11,
            background: selected.size > 0 ? 'var(--warn-soft)' : 'var(--paper-3)',
            color: selected.size > 0 ? 'var(--warn)' : 'var(--ink-4)',
            border: '1px solid', borderColor: selected.size > 0 ? 'var(--warn-soft)' : 'transparent',
          }}>
            Delete {selected.size > 0 ? selected.size : ''}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSelectMode(true)} style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em' }}>
              Select
            </button>
            <button onClick={() => navigate({ name: 'add' })} style={{ color: 'var(--ink-2)' }}>
              <Icons.plus size={22} />
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <Seg value={filter} setValue={v => setFilter(v as typeof filter)} options={[
          { v: 'open', l: 'Open' }, { v: 'all', l: 'All' }, { v: 'done', l: 'Done' },
        ]} />
      </div>

      {/* Category chips */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6 }}>
        {['all', ...cats.map(c => c.id)].map(id => {
          const label = id === 'all' ? 'All' : cats.find(c => c.id === id)?.name ?? id
          return (
            <button key={id} onClick={() => setCatFilter(id)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
              background: catFilter === id ? 'var(--ink)' : 'var(--paper-2)',
              color: catFilter === id ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid', borderColor: catFilter === id ? 'var(--ink)' : 'var(--rule)',
            }}>{label}</button>
          )
        })}
      </div>

      <div className="screen-scroll" style={{ padding: '12px 20px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            No tasks match this filter
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Checkbox in select mode */}
                {selectMode && (
                  <button onClick={() => toggleSelect(task.id)} style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${selected.has(task.id) ? 'var(--ink)' : 'var(--rule)'}`,
                    background: selected.has(task.id) ? 'var(--ink)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected.has(task.id) && <Icons.check size={12} sw={3} style={{ color: 'var(--paper)' }} />}
                  </button>
                )}
                <div style={{ flex: 1 }} onClick={selectMode ? () => toggleSelect(task.id) : undefined}>
                  <TaskRow task={task}
                    onTap={selectMode ? () => toggleSelect(task.id) : () => navigate({ name: 'task', taskId: task.id })}
                    onComplete={(e) => handleComplete(e, task)}
                    onDelete={!selectMode ? async (e) => { e.stopPropagation(); await deleteTask(task.id) } : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
