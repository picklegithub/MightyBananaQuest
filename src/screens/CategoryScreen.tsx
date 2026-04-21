import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeTask, addTask } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst, Seg } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { TaskCard } from '../components/TaskCard'
import type { Screen, Task } from '../types'

interface Props { catId: string; navigate: (s: Screen) => void; back: () => void; onAddTask?: () => void }
interface Burst { id: number; x: number; y: number; xp: number }

// ── Today ISO ─────────────────────────────────────────────────────────────────
const todayISO = new Date().toISOString().slice(0, 10)

// ── Habit check-in card ───────────────────────────────────────────────────────
// Shows "logged today" state without strikethrough — it's an ongoing habit, not
// a permanent completion.
function HabitRow({
  task, hue,
  onCheckin, onTap,
}: {
  task: Task
  hue: number
  onCheckin: (e: React.MouseEvent) => void
  onTap: () => void
}) {
  const loggedToday = task.done  // done=true means it was logged today; resets tomorrow
  const color = `hsl(${hue}, 55%, 42%)`
  const softBg = `hsl(${hue}, 40%, 93%)`
  const softColor = `hsl(${hue}, 55%, 35%)`

  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 13px 10px 10px',
        background: loggedToday ? softBg : 'var(--paper-2)',
        borderRadius: 12,
        border: `1px solid ${loggedToday ? `hsl(${hue}, 35%, 80%)` : 'var(--rule)'}`,
        borderLeft: `3px solid ${color}`,
        textAlign: 'left', width: '100%',
        transition: 'all .15s',
      }}
    >
      {/* Check-in button */}
      <button
        onClick={onCheckin}
        title={loggedToday ? 'Logged today' : 'Log check-in'}
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${loggedToday ? color : `hsl(${hue}, 30%, 72%)`}`,
          background: loggedToday ? color : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: loggedToday ? 'white' : color,
          transition: 'all .15s',
        }}
      >
        <Icons.flame size={13} />
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.3,
          color: loggedToday ? softColor : 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {loggedToday ? (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: softColor, fontWeight: 600,
            }}>
              ✓ logged today
            </span>
          ) : (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: 'var(--ink-4)',
            }}>
              tap flame to log
            </span>
          )}
          {task.streak > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icons.flame size={8} /> {task.streak}d streak
            </span>
          )}
          {task.recurring && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Icons.repeat size={8} /> {task.recurring}
            </span>
          )}
        </div>
      </div>

      <Icons.arrow size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
    </button>
  )
}

// ── Ghost inline task input ───────────────────────────────────────────────────
function GhostInput({
  catId, hue, onSaved,
}: {
  catId: string
  hue: number
  onSaved: () => void
}) {
  const [active, setActive] = useState(false)
  const [value,  setValue]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 40)
  }, [active])

  async function handleSave() {
    const t = value.trim()
    if (!t) { setActive(false); return }
    await addTask({
      id: `t${Date.now()}`,
      title: t,
      cat: catId,
      effort: 's',
      due: '',
      ctx: '@anywhere',
      quad: 'q2',
      recurring: null,
      done: false,
      streak: 0,
      sub: [],
    })
    setValue('')
    setActive(false)
    onSaved()
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '9px 13px',
          borderRadius: 12, border: `1px dashed var(--rule)`,
          color: 'var(--ink-4)', fontSize: 13,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          border: `1.5px dashed hsl(${hue}, 35%, 70%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: `hsl(${hue}, 45%, 60%)`, flexShrink: 0,
        }}>
          <Icons.plus size={11} />
        </span>
        New task…
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) handleSave()
          if (e.key === 'Escape') { setValue(''); setActive(false) }
        }}
        placeholder="Task title…"
        style={{
          flex: 1, padding: '10px 13px', borderRadius: 12,
          border: `2px solid hsl(${hue}, 45%, 60%)`,
          background: 'var(--paper-2)', fontSize: 14, color: 'var(--ink)',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSave}
        disabled={!value.trim()}
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: value.trim() ? `hsl(${hue}, 55%, 42%)` : 'var(--paper-3)',
          color: value.trim() ? 'white' : 'var(--ink-4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icons.check size={14} sw={2.5} />
      </button>
      <button
        onClick={() => { setValue(''); setActive(false) }}
        style={{ width: 38, height: 38, borderRadius: 10, color: 'var(--ink-3)', border: '1px solid var(--rule)', flexShrink: 0 }}
      >
        <Icons.close size={14} />
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export const CategoryScreen = ({ catId, navigate, back, onAddTask }: Props) => {
  const [filter, setFilter]   = useState<'all' | 'open' | 'done'>('open')
  const [bursts, setBursts]   = useState<Burst[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  const tasks = useLiveQuery(() => db.tasks.where('cat').equals(catId).toArray(), [catId])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const cat   = cats.find(c => c.id === catId)

  if (!tasks || !cat) return null

  // Split habits from regular tasks
  const habitTasks   = tasks.filter(t => t.isHabit || !!t.recurring)
  const regularTasks = tasks.filter(t => !t.isHabit && !t.recurring)

  const filteredRegular = regularTasks.filter(t =>
    filter === 'all'  ? true :
    filter === 'open' ? !t.done : t.done
  )

  const doneCount  = tasks.filter(t => t.done && !t.isHabit && !t.recurring).length
  const totalCount = regularTasks.length
  const hue = cat.hue

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== b[0]?.id)), 1400)
    }
  }

  async function handleHabitCheckin(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return  // already logged today
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== b[0]?.id)), 1400)
    }
  }

  const I = Icons[cat.icon] ?? Icons.home

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <Icons.back size={16} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <button onClick={() => onAddTask?.()} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--ink-2)', letterSpacing: '0.06em',
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--rule)',
              background: 'var(--paper-2)',
            }}>
              <Icons.plus size={14} /> ADD
            </button>
          </div>
        </div>

        {/* Area identity row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: `hsl(${hue}, 40%, 90%)`,
            color: `hsl(${hue}, 55%, 38%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <I size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="t-display" style={{ fontSize: 22 }}>{cat.name}</h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 1 }}>
              {totalCount > 0
                ? `${doneCount}/${totalCount} done`
                : habitTasks.length > 0
                  ? `${habitTasks.length} habit${habitTasks.length > 1 ? 's' : ''}`
                  : 'empty'}
            </div>
          </div>
        </div>

        {/* Progress bar (regular tasks only) */}
        {totalCount > 0 && (
          <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: `hsl(${hue}, 55%, 42%)`, width: `${(doneCount / totalCount) * 100}%`, transition: 'width .4s' }} />
          </div>
        )}
      </div>

      {/* Filter (regular tasks only) */}
      {regularTasks.length > 0 && (
        <div style={{ padding: '9px 18px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
          <Seg
            value={filter}
            setValue={v => setFilter(v as typeof filter)}
            options={[{ v: 'open', l: 'Open' }, { v: 'all', l: 'All' }, { v: 'done', l: 'Done' }]}
          />
        </div>
      )}

      <div className="screen-scroll" style={{ padding: '14px 18px 48px' }}>

        {/* ── Habits section ── */}
        {habitTasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
              <Icons.flame size={12} style={{ color: 'var(--warn)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Habits
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                {habitTasks.filter(t => t.done).length}/{habitTasks.length} today
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {habitTasks.map(task => (
                <HabitRow
                  key={task.id}
                  task={task}
                  hue={hue}
                  onCheckin={e => handleHabitCheckin(e, task)}
                  onTap={() => navigate({ name: 'task', taskId: task.id })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Regular tasks section ── */}
        {(habitTasks.length > 0 && regularTasks.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Tasks
            </span>
          </div>
        )}

        {filteredRegular.length === 0 && regularTasks.length === 0 && habitTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            No tasks yet — use the input below to add one
          </div>
        ) : filteredRegular.length === 0 && regularTasks.length > 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
            {filter === 'done' ? 'No completed tasks yet' : 'No open tasks — nice work!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {filteredRegular.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                hue={hue}
                onTap={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={e => handleComplete(e, task)}
              />
            ))}
          </div>
        )}

        {/* ── Ghost inline task input ── */}
        {filter !== 'done' && (
          <GhostInput catId={catId} hue={hue} onSaved={() => setSavedFlash(true)} />
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
