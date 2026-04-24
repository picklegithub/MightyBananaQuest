import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, addHabit } from '../data/db'
import { EFFORT_ORDER, DEFAULT_CATEGORIES } from '../constants'
import { Icons } from './ui/Icons'
import { UnifiedDuePicker } from './ui/UnifiedDuePicker'
import type { EffortKey, QuadKey, Task, Habit } from '../types'

const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekends', 'weekly', 'monthly']

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

const QUAD_OPTIONS: { id: QuadKey; label: string; sub: string }[] = [
  { id: 'q1', label: 'Do',       sub: 'Urgent'    },
  { id: 'q2', label: 'Schedule', sub: 'Important' },
  { id: 'q3', label: 'Delegate', sub: 'Low-urg'   },
  { id: 'q4', label: 'Drop',     sub: 'Neither'   },
]

// Shared pill style matching the Area pill look
function OptionPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 13px', borderRadius: 20, fontSize: 12,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
        background: active ? 'var(--ink)' : 'var(--paper-2)',
        color: active ? 'var(--paper)' : 'var(--ink-2)',
        border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export function AddTaskSheet({ onClose, defaultTitle = '', defaultCatId, defaultDue, defaultIsHabit = false }: Props) {
  const [title,     setTitle]     = useState(defaultTitle)
  const [effort,    setEffort]    = useState<EffortKey>('m')
  const [due,       setDue]       = useState(defaultDue ?? 'Today')
  const [time,      setTime]      = useState<string | undefined>(undefined)
  const [quad,      setQuad]      = useState<QuadKey>('q2')
  const [recurring,  setRecurring]  = useState<string | null>(null)
  const [notes,      setNotes]      = useState('')
  const [isHabit,    setIsHabit]    = useState(defaultIsHabit)
  const [frequency,  setFrequency]  = useState('daily')

  const liveCategories = useLiveQuery(() => db.categories.toArray(), [])
  const cats = liveCategories ?? DEFAULT_CATEGORIES
  const [cat, setCat] = useState(defaultCatId ?? cats[0]?.id ?? 'home')

  async function handleAdd() {
    if (!title.trim()) return
    if (isHabit) {
      const habit: Habit = {
        id: `h${Date.now()}`,
        title: title.trim(),
        cat,
        frequency,
        streak: 0,
        done: false,
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await addHabit(habit)
    } else {
      const task: Task = {
        id: `t${Date.now()}`,
        title: title.trim(),
        cat, effort, due, time, ctx: '@anywhere', quad, recurring,
        notes: notes.trim() || undefined,
        done: false, streak: 0, sub: [],
      }
      await addTask(task)
    }
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

          {/* Task / Habit pill switcher — directly under title */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Type</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={() => setIsHabit(false)}
                style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 12,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: !isHabit ? 'var(--ink)' : 'var(--paper-2)',
                  color: !isHabit ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: !isHabit ? 'var(--ink)' : 'var(--rule)',
                }}
              >
                Task
              </button>
              <button
                onClick={() => setIsHabit(true)}
                style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 12,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: isHabit ? 'var(--warn)' : 'var(--paper-2)',
                  color: isHabit ? 'white' : 'var(--ink-2)',
                  border: '1px solid', borderColor: isHabit ? 'var(--warn)' : 'var(--rule)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Icons.flame size={11} /> Habit
              </button>
            </div>
          </div>

          {/* Area */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Area</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {cats.map(c => (
                <OptionPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                  {c.name}
                </OptionPill>
              ))}
            </div>
          </div>

          {/* Priority — task mode only */}
          {!isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Priority</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {QUAD_OPTIONS.map(o => (
                  <button key={o.id} onClick={() => setQuad(o.id)} style={{
                    padding: '7px 13px', borderRadius: 20, fontSize: 12,
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                    background: quad === o.id ? 'var(--ink)' : 'var(--paper-2)',
                    color: quad === o.id ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: quad === o.id ? 'var(--ink)' : 'var(--rule)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
                    <span style={{ fontWeight: 600 }}>{o.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.65 }}>{o.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Effort — task mode only */}
          {!isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Effort</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {EFFORT_ORDER.map(k => {
                  const d = EFFORT_DISPLAY[k]
                  return (
                    <button key={k} onClick={() => setEffort(k)} style={{
                      padding: '7px 13px', borderRadius: 20, fontSize: 12,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                      background: effort === k ? 'var(--ink)' : 'var(--paper-2)',
                      color: effort === k ? 'var(--paper)' : 'var(--ink-2)',
                      border: '1px solid', borderColor: effort === k ? 'var(--ink)' : 'var(--rule)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}>
                      <span style={{ fontWeight: 600 }}>{d.label}</span>
                      <span style={{ fontSize: 9, opacity: 0.65 }}>{d.range}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Frequency — habit mode only */}
          {isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Frequency</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {FREQUENCY_OPTIONS.map(f => (
                  <OptionPill key={f} active={frequency === f} onClick={() => setFrequency(f)}>
                    {f}
                  </OptionPill>
                ))}
              </div>
            </div>
          )}

          {/* Due date + Repeat — task mode only */}
          {!isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Due &amp; Repeat</div>
              <UnifiedDuePicker
                due={due}
                recurring={recurring}
                time={time}
                onChange={(d, r, t) => { setDue(d); setRecurring(r); setTime(t) }}
              />
            </div>
          )}

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
            <Icons.plus size={18} /> {isHabit ? 'Add Habit' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
