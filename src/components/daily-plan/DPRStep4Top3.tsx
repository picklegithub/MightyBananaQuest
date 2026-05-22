import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useIsDark } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import { db } from '../../data/db'
import { EFFORT } from '../../constants'
import { Icons } from '../ui/Icons'
import type { Task, Habit } from '../../types'

interface Props {
  pickedIds:    Set<string>
  top3Ids:      string[]
  onTop3Change: (ids: string[]) => void
}

export function DPRStep4Top3({ pickedIds, top3Ids, onTop3Change }: Props) {
  const isDark     = useIsDark()
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  const pickedTasks = useLiveQuery(async () => {
    if (pickedIds.size === 0) return []
    const tasks  = await db.tasks.bulkGet([...pickedIds])
    const habits = await db.habits.bulkGet([...pickedIds])
    const results: (Task | Habit)[] = ([...tasks, ...habits] as (Task | Habit | undefined)[])
      .filter((t): t is Task | Habit => t !== undefined)
    // Active tasks first, then habits (which have no status), then others
    const statusOrder: Record<string, number> = { active: 0, backlog: 1, someday: 2 }
    return results.sort((a, b) => {
      const sa = 'status' in a ? (statusOrder[a.status ?? 'backlog'] ?? 1) : 3
      const sb = 'status' in b ? (statusOrder[b.status ?? 'backlog'] ?? 1) : 3
      if (sa !== sb) return sa - sb
      return a.title < b.title ? -1 : 1
    })
  }, [[...pickedIds].join(',')]) ?? []

  function toggleRank(id: string) {
    const idx = top3Ids.indexOf(id)
    if (idx !== -1) {
      onTop3Change(top3Ids.filter(x => x !== id))
    } else if (top3Ids.length < 3) {
      onTop3Change([...top3Ids, id])
    }
  }

  const rankOf = (id: string) => {
    const i = top3Ids.indexOf(id)
    return i === -1 ? null : i + 1
  }

  const full = top3Ids.length === 3

  if (pickedIds.size === 0) {
    return (
      <div>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1, fontStyle: 'italic', marginBottom: 8 }}>
          If only three things…
        </div>
        <div style={{
          padding: '16px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5,
        }}>
          No tasks were picked in the previous step. Go back and select some, or tap "Start the day" to finish.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1, fontStyle: 'italic' }}>
          If only three things…
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          Pick the three you'd be glad you did. The rest is a bonus.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pickedTasks.map(task => {
          const rank   = rankOf(task.id)
          const on     = rank !== null
          const hue    = catHue('cat' in task ? task.cat : '')
          const effort = EFFORT[('effort' in task ? task.effort : 's') as keyof typeof EFFORT]
          const atMax  = full && !on

          return (
            <button
              key={task.id}
              onClick={() => toggleRank(task.id)}
              disabled={atMax}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left', width: '100%',
                padding: '14px 12px', borderRadius: 12,
                background:  on    ? areaColor(hue, 'bg', isDark) : 'var(--paper-2)',
                border:      on    ? `2px solid ${areaColor(hue, 'fg', isDark)}` : '1px solid var(--rule)',
                opacity:     atMax ? 0.4 : 1,
                transform:   on    ? 'scale(1.0)' : 'scale(0.98)',
                transition: 'all .15s',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: on ? areaColor(hue, 'fg', isDark) : 'var(--paper)',
                color:      on ? 'var(--paper)'               : 'var(--ink-3)',
                border:     on ? 'none'                       : '1px solid var(--rule)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic',
                transition: 'all .15s',
              }}>
                {on ? rank : '·'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {effort?.glyph ?? '●'}{' '}
                  {effort ? (effort.mins >= 60 ? `${Math.round(effort.mins / 60)}h` : `${effort.mins}m`) : ''}
                </div>
              </div>
              {on && <Icons.sparkle size={16} style={{ color: areaColor(hue, 'fg', isDark), flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>

      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px dashed var(--rule)',
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5,
      }}>
        {top3Ids.length === 0
          ? 'Tap up to three tasks to make them your priorities for today.'
          : top3Ids.length < 3
            ? `${top3Ids.length}/3 — tap ${3 - top3Ids.length} more, or continue as-is.`
            : "These three pin to the top of Today. Finish them and the day's a win."}
      </div>
    </div>
  )
}
