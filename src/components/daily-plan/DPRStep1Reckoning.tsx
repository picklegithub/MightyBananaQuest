import React, { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useIsDark } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import { db, todayISO } from '../../data/db'
import { EFFORT } from '../../constants'
import { Icons } from '../ui/Icons'
import { isoRe, tomorrowISO } from './shared'
import type { Reckoning, Task } from '../../types'

interface Props {
  reckonings:         Reckoning[]
  onReckoningsChange: (r: Reckoning[]) => void
}

export function DPRStep1Reckoning({ reckonings, onReckoningsChange }: Props) {
  const isDark   = useIsDark()
  const today    = todayISO()
  const tomorrow = useMemo(tomorrowISO, [])

  const leftovers = useLiveQuery(async () => {
    const all = await db.tasks.filter(t => {
      if (t.done) return false
      if (t.due === 'Overdue') return true
      if (isoRe.test(t.due) && t.due < today) return true
      return false
    }).toArray()
    // Sort by status priority, then due date
    const statusOrder: Record<string, number> = { active: 0, backlog: 1, someday: 2 }
    return all.sort((a, b) => {
      const sd = (statusOrder[a.status ?? 'backlog'] ?? 1) - (statusOrder[b.status ?? 'backlog'] ?? 1)
      if (sd !== 0) return sd
      return a.due < b.due ? -1 : 1
    })
  }, [today]) ?? []

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  const actionFor = (taskId: string): Reckoning['action'] | undefined =>
    reckonings.find(r => r.taskId === taskId)?.action

  function setAction(task: Task, action: Reckoning['action']) {
    onReckoningsChange([
      ...reckonings.filter(r => r.taskId !== task.id),
      { taskId: task.id, action, rescheduledTo: action === 'reschedule' ? tomorrow : undefined },
    ])
  }

  if (leftovers.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 18 }}>
          <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>All clear</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
            Nothing left over from yesterday. Nice work.
          </div>
        </div>
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'var(--accent-soft)', border: '1px solid var(--rule)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: 'var(--ink-2)',
        }}>
          <Icons.check size={16} stroke="var(--accent)" />
          Ready to plan your day.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>
          Yesterday left {leftovers.length === 1 ? 'one thing' : `${leftovers.length} things`}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          Push, reschedule, or drop — no guilt.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {leftovers.map(task => {
          const action = actionFor(task.id)
          const hue    = catHue(task.cat)
          const effort = EFFORT[task.effort]

          return (
            <div key={task.id} style={{
              padding: '12px 12px 10px',
              border: `1px solid ${action ? areaColor(hue, 'fg', isDark) : 'var(--rule)'}`,
              borderRadius: 12, background: 'var(--paper-2)', transition: 'border-color .15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                  background: areaColor(hue, 'fg', isDark),
                }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', flex: 1, lineHeight: 1.35 }}>
                  {task.title}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--ink-3)', letterSpacing: '0.06em', flexShrink: 0, marginTop: 2,
                }}>
                  {effort?.glyph ?? '●'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {(['today', 'reschedule', 'drop'] as const).map(opt => {
                  const on = action === opt
                  const labels: Record<typeof opt, string> = {
                    today: 'Push to today', reschedule: 'Reschedule', drop: 'Drop',
                  }
                  return (
                    <button
                      key={opt}
                      onClick={() => setAction(task, on ? undefined as unknown as typeof opt : opt)}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 8,
                        fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                        background: on ? (opt === 'drop' ? 'var(--warn)' : 'var(--ink)') : 'transparent',
                        color:      on ? 'var(--paper)' : 'var(--ink-2)',
                        border:     on ? `1px solid ${opt === 'drop' ? 'var(--warn)' : 'var(--ink)'}` : '1px solid var(--rule)',
                        transition: 'all .15s',
                      }}
                    >
                      {labels[opt]}
                    </button>
                  )
                })}
              </div>

              {action === 'reschedule' && (
                <div style={{
                  marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-3)', letterSpacing: '0.04em',
                }}>
                  ↳ Moving to tomorrow ({tomorrow})
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px dashed var(--rule)',
        fontSize: 12, color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icons.sparkle size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        You're not behind — you're allocating.
      </div>
    </div>
  )
}
