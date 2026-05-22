import React from 'react'
import { localDateISO } from '../../lib/useCurrentDate'
import { isDueToday, isDueTomorrow } from '../../lib/parseDue'
import { completeTask } from '../../data/db'
import { Icons } from '../ui/Icons'
import { SectionHeader } from '../ui'
import { SwipeableRow } from '../SwipeableRow'
import { TaskCard } from '../TaskCard'
import type { Task, Category, Screen } from '../../types'

interface Props {
  tasks: Task[]
  cats: Category[]
  navigate: (s: Screen) => void
  handleComplete: (e: React.MouseEvent, task: Task) => void
  onDelete: (id: string) => void
}

export function UpcomingSection({ tasks, cats, navigate, handleComplete, onDelete }: Props) {
  const todayISO_    = localDateISO()
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowISO  = tomorrowDate.toISOString().slice(0, 10)
  const isoRe        = /^\d{4}-\d{2}-\d{2}$/

  const overdue  = tasks.filter(t => !t.done && !t.isHabit && isoRe.test(t.due) && t.due < todayISO_)
  const tomorrow = tasks.filter(t => !t.done && !t.isHabit && (t.due === 'Tomorrow' || t.due === tomorrowISO))
  const upcoming = tasks.filter(t =>
    !t.done && !t.isHabit &&
    !isDueToday(t.due) && !isDueTomorrow(t.due) && t.due !== '' &&
    !(isoRe.test(t.due) && t.due <= tomorrowISO)
  )

  const dateBound = [...upcoming].filter(t => isoRe.test(t.due)).sort((a, b) => a.due < b.due ? -1 : 1)
  const someday   = upcoming.filter(t => !isoRe.test(t.due))
  const hasAny    = overdue.length > 0 || tomorrow.length > 0 || dateBound.length > 0 || someday.length > 0

  if (!hasAny) return null

  function TaskGroup({ label, labelColor, tasks: group }: { label: string; labelColor?: string; tasks: Task[] }) {
    if (group.length === 0) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
          color: labelColor ?? 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase',
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {group.map(task => (
            <SwipeableRow key={task.id} disabled={task.done} onComplete={() => completeTask(task.id)} onDelete={() => onDelete(task.id)}>
              <TaskCard
                task={task}
                hue={cats.find(c => c.id === task.cat)?.hue}
                areaName={cats.find(c => c.id === task.cat)?.name}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={e => handleComplete(e, task)}
              />
            </SwipeableRow>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <SectionHeader title="Upcoming" action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate({ name: 'calendar' })}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icons.calendar size={12} /> CAL
          </button>
          <button onClick={() => navigate({ name: 'all-tasks' })}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
            ALL <Icons.arrow size={12} />
          </button>
        </div>
      } />
      <div style={{ marginTop: 12 }}>
        <TaskGroup label={`Overdue · ${overdue.length}`} labelColor="var(--warn)" tasks={overdue} />
        <TaskGroup label="Tomorrow" tasks={tomorrow} />
        <TaskGroup label="Later" tasks={dateBound.slice(0, 5)} />
        {dateBound.length > 5 && (
          <button onClick={() => navigate({ name: 'all-tasks' })} style={{
            padding: '10px 14px', borderRadius: 12, background: 'transparent',
            border: '1px dashed var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--ink-3)', letterSpacing: '0.06em', width: '100%',
          }}>
            +{dateBound.length - 5} more tasks
          </button>
        )}
        <TaskGroup label="Someday" tasks={someday} />
      </div>
    </div>
  )
}
