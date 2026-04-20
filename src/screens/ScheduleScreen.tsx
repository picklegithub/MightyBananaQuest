import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { EFFORT } from '../constants'
import { EffortPip } from '../components/ui'
import { DueDatePicker } from '../components/ui/DueDatePicker'
import { RecurringPicker } from '../components/ui/RecurringPicker'
import type { Screen } from '../types'

interface Props {
  taskId: string
  navigate: (s: Screen) => void
  back: () => void
}

export const ScheduleScreen = ({ taskId, navigate, back }: Props) => {
  const task     = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const settings = useLiveQuery(() => db.settings.get(1), [])

  const [due,       setDue]       = useState(task?.due ?? 'Today')
  const [recurring, setRecurring] = useState<string | null>(task?.recurring ?? null)
  const [pomMins,   setPomMins]   = useState(task?.pomodoroMins ?? settings?.defaultPomodoroMins ?? 25)
  const [saved,     setSaved]     = useState(false)

  if (!task) return null

  const e = EFFORT[task.effort]

  async function handleSave() {
    await db.tasks.update(taskId, { due, recurring, pomodoroMins: pomMins })
    setSaved(true)
    setTimeout(back, 900)
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} /> Back
        </button>
        <div className="t-display" style={{ fontSize: 18 }}>Schedule</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="screen-scroll" style={{ padding: '20px 20px 40px' }}>
        {/* Task name */}
        <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{task.title}</div>
          <EffortPip effort={task.effort} mono />
        </div>

        {/* Due date — smart presets */}
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Due date</div>
          <DueDatePicker value={due} onChange={setDue} />
        </div>

        {/* Recurring — calendar-first picker */}
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Repeat</div>
          <RecurringPicker value={recurring} onChange={setRecurring} />
        </div>

        {/* Pomodoro override */}
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Focus timer</div>
          <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14 }}>Session length</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setPomMins(m => Math.max(5, m - 5))} style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
                }}>
                  <Icons.back size={13} />
                </button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>
                  {pomMins}m
                </span>
                <button onClick={() => setPomMins(m => Math.min(120, m + 5))} style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
                }}>
                  <Icons.arrow size={13} />
                </button>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {[15, 20, 25, 30, 45, 60].map(m => (
                <button key={m} onClick={() => setPomMins(m)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  background: pomMins === m ? 'var(--ink)' : 'var(--paper-3)',
                  color:      pomMins === m ? 'var(--paper)' : 'var(--ink-3)',
                  border: '1px solid', borderColor: pomMins === m ? 'var(--ink)' : 'transparent',
                }}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Effort breakdown */}
        <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Effort estimate</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--ink-2)' }}>{e.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{e.range}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
            ~{Math.ceil(e.mins / pomMins)} pomodoro{Math.ceil(e.mins / pomMins) !== 1 ? 's' : ''} at {pomMins} min each
          </div>
        </div>

        <button onClick={handleSave} style={{
          width: '100%', padding: '16px', borderRadius: 14,
          background: saved ? 'var(--accent-soft)' : 'var(--ink)',
          color: saved ? 'var(--ink)' : 'var(--paper)',
          fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all .2s',
        }}>
          {saved ? <><Icons.check size={18} sw={2.5} /> Saved!</> : 'Save schedule'}
        </button>
      </div>
    </div>
  )
}
