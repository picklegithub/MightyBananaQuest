import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask } from '../data/db'
import { EFFORT_ORDER, DEFAULT_CATEGORIES } from '../constants'
import { Icons } from './ui/Icons'
import { DueDatePicker } from './ui/DueDatePicker'
import { RecurringPicker } from './ui/RecurringPicker'
import type { EffortKey, QuadKey, Task } from '../types'

interface Props {
  onClose: () => void
  defaultTitle?: string
  defaultCatId?: string
  defaultDue?: string
  defaultIsHabit?: boolean
}

const EFFORT_DISPLAY: Record<EffortKey, { label: string; range: string }> = {
  xs:  { label: 'Micro',      range: '1–5m'  },
  s:   { label: 'Small',      range: '15m'   },
  m:   { label: 'Medium',     range: '1h'    },
  l:   { label: 'Long',       range: '2h'    },
  xl:  { label: 'Mammoth',    range: '6h'    },
  xxl: { label: 'Gargantuan', range: '1d+'   },
}

export function AddTaskSheet({ onClose, defaultTitle = '', defaultCatId, defaultDue, defaultIsHabit = false }: Props) {
  const [title,     setTitle]     = useState(defaultTitle)
  const [effort,    setEffort]    = useState<EffortKey>('m')
  const [due,       setDue]       = useState(defaultDue ?? 'Today')
  const [ctx,       setCtx]       = useState('@anywhere')
  const [quad,      setQuad]      = useState<QuadKey>('q2')
  const [recurring, setRecurring] = useState<string | null>(null)
  const [notes,     setNotes]     = useState('')
  const [isHabit,   setIsHabit]   = useState(defaultIsHabit)

  const liveCategories = useLiveQuery(() => db.categories.toArray(), [])
  const cats = liveCategories ?? DEFAULT_CATEGORIES
  const [cat, setCat] = useState(defaultCatId ?? cats[0]?.id ?? 'home')

  async function handleAdd() {
    if (!title.trim()) return
    const task: Task = {
      id: `t${Date.now()}`,
      title: title.trim(),
      cat, effort, due, ctx, quad, recurring,
      notes: notes.trim() || undefined,
      isHabit: isHabit || undefined,
      done: false, streak: 0, sub: [],
    }
    await addTask(task)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--paper)', borderRadius: '20px 20px 0 0',
          width: '100%', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + Header — fixed */}
        <div style={{ flexShrink: 0, padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--rule)' }}>
            <h2 className="t-display" style={{ fontSize: 20 }}>{isHabit ? '🔥 New Habit' : 'New Task'}</h2>
            <button onClick={onClose} style={{ color: 'var(--ink-3)' }}>
              <Icons.close size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Title */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Title</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.shiftKey === false && handleAdd()}
              placeholder="What needs doing?"
              style={{
                width: '100%', padding: '13px 16px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 15, color: 'var(--ink)',
              }}
            />
          </div>

          {/* Habit toggle */}
          <button
            onClick={() => setIsHabit(h => !h)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: isHabit ? 'var(--warn-soft)' : 'var(--paper-2)',
              border: `1px solid ${isHabit ? 'var(--warn)' : 'var(--rule)'}`,
              marginTop: -8,
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: isHabit ? 'var(--warn)' : 'var(--paper-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isHabit ? 'white' : 'var(--ink-3)',
              transition: 'all .15s',
            }}>
              <Icons.flame size={15} />
            </span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: isHabit ? 'var(--warn)' : 'var(--ink)' }}>
                {isHabit ? 'Habit' : 'Mark as habit'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.04em' }}>
                {isHabit ? 'Tracks check-ins daily · resets each day' : 'Recurring check-in, logs to streak'}
              </div>
            </div>
          </button>

          {/* Area */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Area</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {cats.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} style={{
                  padding: '7px 13px', borderRadius: 20, fontSize: 12,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: cat === c.id ? 'var(--ink)' : 'var(--paper-2)',
                  color: cat === c.id ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: cat === c.id ? 'var(--ink)' : 'var(--rule)',
                }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Effort */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Effort</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {EFFORT_ORDER.map(k => {
                const d = EFFORT_DISPLAY[k]
                return (
                  <button key={k} onClick={() => setEffort(k)} style={{
                    padding: '10px 8px', borderRadius: 10, fontSize: 11, textAlign: 'left',
                    background: effort === k ? 'var(--ink)' : 'var(--paper-2)',
                    color: effort === k ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid', borderColor: effort === k ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7 }}>{d.range}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due date */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Due</div>
            <DueDatePicker value={due} onChange={setDue} />
          </div>

          {/* Priority — compact 4-button row */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Priority</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'q1', label: 'Do',       sub: 'Urgent',    color: 'var(--warn)'   },
                { id: 'q2', label: 'Plan',      sub: 'Important', color: 'var(--accent)' },
                { id: 'q3', label: 'Delegate',  sub: 'Low-urg',   color: 'var(--ink-3)'  },
                { id: 'q4', label: 'Drop',      sub: 'Neither',   color: 'var(--ink-4)'  },
              ] as const).map(c => {
                const active = c.id === quad
                return (
                  <button key={c.id} onClick={() => setQuad(c.id)} style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10, textAlign: 'center',
                    background: active ? 'var(--ink)' : 'var(--paper-2)',
                    color: active ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.6, marginTop: 2 }}>{c.sub}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recurring */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Repeat</div>
            <RecurringPicker value={recurring} onChange={setRecurring} />
          </div>

          {/* Context label */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Label</div>
            <input
              value={ctx}
              onChange={e => setCtx(e.target.value)}
              placeholder="@anywhere"
              style={{
                width: '100%', padding: '11px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 10, fontSize: 13, color: 'var(--ink)',
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              style={{
                width: '100%', minHeight: 72, padding: '12px 14px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 14, resize: 'none', lineHeight: 1.5,
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>

        {/* Footer — fixed */}
        <div style={{ flexShrink: 0, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--rule)' }}>
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: title.trim() ? 'var(--ink)' : 'var(--paper-3)',
              color: title.trim() ? 'var(--paper)' : 'var(--ink-3)',
              fontSize: 15, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Icons.plus size={18} /> Add Task
          </button>
        </div>
      </div>
    </div>
  )
}
