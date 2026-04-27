import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, completeTask, deleteTask, deleteTasks, updateTask } from '../data/db'
import { DEFAULT_CATEGORIES, EFFORT, EFFORT_ORDER } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst, Seg } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { SwipeableRow } from '../components/SwipeableRow'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { triggerSync } from '../components/SyncStatusBar'
import type { Screen, Task } from '../types'

interface Props { navigate: (s: Screen) => void; back: () => void; onAddTask?: () => void }
interface Burst { id: number; x: number; y: number; xp: number }

// ── Compact task row (6.1 design) ─────────────────────────────────────────────
function CompactTaskRow({
  task, areaName, hue, selectMode, isSelected,
  onTap, onComplete, onDelete, onToggleSelect,
  isExpanded, onToggleExpand,
}: {
  task: Task
  areaName?: string
  hue?: number
  selectMode: boolean
  isSelected: boolean
  onTap: () => void
  onComplete: (e: React.MouseEvent) => void
  onDelete: () => void
  onToggleSelect: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
}) {
  const e = EFFORT[task.effort]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {selectMode && (
        <button onClick={onToggleSelect} style={{
          flexShrink: 0, width: 20, height: 20, borderRadius: 5,
          border: `2px solid ${isSelected ? 'var(--ink)' : 'var(--rule)'}`,
          background: isSelected ? 'var(--ink)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <Icons.check size={11} sw={3} stroke="var(--paper)" />}
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <SwipeableRow
          disabled={selectMode || task.done}
          onComplete={() => onComplete({ stopPropagation: () => {}, target: document.body } as unknown as React.MouseEvent)}
          onDelete={!selectMode ? onDelete : undefined}
        >
          <div
            onClick={selectMode ? onToggleSelect : onTap}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0',
              borderBottom: '1px solid var(--rule)',
              cursor: 'pointer',
              opacity: task.done ? 0.45 : 1,
            }}
          >
            {/* Complete button */}
            <button
              onClick={e => { e.stopPropagation(); if (!selectMode) onComplete(e) }}
              style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                border: `1.5px solid ${task.done ? 'var(--accent)' : 'var(--ink-3)'}`,
                background: task.done ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {task.done && <Icons.check size={10} sw={2.5} stroke="var(--paper)" />}
            </button>

            {/* Title + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500,
                textDecoration: task.done ? 'line-through' : 'none',
                color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {task.title}
              </div>
              <div style={{
                display: 'flex', gap: 6, marginTop: 2,
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                flexWrap: 'wrap',
              }}>
                {areaName && <span>{areaName}</span>}
                {areaName && <span style={{ opacity: 0.4 }}>·</span>}
                <span>{e?.label ?? 'Medium'}</span>
                {task.recurring && (
                  <><span style={{ opacity: 0.4 }}>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icons.repeat size={9} /> {task.recurring}</span></>
                )}
                {task.streak > 0 && (
                  <><span style={{ opacity: 0.4 }}>·</span><span style={{ color: 'var(--accent)' }}>{task.streak}d</span></>
                )}
                {(task.sub?.length ?? 0) > 0 && (
                  <><span style={{ opacity: 0.4 }}>·</span>
                  <span
                    onClick={onToggleExpand ? (e) => { e.stopPropagation(); onToggleExpand() } : undefined}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      cursor: onToggleExpand ? 'pointer' : 'default',
                      color: task.sub.filter(s => s.d).length === task.sub.length
                        ? (hue !== undefined ? `hsl(${hue}, 55%, 42%)` : 'var(--accent)')
                        : 'var(--ink-3)',
                    }}
                  >
                    <Icons.check size={9} sw={2} />
                    {task.sub.filter(s => s.d).length}/{task.sub.length}
                    {onToggleExpand && <span style={{ opacity: 0.5, fontSize: 8 }}>{isExpanded ? '▲' : '▼'}</span>}
                  </span></>
                )}
              </div>
              {task.notes && (
                <div style={{
                  fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)',
                  marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {task.notes.replace(/\n/g, ' ').slice(0, 80)}{task.notes.length > 80 ? '…' : ''}
                </div>
              )}
            </div>

            {/* Due */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, flexShrink: 0,
              color: task.quad === 'q1' ? 'var(--warn)' : 'var(--ink-3)',
            }}>
              {task.due}
            </span>
          </div>
        </SwipeableRow>
      </div>
    </div>
  )
}

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
      id: `t${Date.now()}`,
      title: t,
      cat: catId === 'all' ? 'inbox' : catId,
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
          width: '100%', padding: '9px 0',
          color: 'var(--ink-4)', fontSize: 13,
          fontFamily: 'var(--font-ui)',
          borderTop: '1px dashed var(--rule)',
          marginTop: 2,
        }}
      >
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '1.5px dashed var(--rule)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-4)', flexShrink: 0,
        }}>
          <Icons.plus size={10} />
        </span>
        New task…
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 6 }}>
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
          border: '2px solid var(--accent)',
          background: 'var(--paper-2)', fontSize: 14, color: 'var(--ink)',
          outline: 'none',
        }}
      />
      <button onClick={handleSave} disabled={!value.trim()} style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: value.trim() ? 'var(--ink)' : 'var(--paper-3)',
        color: value.trim() ? 'var(--paper)' : 'var(--ink-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icons.check size={14} sw={2.5} />
      </button>
      <button onClick={() => { setValue(''); setActive(false) }} style={{
        width: 38, height: 38, borderRadius: 10, color: 'var(--ink-3)',
        border: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <Icons.close size={14} />
      </button>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const AllTasksScreen = ({ navigate, back, onAddTask }: Props) => {
  const [filter,    setFilter]    = useState<'open' | 'all' | 'done'>('open')
  const [groupBy,   setGroupBy]   = useState<'area' | 'due' | 'effort'>('due')
  const [search,    setSearch]    = useState('')
  const [bursts,    setBursts]    = useState<Burst[]>([])
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

  const { pullRatio, isPulling, containerProps } = usePullToRefresh(triggerSync, 72)

  if (!tasks) return null

  // Filter tasks
  const filtered = tasks
    .filter(t => filter === 'all' ? true : filter === 'open' ? !t.done : t.done)
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
      hue: c.hue,
      items: filtered.filter(t => t.cat === c.id),
    })).filter(g => g.items.length > 0)
    // Inbox bucket
    const inboxItems = filtered.filter(t => !cats.find(c => c.id === t.cat))
    if (inboxItems.length > 0) groups.push({ key: 'inbox', label: 'Inbox', icon: 'inbox', items: inboxItems })
  } else if (groupBy === 'due') {
    const buckets: Record<string, Task[]> = { Today: [], Tomorrow: [], 'This week': [], Later: [] }
    filtered.forEach(t => {
      if (t.due === 'Today') buckets['Today'].push(t)
      else if (t.due === 'Tomorrow') buckets['Tomorrow'].push(t)
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
    if (task.done) return
    const gained = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setBursts(b => [...b, { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }])
      setTimeout(() => setBursts(b => b.slice(1)), 1400)
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 10px', flexShrink: 0 }}>
        <button onClick={() => selectMode ? exitSelectMode() : back()} style={{ color: 'var(--ink-2)' }}>
          {selectMode
            ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cancel</span>
            : <Icons.back size={20} />}
        </button>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">All tasks · everything in one place</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 }}>
            <h1 className="t-display" style={{ fontSize: 32, margin: 0 }}>
              {selectMode ? `${selected.size} selected` : <em>Everything</em>}.
            </h1>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {filtered.length} of {tasks.length}
            </span>
          </div>
        </div>
        {selectMode ? (
          <button onClick={handleBulkDelete} disabled={selected.size === 0} style={{
            padding: '7px 14px', borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 11,
            background: selected.size > 0 ? 'var(--warn-soft)' : 'var(--paper-3)',
            color: selected.size > 0 ? 'var(--warn)' : 'var(--ink-4)',
            border: '1px solid', borderColor: selected.size > 0 ? 'var(--warn-soft)' : 'transparent',
          }}>
            Delete {selected.size > 0 ? selected.size : ''}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ThemeToggle />
            <button onClick={() => setSelectMode(true)} style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em' }}>
              Select
            </button>
          </div>
        )}
      </div>

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
      <div style={{
        padding: '0 20px 10px', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, flexWrap: 'wrap',
        borderBottom: '1px solid var(--rule)',
      }}>
        <Seg value={filter} setValue={v => setFilter(v as typeof filter)} options={[
          { v: 'open', l: 'Open' }, { v: 'all', l: 'All' }, { v: 'done', l: 'Done' },
        ]} />
        <Seg value={groupBy} setValue={v => setGroupBy(v as typeof groupBy)} options={[
          { v: 'area', l: 'By area' }, { v: 'due', l: 'By due' }, { v: 'effort', l: 'By effort' },
        ]} />
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
          <div style={{
            padding: '48px 0', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 18, color: 'var(--ink-3)',
          }}>
            Nothing matches.
          </div>
        ) : (
          groups.map(group => {
            const I = group.icon ? (Icons[group.icon] ?? Icons.sparkle) : null
            return (
              <div key={group.key} style={{ marginBottom: 28 }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  paddingBottom: 6,
                  borderBottom: `2px solid ${group.hue !== undefined ? `hsl(${group.hue},45%,75%)` : 'var(--rule)'}`,
                  marginBottom: 2,
                }}>
                  {I && <I size={13} stroke={group.hue !== undefined ? `hsl(${group.hue},50%,42%)` : 'var(--ink-2)'} />}
                  <span className="t-display" style={{
                    fontSize: 18,
                    color: group.hue !== undefined ? `hsl(${group.hue},50%,35%)` : 'var(--ink)',
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
                  const taskHue = cat?.hue
                  const isExpanded = expandedIds.has(task.id)
                  const hasSubs = (task.sub?.length ?? 0) > 0
                  return (
                    <div key={task.id}>
                      <CompactTaskRow
                        task={task}
                        areaName={groupBy !== 'area' ? (cat?.name) : undefined}
                        hue={taskHue}
                        selectMode={selectMode}
                        isSelected={selected.has(task.id)}
                        onTap={() => navigate({ name: 'task', taskId: task.id })}
                        onComplete={e => handleComplete(e, task)}
                        onDelete={() => deleteTask(task.id)}
                        onToggleSelect={() => toggleSelect(task.id)}
                        isExpanded={isExpanded}
                        onToggleExpand={hasSubs && !selectMode ? () => toggleExpand(task.id) : undefined}
                      />
                      {isExpanded && hasSubs && (
                        <div style={{
                          marginLeft: 26, paddingLeft: 20,
                          borderLeft: `2px solid ${taskHue !== undefined ? `hsl(${taskHue}, 40%, 80%)` : 'var(--rule)'}`,
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
                                border: `1.5px solid ${s.d ? (taskHue !== undefined ? `hsl(${taskHue}, 55%, 42%)` : 'var(--accent)') : 'var(--rule)'}`,
                                background: s.d ? (taskHue !== undefined ? `hsl(${taskHue}, 55%, 42%)` : 'var(--accent)') : 'transparent',
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
    </div>
  )
}
