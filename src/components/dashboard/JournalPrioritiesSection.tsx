import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { Icons } from '../ui/Icons'
import { useIsDark, useIsColorful } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import type { Task, Category, Screen } from '../../types'

interface Props {
  pinnedIds: string[]
  cats: Category[]
  navigate: (s: Screen) => void
}

export function JournalPrioritiesSection({ pinnedIds, cats, navigate }: Props) {
  const isColorful = useIsColorful()
  const isDark     = useIsDark()

  const tasks = useLiveQuery(
    () => db.tasks.bulkGet(pinnedIds),
    [pinnedIds.join(',')]
  )

  const items = (tasks ?? []).filter((t): t is Task => !!t)
  if (items.length === 0) return null

  return (
    <div style={{ padding: '10px 20px 0' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--ink-4)',
        marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>⭐</span> Morning priorities
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((task, idx) => {
          const hue = isColorful ? (cats.find(c => c.id === task.cat)?.hue ?? 220) : 0
          return (
            <button
              key={task.id}
              onClick={() => navigate({ name: 'task', taskId: task.id })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, textAlign: 'left', width: '100%',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderLeft: `3px solid ${task.done ? 'var(--rule)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)')}`,
                opacity: task.done ? 0.6 : 1,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: task.done ? 'var(--paper-3)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'),
                color: task.done ? 'var(--ink-3)' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              }}>
                {task.done ? <Icons.check size={10} sw={2.5} /> : idx + 1}
              </div>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                color: task.done ? 'var(--ink-3)' : 'var(--ink)',
                textDecoration: task.done ? 'line-through' : 'none',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {task.title}
              </span>
              <Icons.arrow size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
