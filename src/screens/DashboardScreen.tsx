import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, addCategory, deleteTask } from '../data/db'

// Feature flag — disable by setting localStorage key 'shopping_list_enabled' to 'false'
const SHOPPING_LIST_ENABLED = localStorage.getItem('shopping_list_enabled') !== 'false'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { SectionHeader, ConfettiBurst } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { SwipeableRow } from '../components/SwipeableRow'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { triggerSync } from '../components/SyncStatusBar'
import type { Screen, Task, Category } from '../types'

// ── Area icons available for custom areas ─────────────────────────────────────
const AREA_ICONS = ['home','heart','briefcase','book','dollar','family','leaf','drop','bolt','star','bell','layers','pet']


// ── Add Area Modal ────────────────────────────────────────────────────────────
function AddAreaModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('home')
  const [hue, setHue] = useState(200)

  async function handleSave() {
    if (!name.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await addCategory({ id: `${id}-${Date.now()}`, name: name.trim(), icon, hue })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 22 }}>New Area</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Name</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Pets, Pool, Mindfulness…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AREA_ICONS.map(ic => {
                const I = Icons[ic] ?? Icons.home
                return (
                  <button key={ic} onClick={() => setIcon(ic)} style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: icon === ic ? `hsl(${hue},55%,42%)` : 'var(--paper-2)',
                    color: icon === ic ? 'white' : 'var(--ink-2)',
                    border: '1px solid', borderColor: icon === ic ? 'transparent' : 'var(--rule)',
                  }}>
                    <I size={18} />
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Colour — hue {hue}°</div>
            <input type="range" min={0} max={360} value={hue} onChange={e => setHue(Number(e.target.value))}
              style={{ width: '100%', accentColor: `hsl(${hue},55%,42%)` }} />
            <div style={{ height: 24, borderRadius: 8, marginTop: 8, background: `hsl(${hue},55%,42%)` }} />
          </div>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: name.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: name.trim() ? 'var(--paper)' : 'var(--ink-3)',
          }}>
            Add area
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  navigate: (s: Screen) => void
}

interface Burst { id: number; x: number; y: number; xp: number }

const today = new Date()
const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()]
const DATE = today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

export const DashboardScreen = ({ navigate }: Props) => {
  const [bursts, setBursts]           = useState<Burst[]>([])
  const [showAddArea, setShowAddArea] = useState(false)
  const tasks    = useLiveQuery(() => db.tasks.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const inboxCount = useLiveQuery(
    () => db.tasks.where('cat').equals('inbox').filter(t => !t.done).count(),
    []
  )
  const shoppingUnchecked = useLiveQuery(
    () => db.shoppingItems.filter(i => !i.checked).count(),
    []
  )

  const { pullRatio, isPulling, containerProps } = usePullToRefresh(triggerSync, 72)

  if (!tasks || !settings) return null

  const habitTasks    = tasks.filter(t => t.isHabit)
  const habitPending  = habitTasks.filter(t => !t.done).length
  const allTodayTasks = tasks.filter(t => t.due === 'Today')
  const doneTodayCount = allTodayTasks.filter(t => t.done).length
  const totalToday = allTodayTasks.length
  const xp = settings.xp ?? 0
  const streak = settings.streak ?? 0

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="t-display" style={{ fontSize: 28 }}>{DAY}</div>
            <div className="eyebrow" style={{ marginTop: 2 }}>{DATE}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
            {streak > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>
                <Icons.flame size={14} />
                <span style={{ fontWeight: 600 }}>{streak}</span>
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {xp.toLocaleString()} XP
            </div>
            <ThemeToggle />
            <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
              <Icons.settings size={20} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {totalToday > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>TODAY'S TASKS</span>
              <span>{doneTodayCount}/{totalToday} done</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${totalToday ? (doneTodayCount / totalToday) * 100 : 0}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        )}
      </div>

      <div className="screen-scroll" style={{ padding: '0 0 16px' }} {...containerProps}>
        {/* Pull-to-refresh indicator */}
        {isPulling && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: Math.round(pullRatio * 40),
            overflow: 'hidden', transition: 'height 0.1s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: '2px solid var(--rule)',
              borderTopColor: 'var(--accent)',
              opacity: pullRatio,
              transform: `rotate(${pullRatio * 360}deg)`,
            }} />
          </div>
        )}
        {/* Area grid — Inbox first, then categories */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>

            {/* ── Inbox card — always first ── */}
            <button
              onClick={() => navigate({ name: 'inbox' })}
              style={{
                padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ color: `hsl(200, 55%, 42%)` }}>
                  <Icons.inbox size={16} />
                </div>
                {(inboxCount ?? 0) > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'white', letterSpacing: '0.06em',
                    background: 'var(--warn)', borderRadius: 10, padding: '1px 6px', fontWeight: 600,
                  }}>
                    {inboxCount}
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Inbox</div>
                {(inboxCount ?? 0) > 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                    {inboxCount} uncategorised
                  </div>
                )}
              </div>
            </button>

            {/* ── Shopping List card ── */}
            {SHOPPING_LIST_ENABLED && (
              <button
                onClick={() => navigate({ name: 'shopping-list' })}
                style={{
                  padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ color: `hsl(140, 45%, 38%)` }}>
                    <Icons.cart size={16} />
                  </div>
                  {(shoppingUnchecked ?? 0) > 0 && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'white', letterSpacing: '0.06em',
                      background: `hsl(140, 45%, 38%)`, borderRadius: 10, padding: '1px 6px', fontWeight: 600,
                    }}>
                      {shoppingUnchecked}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Shopping</div>
                  {(shoppingUnchecked ?? 0) > 0 ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                      {shoppingUnchecked} to get
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                      all clear
                    </div>
                  )}
                </div>
              </button>
            )}

            {/* ── Habits card — only shown when habits exist ── */}
            {habitTasks.length > 0 && (
              <button
                onClick={() => navigate({ name: 'all-habits' })}
                style={{
                  padding: '12px 10px', borderRadius: 12, textAlign: 'left',
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ color: `hsl(280, 55%, 48%)` }}>
                    <Icons.repeat size={16} />
                  </div>
                  {habitPending > 0 && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'white', letterSpacing: '0.06em',
                      background: `hsl(280, 55%, 48%)`, borderRadius: 10, padding: '1px 6px', fontWeight: 600,
                    }}>
                      {habitPending}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Habits</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                    {habitPending > 0 ? `${habitPending} to log` : 'all logged'}
                  </div>
                </div>
              </button>
            )}

            {/* ── Area cards ── */}
            {cats.map((cat: Category) => {
              const catTasks  = tasks.filter(t => t.cat === cat.id)
              const catDone   = catTasks.filter(t => t.done).length
              const catOpen   = catTasks.filter(t => !t.done).length
              const catTotal  = catTasks.length
              const habitCount = catTasks.filter(t => t.isHabit || t.recurring).length
              const progress  = catTotal > 0 ? catDone / catTotal : 0
              const I = Icons[cat.icon] ?? Icons.home
              const hue = cat.hue
              // Mini ring SVG values
              const R = 11, C = 2 * Math.PI * R

              return (
                <div key={cat.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => navigate({ name: 'category', catId: cat.id })}
                    style={{
                      width: '100%', padding: '11px 10px 10px', borderRadius: 12, textAlign: 'left',
                      background: 'var(--paper-2)', border: '1px solid var(--rule)',
                      display: 'flex', flexDirection: 'column', gap: 7,
                    }}
                  >
                    {/* Top row: icon + mini progress ring */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: `hsl(${hue}, 40%, 92%)`,
                        color: `hsl(${hue}, 55%, 38%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <I size={14} />
                      </div>
                      {catTotal > 0 && (
                        <svg width={26} height={26} style={{ flexShrink: 0 }}>
                          <circle cx={13} cy={13} r={R} fill="none" stroke="var(--rule)" strokeWidth={2.5} />
                          <circle cx={13} cy={13} r={R} fill="none"
                            stroke={`hsl(${hue}, 55%, 42%)`} strokeWidth={2.5}
                            strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                            strokeLinecap="round" transform="rotate(-90 13 13)" />
                        </svg>
                      )}
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{cat.name}</div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {catOpen > 0 ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                          {catOpen} open
                        </span>
                      ) : catTotal > 0 ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: `hsl(${hue}, 55%, 42%)`, letterSpacing: '0.04em' }}>
                          ✓ all done
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                          empty
                        </span>
                      )}
                      {habitCount > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warn)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Icons.flame size={8} />{habitCount}
                        </span>
                      )}
                    </div>
                  </button>

                </div>
              )
            })}

            {/* Add Area button */}
            <button onClick={() => setShowAddArea(true)} style={{
              padding: '12px 10px', borderRadius: 12, textAlign: 'left',
              background: 'transparent', border: '1px dashed var(--rule)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 72,
            }}>
              <Icons.plus size={18} style={{ color: 'var(--ink-4)' }} />
              <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>ADD AREA</span>
            </button>
          </div>
        </div>

        {/* Today's tasks */}
        {allTodayTasks.length > 0 && (
          <div style={{ padding: '20px 20px 0' }}>
            <SectionHeader title="Today" action={
              <button onClick={() => navigate({ name: 'all-tasks' })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                ALL <Icons.arrow size={12} />
              </button>
            } />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allTodayTasks.map(task => (
                <SwipeableRow
                  key={task.id}
                  disabled={task.done}
                  onComplete={() => completeTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                >
                  <TaskCard task={task}
                    hue={cats.find((c: Category) => c.id === task.cat)?.hue}
                    onTap={() => navigate({ name: 'task', taskId: task.id })}
                    onComplete={(e) => handleComplete(e, task)}
                  />
                </SwipeableRow>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming — non-today tasks with a due date */}
        <UpcomingSection tasks={tasks} cats={cats} navigate={navigate} handleComplete={handleComplete} onDelete={deleteTask} />
      </div>

      {/* Confetti bursts */}
      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
      {showAddArea && <AddAreaModal onClose={() => setShowAddArea(false)} />}
    </div>
  )
}


function UpcomingSection({ tasks, cats, navigate, handleComplete, onDelete }: {
  tasks: Task[]
  cats: Category[]
  navigate: (s: Screen) => void
  handleComplete: (e: React.MouseEvent, task: Task) => void
  onDelete: (id: string) => void
}) {
  const todayISO     = new Date().toISOString().slice(0, 10)
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowISO  = tomorrowDate.toISOString().slice(0, 10)
  const isoRe        = /^\d{4}-\d{2}-\d{2}$/

  const overdue   = tasks.filter(t => !t.done && isoRe.test(t.due) && t.due < todayISO)
  const tomorrow  = tasks.filter(t => !t.done && (t.due === 'Tomorrow' || t.due === tomorrowISO))
  const upcoming  = tasks.filter(t =>
    !t.done &&
    t.due !== 'Today' && t.due !== 'Tomorrow' && t.due !== '' &&
    !(isoRe.test(t.due) && t.due <= tomorrowISO)
  )

  // Sort upcoming ISO tasks by date; 'Someday' / text labels go to end
  const sorted = [...upcoming].sort((a, b) => {
    const aIso = isoRe.test(a.due) ? a.due : '9999'
    const bIso = isoRe.test(b.due) ? b.due : '9999'
    return aIso < bIso ? -1 : aIso > bIso ? 1 : 0
  })

  const hasAny = overdue.length > 0 || tomorrow.length > 0 || sorted.length > 0
  if (!hasAny) return null

  function TaskGroup({ label, labelColor, tasks: group }: { label: string; labelColor?: string; tasks: Task[] }) {
    if (group.length === 0) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
          color: labelColor ?? 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase',
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {group.map(task => (
            <SwipeableRow
              key={task.id}
              disabled={task.done}
              onComplete={() => completeTask(task.id)}
              onDelete={() => onDelete(task.id)}
            >
              <TaskCard task={task}
                hue={cats.find(c => c.id === task.cat)?.hue}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={e => handleComplete(e, task)}
              />
            </SwipeableRow>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <SectionHeader title="Upcoming" action={
        <button onClick={() => navigate({ name: 'all-tasks' })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
          ALL <Icons.arrow size={12} />
        </button>
      } />
      <div style={{ marginTop: 12 }}>
        <TaskGroup label={`Overdue \u00B7 ${overdue.length}`} labelColor="var(--warn)" tasks={overdue} />
        <TaskGroup label="Tomorrow" tasks={tomorrow} />
        <TaskGroup label="Later" tasks={sorted.slice(0, 5)} />
        {sorted.length > 5 && (
          <button onClick={() => navigate({ name: 'all-tasks' })} style={{
            padding: '10px 14px', borderRadius: 12, background: 'transparent',
            border: '1px dashed var(--rule)', fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--ink-3)', letterSpacing: '0.06em', width: '100%',
          }}>
            +{sorted.length - 5} more tasks
          </button>
        )}
      </div>
    </div>
  )
}
