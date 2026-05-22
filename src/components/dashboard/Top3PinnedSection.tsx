import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { Icons } from '../ui/Icons'
import { useIsDark, useIsColorful } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import type { Task, Habit, Category, Screen } from '../../types'

interface Props {
  top3Ids: string[]
  cats: Category[]
  navigate: (s: Screen) => void
}

export function Top3PinnedSection({ top3Ids, cats, navigate }: Props) {
  const isDark     = useIsDark()
  const isColorful = useIsColorful()

  const items = useLiveQuery(async () => {
    const [tasks, habits] = await Promise.all([
      db.tasks.bulkGet(top3Ids),
      db.habits.bulkGet(top3Ids),
    ])
    return top3Ids
      .map(id => {
        const t = tasks.find(x => x?.id === id)
        const h = habits.find(x => x?.id === id)
        return (t ?? h) as (Task | Habit) | undefined
      })
      .filter((x): x is Task | Habit => x !== undefined)
  }, [top3Ids.join(',')])

  if (!items || items.length === 0) return null

  return (
    <div style={{ padding: '10px 20px 0' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--ink-4)',
        marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
      }}>
        Top 3 priorities
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((item, idx) => {
          const isTask = 'due' in item
          const rawHue = isTask
            ? (cats.find(c => c.id === (item as Task).cat)?.hue ?? 220)
            : (cats.find(c => c.id === (item as Habit).cat)?.hue ?? 220)
          const hue    = isColorful ? rawHue : 0
          const isDone = isTask ? (item as Task).done : (item as Habit).done

          return (
            <button
              key={item.id}
              onClick={() => isTask ? navigate({ name: 'task', taskId: item.id }) : navigate({ name: 'all-habits' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, textAlign: 'left', width: '100%',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderLeft: `3px solid ${isDone ? 'var(--rule)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)')}`,
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: isDone ? 'var(--paper-3)' : (isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'),
                color: isDone ? 'var(--ink-3)' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              }}>
                {isDone ? <Icons.check size={10} sw={2.5} /> : idx + 1}
              </div>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                color: isDone ? 'var(--ink-3)' : 'var(--ink)',
                textDecoration: isDone ? 'line-through' : 'none',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {item.title}
              </span>
              {!isTask && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                  color: isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)', background: 'var(--paper-3)',
                  borderRadius: 6, padding: '2px 6px', flexShrink: 0,
                }}>
                  HABIT
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
