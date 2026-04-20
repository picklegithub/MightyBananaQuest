import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask } from '../data/db'
import { EFFORT_ORDER, DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { EisenhowerMatrix } from '../components/ui'
import { DueDatePicker } from '../components/ui/DueDatePicker'
import { RecurringPicker } from '../components/ui/RecurringPicker'
import type { Screen, EffortKey, QuadKey, Task } from '../types'

interface Props {
  navigate: (s: Screen) => void
  back: () => void
}

export const AddScreen = ({ navigate, back }: Props) => {
  const [title, setTitle]       = useState('')
  const [cat, setCat]           = useState('home')
  const [effort, setEffort]     = useState<EffortKey>('m')
  const [due, setDue]           = useState('Today')
  const [ctx, setCtx]           = useState('@anywhere')
  const [quad, setQuad]         = useState<QuadKey>('q2')
  const [recurring, setRecurring] = useState<string | null>(null)
  const [notes, setNotes]       = useState('')

  // Live categories (includes custom ones)
  const liveCategories = useLiveQuery(() => db.categories.toArray(), [])
  const cats = liveCategories ?? DEFAULT_CATEGORIES

  async function handleAdd() {
    if (!title.trim()) return
    const task: Task = {
      id: `t${Date.now()}`,
      title: title.trim(),
      cat, effort, due, ctx, quad, recurring, notes,
      done: false, streak: 0, sub: [],
    }
    await addTask(task)
    back()
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} /> Cancel
        </button>
        <div className="t-display" style={{ fontSize: 18 }}>New Task</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="screen-scroll" style={{ padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Title */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Title</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="What needs doing?"
              style={{
                width: '100%', padding: '13px 16px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 15, color: 'var(--ink)',
              }}
            />
          </div>

          {/* Category */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Area</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {cats.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)} style={{
                  padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
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
                const label = { xs:'Micro', s:'Small', m:'Medium', l:'Long', xl:'Mammoth', xxl:'Gargantuan' }[k]
                const range = { xs:'1–5m', s:'6–30m', m:'31–60m', l:'1–4h', xl:'4–8h', xxl:'1d+' }[k]
                return (
                  <button key={k} onClick={() => setEffort(k)} style={{
                    padding: '10px 8px', borderRadius: 10, fontSize: 11, textAlign: 'left',
                    background: effort === k ? 'var(--ink)' : 'var(--paper-2)',
                    color: effort === k ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid', borderColor: effort === k ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7 }}>{range}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due date */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Due date</div>
            <DueDatePicker value={due} onChange={setDue} />
          </div>

          {/* Priority matrix */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Priority</div>
            <EisenhowerMatrix quad={quad} onChange={v => setQuad(v as QuadKey)} />
          </div>

          {/* Recurring */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Repeat</div>
            <RecurringPicker value={recurring} onChange={setRecurring} />
          </div>

          {/* Notes */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              style={{
                width: '100%', minHeight: 70, padding: '12px 16px',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                borderRadius: 12, fontSize: 14, resize: 'none', lineHeight: 1.5,
                color: 'var(--ink)',
              }}
            />
          </div>

          <button onClick={handleAdd} disabled={!title.trim()} style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: title.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: title.trim() ? 'var(--paper)' : 'var(--ink-3)',
            fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icons.plus size={18} /> Add Task
          </button>
        </div>
      </div>
    </div>
  )
}
