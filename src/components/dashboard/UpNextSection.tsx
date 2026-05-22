import React, { useState } from 'react'
import { uncompleteTask, completeTask, deleteTask } from '../../data/db'
import { Icons } from '../ui/Icons'  // kept for empty-state plus icon
import { SectionHeader } from '../ui'
import { SwipeableRow } from '../SwipeableRow'
import { TaskCard } from '../TaskCard'
import { areaColor } from '../../lib/areaColor'
import { useIsDark } from '../../lib/colorMode'
import type { Task, Category, Screen } from '../../types'

interface Props {
  tasks: Task[]
  cats: Category[]
  isColorful: boolean
  navigate: (s: Screen) => void
  handleComplete: (e: React.MouseEvent, task: Task) => void
}

export function UpNextSection({ tasks, cats, isColorful, navigate, handleComplete }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const isDark = useIsDark()

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (tasks.length === 0) return (
    <div style={{ padding: '16px 20px 0' }}>
      <SectionHeader title="Up Next" />
      <button
        onClick={() => navigate({ name: 'all-tasks', initialStatus: 'backlog' })}
        style={{
          marginTop: 10, width: '100%', padding: '12px 14px', borderRadius: 10,
          border: '1px dashed var(--rule)', background: 'transparent',
          display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
        }}
      >
        <Icons.plus size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
          Set a task to Active to see it here
        </span>
      </button>
    </div>
  )

  return (
    <div style={{ padding: '16px 20px 0' }}>
      <SectionHeader title="Up Next" action={
        <button onClick={() => navigate({ name: 'all-tasks' })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
          ALL <Icons.arrow size={12} />
        </button>
      } />
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => {
          const taskHue    = isColorful ? cats.find((c: Category) => c.id === task.cat)?.hue : undefined
          const cat        = cats.find((c: Category) => c.id === task.cat)
          const isExpanded = expandedIds.has(task.id)
          return (
            <div key={task.id}>
              <SwipeableRow
                done={task.done}
                onComplete={() => task.done ? uncompleteTask(task.id) : completeTask(task.id)}
                onDelete={() => deleteTask(task.id)}
              >
                <TaskCard
                  task={task}
                  hue={taskHue}
                  areaName={cat?.name}
                  onTap={() => navigate({ name: 'task', taskId: task.id })}
                  onComplete={e => handleComplete(e, task)}
                  onToggleSubtasks={(task.sub?.length ?? 0) > 0 ? () => toggleExpand(task.id) : undefined}
                  subtasksExpanded={isExpanded}
                />
              </SwipeableRow>
              {/* Subtask tree — shown when TaskCard toggle is open */}
              {isExpanded && (task.sub?.length ?? 0) > 0 && (
                <div style={{
                  marginLeft: 14, paddingLeft: 22,
                  borderLeft: `2px solid ${taskHue !== undefined ? areaColor(taskHue, 'bg', isDark) : 'var(--rule)'}`,
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
                        border: `1.5px solid ${s.d ? (taskHue !== undefined ? areaColor(taskHue, 'fg', isDark) : 'var(--accent)') : 'var(--rule)'}`,
                        background: s.d ? (taskHue !== undefined ? areaColor(taskHue, 'fg', isDark) : 'var(--accent)') : 'transparent',
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
    </div>
  )
}
