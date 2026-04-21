import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, deleteTask, updateTask } from '../data/db'
import { EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { SwipeableRow } from '../components/SwipeableRow'
import { ThemeToggle } from '../components/ThemeToggle'
import type { Screen, Task, Category } from '../types'

interface Props {
  navigate: (s: Screen) => void
  back: () => void
  onAddTask?: (title?: string) => void  // kept for compat, not used in new flow
}

interface Burst { id: number; x: number; y: number; xp: number }

// ── Effort display label ──────────────────────────────────────────────────────
function effortLabel(effort: Task['effort']): string {
  const mins = EFFORT[effort]?.mins ?? 15
  if (mins >= 1440) return Math.round(mins / 1440) + 'd'
  if (mins >= 60)   return (mins / 60) + 'h'
  return mins + 'm'
}

// ── Single inbox task card ────────────────────────────────────────────────────
function InboxTaskCard({
  task, cats, onNavigate, onComplete, onDelete, onAssign,
}: {
  task: Task
  cats: Category[]
  onNavigate: () => void
  onComplete: (e: React.MouseEvent) => void
  onDelete: () => void
  onAssign: (catId: string) => void
}) {
  const eDef = EFFORT[task.effort]

  return (
    <div style={{
      border: '1px solid var(--rule)', borderRadius: 14, overflow: 'hidden',
      opacity: task.done ? 0.5 : 1, transition: 'opacity .2s',
    }}>
      {/* Main row — swipeable for delete */}
      <SwipeableRow onDelete={onDelete}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 14px 12px', background: 'var(--paper-2)' }}>

        {/* Complete button */}
        <button
          onClick={onComplete}
          style={{
            flexShrink: 0, marginTop: 2,
            width: 22, height: 22, borderRadius: '50%',
            border: `1.5px solid ${task.done ? 'var(--accent)' : 'var(--rule)'}`,
            background: task.done ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: task.done ? 'var(--paper)' : 'transparent',
          }}
        >
          {task.done && <Icons.check size={11} sw={2.5} />}
        </button>

        {/* Content — tappable to open task detail */}
        <button onClick={onNavigate} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{
            fontSize: 14, fontWeight: 500, lineHeight: 1.4,
            textDecoration: task.done ? 'line-through' : 'none',
            color: task.done ? 'var(--ink-3)' : 'var(--ink)',
            marginBottom: 5,
          }}>
            {task.title}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {eDef && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                letterSpacing: '0.04em',
              }}>
                {eDef.glyph} {effortLabel(task.effort)}
              </span>
            )}
            {task.due && task.due !== '' && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                letterSpacing: '0.04em',
              }}>
                {task.due}
              </span>
            )}
            {task.notes && (
              <span style={{
                fontSize: 11, color: 'var(--ink-3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 140,
              }}>
                {task.notes}
              </span>
            )}
          </div>
        </button>

      </div>
      </SwipeableRow>

      {/* Area assign row — always visible, scrollable */}
      {!task.done && (
        <div style={{
          borderTop: '1px solid var(--rule)',
          padding: '9px 12px',
          display: 'flex', gap: 5, overflowX: 'auto',
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
            letterSpacing: '0.08em', flexShrink: 0, marginRight: 2,
          }}>
            MOVE TO
          </span>
          {cats.map(c => (
            <button
              key={c.id}
              onClick={() => onAssign(c.id)}
              style={{
                flexShrink: 0,
                padding: '5px 10px', borderRadius: 20,
                fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                background: 'var(--paper-3)', color: 'var(--ink-2)',
                border: '1px solid var(--rule)',
                whiteSpace: 'nowrap',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const InboxScreen = ({ navigate, back }: Props) => {
  const [bursts, setBursts] = useState<Burst[]>([])

  const tasks = useLiveQuery(
    () => db.tasks.where('cat').equals('inbox').toArray(),
    []
  )
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? []

  if (!tasks) return null

  const pending = tasks.filter(t => !t.done)
  const done    = tasks.filter(t => t.done)

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
  }

  async function handleAssign(taskId: string, catId: string) {
    await updateTask(taskId, { cat: catId, due: 'Today' })
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId)
  }

  const isEmpty = tasks.length === 0

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center' }}>
          <Icons.back size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="t-display" style={{ fontSize: 22 }}>Inbox</h1>
          {pending.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 1 }}>
              {pending.length} to sort
            </div>
          )}
        </div>
        <ThemeToggle />
      </div>

      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>

        {/* Empty state */}
        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '72px 20px' }}>
            <Icons.inbox size={40} style={{ color: 'var(--ink-4)', margin: '0 auto 16px', display: 'block' }} />
            <div className="t-display" style={{ fontSize: 20, marginBottom: 6 }}>Inbox zero</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>
              Captures land here. Assign an area<br />or complete them to clear the queue.
            </div>
          </div>
        )}

        {/* Pending tasks */}
        {pending.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: done.length > 0 ? 24 : 0 }}>
            {pending.map(task => (
              <InboxTaskCard
                key={task.id}
                task={task}
                cats={cats}
                onNavigate={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={e => handleComplete(e, task)}
                onDelete={() => handleDelete(task.id)}
                onAssign={catId => handleAssign(task.id, catId)}
              />
            ))}
          </div>
        )}

        {/* Done tasks — collapsed section */}
        {done.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 10, opacity: 0.5 }}>Completed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {done.map(task => (
                <InboxTaskCard
                  key={task.id}
                  task={task}
                  cats={cats}
                  onNavigate={() => navigate({ name: 'task', taskId: task.id })}
                  onComplete={e => handleComplete(e, task)}
                  onDelete={() => handleDelete(task.id)}
                  onAssign={catId => handleAssign(task.id, catId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
