import { makeId } from '../lib/makeId'
import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, completeTask, uncompleteTask, deleteTask, deleteTasks, updateTask } from '../data/db'
import { isDueToday, isDueTomorrow } from '../lib/parseDue'
import { DEFAULT_CATEGORIES, EFFORT, EFFORT_ORDER } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst, Seg } from '../components/ui'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { SwipeableRow } from '../components/SwipeableRow'
import { TaskCard } from '../components/TaskCard'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { triggerSync } from '../components/SyncStatusBar'
import { nextDueLabel } from '../lib/parseDue'
import type { Screen, Task } from '../types'
import { useNav } from '../lib/navContext'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props { navigate?: (s: Screen) => void; back?: () => void; onAddTask?: () => void; screen?: Screen }
interface Burst { id: number; x: number; y: number; xp: number }
interface NextBanner { id: number; text: string }


// ── Inline ghost input ────────────────────────────────────────────────────────
function GhostInput({ catId, onSaved }: { catId: string; onSaved: () => void }) {
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
      id: makeId(),
      title: t,
      cat: catId === 'all' ? 'inbox' : catId,
      effort: 's',
      due: '',
      
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
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '11px 0',
          borderBottom: '1px solid var(--rule)',
          color: 'var(--ink-4)', fontSize: 14,
        }}
      >
        <Icons.plus size={13} style={{ flexShrink: 0, color: 'var(--ink-4)' }} />
        <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>New task…</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
      <Icons.plus size={13} style={{ flexShrink: 0, color: 'var(--ink-4)' }} />
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) handleSave()
          if (e.key === 'Escape') { setValue(''); setActive(false) }
        }}
        onBlur={() => { if (!value.trim()) setActive(false) }}
        placeholder="Task title…"
        className="journal-input"
        style={{
          flex: 1, background: 'transparent', border: 'none',
          borderBottom: '1px solid var(--rule)', outline: 'none',
          padding: '8px 0', fontSize: 14, color: 'var(--ink)',
          transition: 'border-bottom-color .15s',
        }}
      />
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const AllTasksScreen = ({ navigate: navProp, back: backProp, onAddTask: onAddTaskProp, screen }: Props) => {
  const { navigate: ctxNavigate, back: ctxBack, openAddTask } = useNav()
  const navigate  = navProp      ?? ctxNavigate
  const back      = backProp     ?? ctxBack
  const onAddTask = onAddTaskProp ?? openAddTask
  const initialStatus = screen?.name === 'all-tasks' ? (screen.initialStatus ?? 'all') : 'all'
  const [filter,       setFilter]       = useState<'open' | 'all' | 'done'>(initialStatus !== 'all' ? 'open' : 'open')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'someday' | 'backlog'>(initialStatus)
  const [groupBy,      setGroupBy]      = useState<'area' | 'due' | 'effort'>('due')
  const [search,    setSearch]    = useState('')
  const [bursts,     setBursts]     = useState<Burst[]>([])
  const [nextBanner, setNextBanner] = useState<NextBanner | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const cats  = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const isColorful = useIsColorful()
  const isDark     = useIsDark()

  const { pullRatio, isPulling, containerProps } = usePullToRefresh(triggerSync, 72)

  if (!tasks) return null

  // Filter tasks
  const filtered = tasks
    .filter(t => {
      if (filter === 'all')  return true
      if (filter === 'done') return t.done
      // filter === 'open'
      if (t.done) return false
      if (statusFilter === 'active')  return t.status === 'active'
      if (statusFilter === 'someday') return t.status === 'someday'
      if (statusFilter === 'backlog') return !t.status || t.status === 'backlog'
      return true   // statusFilter === 'all'
    })
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()))

  // Build groups
  type Group = { key: string; label: string; icon?: string; hue?: number; items: Task[] }
  let groups: Group[] = []

  if (groupBy === 'area') {
    const allCats = [...cats]
    groups = allCats.map(c => ({
      key: c.id,
      label: c.name,
      icon: c.icon,
      hue: isColorful ? c.hue : undefined,
      items: filtered.filter(t => t.cat === c.id),
    })).filter(g => g.items.length > 0)
    // Inbox bucket
    const inboxItems = filtered.filter(t => !cats.find(c => c.id === t.cat))
    if (inboxItems.length > 0) groups.push({ key: 'inbox', label: 'Inbox', icon: 'inbox', items: inboxItems })
  } else if (groupBy === 'due') {
    const buckets: Record<string, Task[]> = { Today: [], Tomorrow: [], 'This week': [], Later: [] }
    filtered.forEach(t => {
      if (isDueToday(t.due)) buckets['Today'].push(t)
      else if (isDueTomorrow(t.due)) buckets['Tomorrow'].push(t)
      else if (['Mon','Tue','Wed','Thu','Fri','Sat','Sun','This week'].includes(t.due)) buckets['This week'].push(t)
      else buckets['Later'].push(t)
    })
    groups = Object.entries(buckets)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => ({ key: k, label: k, items: v }))
  } else {
    groups = EFFORT_ORDER.map(eff => ({
      key: eff,
      label: `${EFFORT[eff]?.label ?? eff}`,
      items: filtered.filter(t => t.effort === eff),
    })).filter(g => g.items.length > 0)
  }

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) { await uncompleteTask(task.id); return }
    const { xp: gained, nextDue } = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.slice(1)), 1400)
    }
    if (nextDue) {
      const bid = Date.now()
      setNextBanner({ id: bid, text: `✓ Done!  Next: ${nextDueLabel(nextDue)}` })
      setTimeout(() => setNextBanner(b => b?.id === bid ? null : b), 2500)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} task${selected.size > 1 ? 's' : ''}?`)) return
    await deleteTasks([...selected])
    setSelected(new Set())
    setSelectMode(false)
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  return (
    <div className="screen">
      <ScreenHeader
        title={selectMode ? `${selected.size} selected` : 'All Tasks'}
        subtitle={`${filtered.length} of ${tasks.length}`}
        back={() => selectMode ? exitSelectMode() : back()}
        icon={<Icons.layers size={22} />}
        rightActions={selectMode && selected.size > 0 ? (
          <button onClick={handleBulkDelete} style={{
            padding: '5px 12px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11,
            background: 'var(--warn-soft)', color: 'var(--warn)',
            border: '1px solid var(--warn-soft)',
          }}>
            Delete {selected.size}
          </button>
        ) : undefined}
      />

      {/* Search */}
      <div style={{ padding: '0 20px 10px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', borderRadius: 10,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
        }}>
          <Icons.search size={14} stroke="var(--ink-3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search across all areas…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--ink-3)' }}>
              <Icons.close size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter + Group controls */}
      <div style={{ padding: '0 20px 10px', flexShrink: 0, borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Seg value={filter} setValue={v => { setFilter(v as typeof filter); setStatusFilter('all') }} options={[
            { v: 'open', l: 'Open' }, { v: 'all', l: 'All' }, { v: 'done', l: 'Done' },
          ]} />
          <Seg value={groupBy} setValue={v => setGroupBy(v as typeof groupBy)} options={[
            { v: 'area', l: 'By area' }, { v: 'due', l: 'By due' }, { v: 'effort', l: 'By effort' },
          ]} />
        </div>
        {/* Slow Productivity status chips — only in Open mode */}
        {filter === 'open' && (
          <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
            {([
              { v: 'all',     l: 'All open'  },
              { v: 'active',  l: '⚡ Active'  },
              { v: 'someday', l: 'Someday'   },
              { v: 'backlog', l: 'Backlog'   },
            ] as const).map(chip => (
              <button
                key={chip.v}
                onClick={() => setStatusFilter(chip.v)}
                style={{
                  padding: '5px 12px', borderRadius: 20,
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.03em',
                  background: statusFilter === chip.v ? 'var(--ink)' : 'var(--paper-2)',
                  color: statusFilter === chip.v ? 'var(--paper)' : 'var(--ink-3)',
                  border: '1px solid', borderColor: statusFilter === chip.v ? 'var(--ink)' : 'var(--rule)',
                }}
              >
                {chip.l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grouped task list */}
      <div className="screen-scroll" style={{ padding: '16px 20px 32px' }} {...containerProps}>
        {/* Pull-to-refresh */}
        {isPulling && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: Math.round(pullRatio * 40), overflow: 'hidden', transition: 'height 0.1s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: '2px solid var(--rule)', borderTopColor: 'var(--accent)',
              opacity: pullRatio, transform: `rotate(${pullRatio * 360}deg)`,
            }} />
          </div>
        )}

        {groups.length === 0 ? (
          tasks?.length === 0 && !search ? (
            <div style={{ textAlign: 'center', padding: '64px 20px' }}>
              <div className="t-display t-italic" style={{ fontSize: 20, color: 'var(--ink-3)', marginBottom: 8 }}>
                No tasks yet.
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>
                Capture what's on your mind — one thing at a time.
              </div>
              <button onClick={() => onAddTask()} style={{
                padding: '11px 24px', borderRadius: 12,
                background: 'var(--ink)', color: 'var(--paper)',
                fontSize: 14, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Icons.plus size={16} /> Add first task
              </button>
            </div>
          ) : (
          <div style={{
            padding: '48px 0', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 18, color: 'var(--ink-3)',
          }}>
            Nothing matches.
          </div>
          )
        ) : (
          groups.map(group => {
            const I = group.icon ? (Icons[group.icon] ?? Icons.sparkle) : null
            return (
              <div key={group.key} style={{ marginBottom: 28 }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  paddingBottom: 6,
                  borderBottom: `2px solid ${group.hue !== undefined ? areaColor(group.hue, 'fg', isDark) : 'var(--rule)'}`,
                  marginBottom: 2,
                }}>
                  {I && <I size={13} stroke={group.hue !== undefined ? areaColor(group.hue, 'fg', isDark) : 'var(--ink-2)'} />}
                  <span className="t-display" style={{
                    fontSize: 18,
                    color: group.hue !== undefined ? areaColor(group.hue, 'fg', isDark) : 'var(--ink)',
                  }}>
                    {group.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--ink-3)', marginLeft: 'auto',
                  }}>
                    {group.items.filter(t => !t.done).length} open
                  </span>
                </div>

                {/* Task rows */}
                {group.items.map(task => {
                  const cat = cats.find(c => c.id === task.cat)
                  const taskHue = isColorful ? cat?.hue : undefined
                  const isExpanded = expandedIds.has(task.id)
                  const hasSubs = (task.sub?.length ?? 0) > 0
                  return (
                    <div key={task.id}>
                      <SwipeableRow
                        disabled={selectMode}
                        done={task.done}
                        onComplete={() => handleComplete({ stopPropagation: () => {}, target: document.body } as unknown as React.MouseEvent, task)}
                        onDelete={!selectMode ? () => deleteTask(task.id) : undefined}
                      >
                        <TaskCard
                          task={task}
                          areaName={groupBy !== 'area' ? cat?.name : undefined}
                          hue={taskHue}
                          selectMode={selectMode}
                          isSelected={selected.has(task.id)}
                          onTap={() => navigate({ name: 'task', taskId: task.id })}
                          onComplete={e => handleComplete(e, task)}
                          onDelete={!selectMode ? () => deleteTask(task.id) : undefined}
                          onToggleSelect={() => toggleSelect(task.id)}
                          onStatusChange={!selectMode ? (status) => updateTask(task.id, { status }) : undefined}
                          onToggleSubtasks={hasSubs && !selectMode ? () => toggleExpand(task.id) : undefined}
                          subtasksExpanded={isExpanded}
                        />
                      </SwipeableRow>
                      {isExpanded && hasSubs && (
                        <div style={{
                          marginLeft: 26, paddingLeft: 20,
                          borderLeft: `2px solid ${taskHue !== undefined ? areaColor(taskHue, 'bg', isDark) : 'var(--rule)'}`,
                          marginBottom: 4,
                        }}>
                          {task.sub.map((s, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 4px',
                              borderBottom: i < task.sub.length - 1 ? '1px solid var(--rule)' : 'none',
                              opacity: s.d ? 0.5 : 1,
                            }}>
                              <div style={{
                                width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                                border: `1.5px solid ${s.d ? (taskHue !== undefined ? areaColor(taskHue, 'fg', isDark) : 'var(--accent)') : 'var(--rule)'}`,
                                background: s.d ? (taskHue !== undefined ? areaColor(taskHue, 'fg', isDark) : 'var(--accent)') : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {s.d && <Icons.check size={8} sw={2.5} stroke="var(--paper)" />}
                              </div>
                              <span style={{
                                fontSize: 12, color: s.d ? 'var(--ink-3)' : 'var(--ink)',
                                textDecoration: s.d ? 'line-through' : 'none',
                              }}>
                                {s.t}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Inline add — only in open/all, area group, no select mode */}
                {!selectMode && filter !== 'done' && groupBy === 'area' && (
                  <GhostInput catId={group.key} onSaved={() => {}} />
                )}
              </div>
            )
          })
        )}

        {/* Global ghost input when group is not area */}
        {!selectMode && filter !== 'done' && groupBy !== 'area' && (
          <GhostInput catId="all" onSaved={() => {}} />
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}

      {nextBanner && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: 'white',
          padding: '8px 18px', borderRadius: 20,
          fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.04em',
          boxShadow: 'var(--shadow-pop)',
          zIndex: 200, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {nextBanner.text}
        </div>
      )}
    </div>
  )
}
