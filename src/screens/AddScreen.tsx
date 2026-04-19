import React, { useState } from 'react'
import { db, addTask } from '../data/db'
import { EFFORT_ORDER, DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { EisenhowerMatrix, Seg } from '../components/ui'
import type { Screen, EffortKey, QuadKey, Task } from '../types'

interface Props { navigate: (s: Screen) => void }

function parseNL(text: string): Partial<Task> {
  const t = text
  const effort: EffortKey =
    /gargantuan|all.?week|week.?long/i.test(t)   ? 'xxl' :
    /mammoth|all.?day|full.?day|8.?hour/i.test(t) ? 'xl'  :
    /large|long|deep.?clean|hour|project/i.test(t)? 'l'   :
    /quick|short|small|min|micro|tiny/i.test(t)   ? 's'   :
    /3\s*min|nano/i.test(t)                        ? 'xs'  : 'm'

  const due =
    /\btoday\b/i.test(t)    ? 'Today' :
    /\btomorrow\b/i.test(t) ? 'Tomorrow' :
    /\bmonday\b/i.test(t)   ? 'Mon' :
    /\btuesday\b/i.test(t)  ? 'Tue' :
    /\bwednesday\b/i.test(t)? 'Wed' :
    /\bthursday\b/i.test(t) ? 'Thu' :
    /\bfriday\b/i.test(t)   ? 'Fri' :
    /\bsaturday\b/i.test(t) ? 'Sat' :
    /\bsunday\b/i.test(t)   ? 'Sun' : 'Today'

  const cat =
    /gym|workout|health|walk|run|sleep|diet/i.test(t)    ? 'health'   :
    /work|job|meeting|email|OKR|report|boss/i.test(t)    ? 'work'     :
    /budget|bill|tax|money|pay|invoice|bank/i.test(t)    ? 'finance'  :
    /read|learn|course|book|study|spanish/i.test(t)      ? 'learning' :
    /family|mum|dad|kids|wife|husband|call/i.test(t)     ? 'family'   :
    /home|clean|laundry|garden|dishwasher/i.test(t)      ? 'home'     : 'home'

  const ctx =
    /gym/i.test(t)         ? '@gym'     :
    /email/i.test(t)       ? '@email'   :
    /phone|call/i.test(t)  ? '@phone'   :
    /laptop|computer/i.test(t) ? '@laptop' : '@anywhere'

  const quad: QuadKey =
    /urgent|ASAP|immediately|deadline|overdue/i.test(t) ? 'q1' :
    /important|priority|schedule/i.test(t)               ? 'q2' : 'q2'

  return { effort, due, cat, ctx, quad }
}

export const AddScreen = ({ navigate }: Props) => {
  const [mode, setMode] = useState<'quick' | 'manual'>('quick')
  const [nlText, setNlText] = useState('')
  const [nlParsed, setNlParsed] = useState<Partial<Task> | null>(null)

  // Manual form state
  const [title, setTitle] = useState('')
  const [cat, setCat] = useState('home')
  const [effort, setEffort] = useState<EffortKey>('m')
  const [due, setDue] = useState('Today')
  const [ctx, setCtx] = useState('@anywhere')
  const [quad, setQuad] = useState<QuadKey>('q2')
  const [recurring, setRecurring] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const cats = DEFAULT_CATEGORIES

  function handleNLChange(v: string) {
    setNlText(v)
    if (v.length > 3) {
      const parsed = parseNL(v)
      setNlParsed(parsed)
    } else {
      setNlParsed(null)
    }
  }

  async function handleQuickAdd() {
    if (!nlText.trim()) return
    const parsed = nlParsed ?? parseNL(nlText)
    const task: Task = {
      id: `t${Date.now()}`,
      title: nlText.trim(),
      cat: parsed.cat ?? 'home',
      effort: parsed.effort ?? 'm',
      due: parsed.due ?? 'Today',
      ctx: parsed.ctx ?? '@anywhere',
      quad: parsed.quad ?? 'q2',
      recurring: null,
      done: false,
      streak: 0,
      sub: [],
    }
    await addTask(task)
    navigate({ name: 'dashboard' })
  }

  async function handleManualAdd() {
    if (!title.trim()) return
    const task: Task = {
      id: `t${Date.now()}`,
      title: title.trim(),
      cat, effort, due, ctx, quad, recurring, notes,
      done: false, streak: 0, sub: [],
    }
    await addTask(task)
    navigate({ name: 'dashboard' })
  }

  const RECUR_OPTIONS = [null, 'Daily', 'Every 3d', 'Weekly', 'Monthly', 'Yearly']
  const DUE_OPTIONS = ['Today', 'Tomorrow', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'This week']

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={() => navigate({ name: 'dashboard' })} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <Icons.back size={18} /> Cancel
        </button>
        <div className="t-display" style={{ fontSize: 18 }}>New Task</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0, display: 'flex', gap: 8 }}>
        {(['quick', 'manual'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            background: mode === m ? 'var(--ink)' : 'var(--paper-2)',
            color: mode === m ? 'var(--paper)' : 'var(--ink-2)',
            border: '1px solid', borderColor: mode === m ? 'var(--ink)' : 'var(--rule)',
          }}>
            {m === 'quick' ? '⚡ Quick' : '✦ Detailed'}
          </button>
        ))}
      </div>

      <div className="screen-scroll" style={{ padding: '20px 20px 40px' }}>
        {mode === 'quick' ? (
          /* ── Quick-add (NL) ─────────────────────────── */
          <div>
            <div style={{ marginBottom: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>What needs doing?</div>
              <textarea
                autoFocus
                value={nlText}
                onChange={e => handleNLChange(e.target.value)}
                placeholder="e.g. Call mum on Sunday, quick workout today, pay electricity bill by Friday…"
                style={{
                  width: '100%', minHeight: 90, padding: '14px 16px',
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  borderRadius: 12, fontSize: 15, resize: 'none', lineHeight: 1.5,
                  color: 'var(--ink)',
                }}
              />
            </div>

            {/* NL preview */}
            {nlParsed && nlText.trim() && (
              <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Parsed as</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: nlParsed.cat ?? 'home' },
                    { label: nlParsed.effort ?? 'm' },
                    { label: nlParsed.due ?? 'Today' },
                    { label: nlParsed.ctx ?? '@anywhere' },
                  ].map((c, i) => (
                    <span key={i} style={{
                      padding: '4px 10px', borderRadius: 20, background: 'var(--ink)', color: 'var(--paper)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                    }}>
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleQuickAdd}
              disabled={!nlText.trim()}
              style={{
                width: '100%', padding: '16px', borderRadius: 14,
                background: nlText.trim() ? 'var(--ink)' : 'var(--paper-3)',
                color: nlText.trim() ? 'var(--paper)' : 'var(--ink-3)',
                fontSize: 15, fontWeight: 600, letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <Icons.plus size={18} /> Add Task
            </button>
          </div>
        ) : (
          /* ── Manual form ─────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Title */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Title</div>
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Task title…"
                style={{
                  width: '100%', padding: '13px 16px', background: 'var(--paper-2)',
                  border: '1px solid var(--rule)', borderRadius: 12, fontSize: 15, color: 'var(--ink)',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Category</div>
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
                  const e = { xs: 'Micro', s: 'Small', m: 'Medium', l: 'Long', xl: 'Mammoth', xxl: 'Gargantuan' }[k]
                  const r = { xs: '1–5m', s: '6–30m', m: '31–60m', l: '1–4h', xl: '4–8h', xxl: '1d+' }[k]
                  return (
                    <button key={k} onClick={() => setEffort(k)} style={{
                      padding: '10px 8px', borderRadius: 10, fontSize: 11, textAlign: 'left',
                      background: effort === k ? 'var(--ink)' : 'var(--paper-2)',
                      color: effort === k ? 'var(--paper)' : 'var(--ink)',
                      border: '1px solid', borderColor: effort === k ? 'var(--ink)' : 'var(--rule)',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{e}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7 }}>{r}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Due */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Due</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DUE_OPTIONS.map(d => (
                  <button key={d} onClick={() => setDue(d)} style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: due === d ? 'var(--ink)' : 'var(--paper-2)',
                    color: due === d ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: due === d ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority matrix */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Priority</div>
              <EisenhowerMatrix quad={quad} onChange={v => setQuad(v as QuadKey)} />
            </div>

            {/* Recurring */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Recurring</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RECUR_OPTIONS.map(r => (
                  <button key={String(r)} onClick={() => setRecurring(r)} style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: recurring === r ? 'var(--ink)' : 'var(--paper-2)',
                    color: recurring === r ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: recurring === r ? 'var(--ink)' : 'var(--rule)',
                  }}>
                    {r ?? 'One-off'}
                  </button>
                ))}
              </div>
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

            <button onClick={handleManualAdd} disabled={!title.trim()} style={{
              width: '100%', padding: '16px', borderRadius: 14,
              background: title.trim() ? 'var(--ink)' : 'var(--paper-3)',
              color: title.trim() ? 'var(--paper)' : 'var(--ink-3)',
              fontSize: 15, fontWeight: 600, letterSpacing: '0.01em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icons.plus size={18} /> Add Task
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
