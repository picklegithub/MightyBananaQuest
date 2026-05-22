import { makeId } from '../lib/makeId'
import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, addHabit, updateHabit, updateGoal } from '../data/db'
import { EFFORT, EFFORT_ORDER, DEFAULT_CATEGORIES } from '../constants'
import { Icons } from './ui/Icons'
import { UnifiedDuePicker } from './ui/UnifiedDuePicker'
import type { EffortKey, Task, Habit } from '../types'

const FREQUENCY_OPTIONS = ['daily', 'weekdays', 'weekends', '3x/week', '2x/week', 'weekly', 'monthly']

interface Props {
  onClose: () => void
  defaultTitle?: string
  defaultCatId?: string
  defaultDue?: string
  defaultIsHabit?: boolean
  linkToGoalId?: string
  editHabit?: Habit
}

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

export function AddTaskSheet({ onClose, defaultTitle = '', defaultCatId, defaultDue, defaultIsHabit = false, linkToGoalId, editHabit }: Props) {
  const [title,       setTitle]       = useState(editHabit?.title ?? defaultTitle)
  const [effort,      setEffort]      = useState<EffortKey>('m')
  const [due,         setDue]         = useState(defaultDue ?? '')
  const [time,        setTime]        = useState<string | undefined>(undefined)
  const [recurring,   setRecurring]   = useState<string | null>(null)
  const [reminderMin, setReminderMin] = useState<number | undefined>(undefined)
  const [customReminder, setCustomReminder] = useState('')
  const [notes,       setNotes]       = useState(editHabit?.notes ?? '')
  const [why,         setWhy]         = useState(editHabit?.why ?? '')
  const [goalId,      setGoalId]      = useState<string | null>(editHabit?.goalId ?? null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isHabit,     setIsHabit]     = useState(editHabit ? true : defaultIsHabit)
  const [frequency,   setFrequency]   = useState(editHabit?.frequency ?? 'daily')
  const [status,      setStatus]      = useState<'backlog' | 'active' | 'someday'>('backlog')

  const liveCategories = useLiveQuery(() => db.categories.toArray(), [])
  const cats  = liveCategories ?? DEFAULT_CATEGORIES
  const goals      = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const workspaces = useLiveQuery(() => db.workspaces.toArray(), []) ?? []
  const [cat, setCat] = useState(editHabit?.cat ?? defaultCatId ?? cats[0]?.id ?? 'home')

  async function handleAdd() {
    if (!title.trim()) return
    if (editHabit) {
      await updateHabit(editHabit.id, {
        title: title.trim(),
        cat: cat || undefined,
        frequency,
        notes: notes.trim() || undefined,
        why: why.trim() || undefined,
        goalId: goalId || undefined,
      })
      onClose()
      return
    }
    if (isHabit) {
      const habit: Habit = {
        id: makeId(),
        title: title.trim(),
        cat: cat || undefined,
        frequency,
        streak: 0,
        bestStreak: 0,
        done: false,
        notes: notes.trim() || undefined,
        why: why.trim() || undefined,
        goalId: goalId || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await addHabit(habit)
    } else {
      const effectiveReminder = reminderMin === -1
        ? (customReminder.trim() ? parseInt(customReminder, 10) || undefined : undefined)
        : reminderMin
      const task: Task = {
        id: makeId(),
        title: title.trim(),
        cat, effort, due, time,  recurring,
        reminderMin: effectiveReminder,
        notes: notes.trim() || undefined,
        workspaceId: workspaceId || undefined,
        done: false, streak: 0, sub: [],
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await addTask(task)
      if (linkToGoalId) {
        const goal = await db.goals.get(linkToGoalId)
        if (goal) await updateGoal(linkToGoalId, { linked: [...goal.linked, task.id] })
      }
    }
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
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
            <h2 className="t-display" style={{ fontSize: 20 }}>{editHabit ? '✏️ Edit Habit' : isHabit ? '🔥 New Habit' : 'New Task'}</h2>
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

          {/* Task / Habit pill switcher — hidden when editing an existing habit */}
          {!editHabit && <div>
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
          </div>}

          {/* Area */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Area</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <OptionPill active={cat === ''} onClick={() => setCat('')}>None</OptionPill>
              {cats.map(c => (
                <OptionPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                  {c.name}
                </OptionPill>
              ))}
            </div>
          </div>

          {/* Effort — task mode only */}
          {!isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Effort</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {EFFORT_ORDER.map(k => {
                  const d = EFFORT[k]
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
                      <span style={{ fontSize: 10, opacity: 0.65 }}>{d.range}</span>
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

          {/* Why — habit mode only */}
          {isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Why this habit?</div>
              <input
                value={why}
                onChange={e => setWhy(e.target.value)}
                placeholder="What does this habit build toward?"
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  borderRadius: 12, fontSize: 14, color: 'var(--ink)',
                  fontFamily: 'var(--font-display)', fontStyle: why ? 'italic' : 'normal',
                }}
              />
            </div>
          )}

          {/* Goal link — habit mode only, only shown when goals exist */}
          {isHabit && goals.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Building toward</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <OptionPill active={goalId === null} onClick={() => setGoalId(null)}>
                  None
                </OptionPill>
                {goals.map(g => (
                  <OptionPill key={g.id} active={goalId === g.id} onClick={() => setGoalId(g.id)}>
                    {g.title}
                  </OptionPill>
                ))}
              </div>
            </div>
          )}

          {/* Status — task mode only */}
          {!isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Status</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {([
                  { v: 'backlog',  l: 'Backlog'  },
                  { v: 'active',   l: 'Active'   },
                  { v: 'someday',  l: 'Someday'  },
                ] as { v: 'backlog' | 'active' | 'someday'; l: string }[]).map(o => (
                  <OptionPill key={o.v} active={status === o.v} onClick={() => setStatus(o.v)}>
                    {o.l}
                  </OptionPill>
                ))}
              </div>
            </div>
          )}

          {/* Workspace — task mode only, only when workspaces exist */}
          {!isHabit && workspaces.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Share to workspace</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <OptionPill active={workspaceId === null} onClick={() => setWorkspaceId(null)}>
                  Personal
                </OptionPill>
                {workspaces.map(ws => (
                  <OptionPill key={ws.id} active={workspaceId === ws.id} onClick={() => setWorkspaceId(ws.id)}>
                    {ws.name}
                  </OptionPill>
                ))}
              </div>
            </div>
          )}

          {/* Schedule — task mode only */}
          {!isHabit && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Schedule</div>
              <UnifiedDuePicker
                due={due}
                recurring={recurring}
                time={time}
                onChange={(d, r, t) => { setDue(d); setRecurring(r); setTime(t) }}
              />
            </div>
          )}

          {/* Reminder — task mode only, only when a due date or time is set */}
          {!isHabit && (due || time) && (() => {
            // -1 is a sentinel meaning "custom input mode"
            const CUSTOM = -1
            const presets: { label: string; value: number | undefined }[] = [
              { label: 'None',    value: undefined },
              { label: 'On time', value: 0         },
              { label: '5 min',   value: 5         },
              { label: '30 min',  value: 30        },
              { label: '1 hour',  value: 60        },
              { label: '1 day',   value: 1440      },
            ]
            const isCustom = reminderMin === CUSTOM
            return (
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Remind me</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {presets.map(o => (
                    <OptionPill
                      key={String(o.value)}
                      active={reminderMin === o.value}
                      onClick={() => { setReminderMin(o.value); setCustomReminder('') }}
                    >
                      {o.label}
                    </OptionPill>
                  ))}
                  <OptionPill
                    active={isCustom}
                    onClick={() => { setReminderMin(CUSTOM); setTimeout(() => document.getElementById('reminder-custom-input')?.focus(), 50) }}
                  >
                    Custom
                  </OptionPill>
                </div>
                {isCustom && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      id="reminder-custom-input"
                      type="number"
                      min={1}
                      value={customReminder}
                      onChange={e => setCustomReminder(e.target.value)}
                      placeholder="e.g. 45"
                      style={{
                        width: 100, padding: '8px 12px',
                        background: 'var(--paper-2)', border: '1px solid var(--rule)',
                        borderRadius: 10, fontSize: 13, color: 'var(--ink)',
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>minutes before</span>
                  </div>
                )}
              </div>
            )
          })()}

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
            <Icons.plus size={18} /> {editHabit ? 'Save Changes' : isHabit ? 'Add Habit' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
