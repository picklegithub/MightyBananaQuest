import React from 'react'
import { Icons } from './ui/Icons'
import { EffortPip } from './ui'
import { formatTime, formatDueLabel, isDueToday, isDueTomorrow } from '../lib/parseDue'
import { useTaskSyncState } from '../hooks/useTaskSyncState'
import type { Task } from '../types'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'


// ── Mini sub-task progress ring ───────────────────────────────────────────────
function MiniRing({ progress, hue }: { progress: number; hue?: number }) {
  const isDark = useIsDark()
  const r = 8, c = 2 * Math.PI * r
  const stroke = hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--accent)'
  return (
    <svg width={20} height={20} style={{ flexShrink: 0 }}>
      <circle cx={10} cy={10} r={r} fill="none" stroke="var(--rule)" strokeWidth={2} />
      <circle cx={10} cy={10} r={r} fill="none" stroke={stroke} strokeWidth={2}
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
        strokeLinecap="round" transform="rotate(-90 10 10)" />
    </svg>
  )
}

// ── Due label formatting ──────────────────────────────────────────────────────
function dueColor(due: string): string {
  if (isDueToday(due))    return 'var(--accent)'
  if (due === 'Overdue')  return 'var(--warn)'
  if (isDueTomorrow(due)) return 'var(--ink-2)'
  return 'var(--ink-3)'
}

function friendlyDue(due: string): string {
  if (!due) return ''
  if (due === 'Overdue') return due
  return formatDueLabel(due)
}

// ── TaskCard ──────────────────────────────────────────────────────────────────
interface Props {
  task: Task
  onTap: () => void
  onComplete: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
  /** Area hue (0–360) — enables colored left border + completion ring tint */
  hue?: number
  /** Area name displayed as a small label; useful in cross-area list views */
  areaName?: string
  /** Show area-assign toggle button (AllTasks / Calendar contexts) */
  onAreaToggle?: (e: React.MouseEvent) => void
  /** Show reschedule toggle button (Calendar context) */
  onRescheduleToggle?: (e: React.MouseEvent) => void
  /** Subtask expand/collapse toggle — when provided shows a chevron next to subtask count */
  onToggleSubtasks?: () => void
  subtasksExpanded?: boolean
  /** AllTasks: 1-tap status promote/demote pill */
  onStatusChange?: (status: 'active' | 'backlog') => void
  /** AllTasks: select mode — shows checkbox, suppresses tap-to-open */
  selectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
}

export function TaskCard({ task, onTap, onComplete, onDelete, hue, areaName, onAreaToggle, onRescheduleToggle, onToggleSubtasks, subtasksExpanded, onStatusChange, selectMode, isSelected, onToggleSelect }: Props) {
  const syncStatus = useTaskSyncState(task.id)
  const isDark   = useIsDark()
  const subDone = task.sub.filter(s => s.d).length
  const subTotal = task.sub.length
  const subProg = subTotal > 0 ? subDone / subTotal : (task.done ? 1 : 0)

  const ringColor   = hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--accent)'
  const borderColor = hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--rule)'
  const leftBorder  = task.done
    ? '3px solid var(--rule)'
    : task.status === 'someday'
      ? '3px dashed var(--rule)'
      : hue !== undefined
        ? `3px solid ${ringColor}`
        : task.status === 'active'
          ? '3px solid var(--accent)'
          : '3px solid var(--rule)'
  const showDue     = task.due && task.due !== ''
  const dueLabel    = showDue ? friendlyDue(task.due) : ''
  const timeLabel   = task.time ? formatTime(task.time) : null
  const hasNotes    = !!(task.notes && task.notes.trim())
  const hasRepeat   = !!(task.recurring)

  // Truncate notes to a single short line
  const notePreview = hasNotes
    ? (task.notes!.replace(/\n/g, ' ').slice(0, 72) + (task.notes!.length > 72 ? '…' : ''))
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Select mode checkbox */}
      {selectMode && (
        <button
          onClick={onToggleSelect}
          style={{
            flexShrink: 0, width: 20, height: 20, borderRadius: 5,
            border: `2px solid ${isSelected ? 'var(--ink)' : 'var(--rule)'}`,
            background: isSelected ? 'var(--ink)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isSelected && <Icons.check size={11} sw={3} stroke="var(--paper)" />}
        </button>
      )}
    <button
      onClick={selectMode ? onToggleSelect : onTap}
      style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '11px 14px 11px 12px',
        background: 'var(--paper-2)',
        borderRadius: 12,
        border: '1px solid var(--rule)',
        borderLeft: leftBorder,
        textAlign: 'left', width: '100%',
        opacity: task.done ? 0.52 : 1,
        transition: 'opacity .15s',
      }}
    >
      {/* ── Complete circle ── */}
      <button
        onClick={onComplete}
        style={{
          flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
          marginTop: 1,
          border: `1.5px solid ${task.done ? ringColor : borderColor}`,
          background: task.done ? ringColor : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: task.done ? 'var(--paper)' : 'transparent',
          transition: 'all .15s',
        }}
      >
        {task.done && <Icons.check size={11} sw={2.5} />}
      </button>

      {/* ── Content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Title row */}
        <div style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.35,
          textDecoration: task.done ? 'line-through' : 'none',
          color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>

        {/* Primary meta row — effort, due, priority */}
        <div style={{
          marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 6,
          flexWrap: 'wrap',
        }}>
          {/* Effort */}
          <EffortPip effort={task.effort} mono />

          {/* Due date */}
          {showDue && (
            <>
              <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                color: dueColor(task.due), flexShrink: 0, fontWeight: task.due === 'Today' ? 600 : 400,
              }}>
                {dueLabel}
              </span>
            </>
          )}

          {/* Due time */}
          {timeLabel && (
            <>
              <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                color: 'var(--ink-3)', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
                <Icons.timer size={9} /> {timeLabel}
              </span>
            </>
          )}

          {/* Active status dot */}
          {task.status === 'active' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
              color: 'var(--accent)', flexShrink: 0,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              Active
            </span>
          )}

          {/* Area label (cross-area views) */}
          {areaName && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--ink-4)', letterSpacing: '0.04em',
              flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {areaName}
            </span>
          )}
        </div>

        {/* Secondary meta row — repeat, sub-tasks, streak */}
        {(hasRepeat || subTotal > 0 || (task.streak > 0)) && (
          <div style={{
            marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 6,
            flexWrap: 'wrap',
          }}>
            {/* Repeat */}
            {hasRepeat && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                color: 'var(--ink-4)', flexShrink: 0,
              }}>
                <Icons.repeat size={9} /> {task.recurring}
              </span>
            )}

            {/* Sub-task count with progress */}
            {subTotal > 0 && (
              <>
                {hasRepeat && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />}
                <span
                  onClick={onToggleSubtasks ? (e) => { e.stopPropagation(); onToggleSubtasks() } : undefined}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                    color: subDone === subTotal ? ringColor : 'var(--ink-3)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 3,
                    cursor: onToggleSubtasks ? 'pointer' : 'default',
                  }}
                >
                  <Icons.check size={9} sw={2} />
                  {subDone}/{subTotal} subtasks
                  {onToggleSubtasks && (
                    <span style={{ opacity: 0.5, fontSize: 8, lineHeight: 1 }}>
                      {subtasksExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </span>
              </>
            )}

            {/* Streak */}
            {task.streak > 0 && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--warn)', letterSpacing: '0.05em', flexShrink: 0,
                }}>
                  <Icons.flame size={9} /> {task.streak}d
                </span>
              </>
            )}
          </div>
        )}

        {/* Notes preview */}
        {notePreview && (
          <div style={{
            marginTop: 5,
            fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.4,
            color: 'var(--ink-4)', letterSpacing: '0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {notePreview}
          </div>
        )}
      </div>

      {/* ── Right side ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {/* E-3 sync state indicator */}
        {syncStatus === 'pending' && (
          <span
            title="Waiting to sync"
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#F59E0B', flexShrink: 0,
              animation: 'syncPulse 1.8s ease-in-out infinite',
            }}
          />
        )}
        {syncStatus === 'failed' && (
          <span
            title="Sync failed — open sync panel to retry"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
              color: 'var(--warn)',
              border: '1px solid var(--warn)',
              borderRadius: 3, padding: '1px 4px', flexShrink: 0,
            }}
          >
            ↺
          </span>
        )}
        {subTotal > 0 && <MiniRing progress={subProg} hue={hue} />}

        {/* Reschedule toggle (Calendar context) */}
        {onRescheduleToggle && (
          <button onClick={onRescheduleToggle} style={{ padding: 4, color: 'var(--ink-4)' }}>
            <Icons.calendar size={13} />
          </button>
        )}

        {/* Area assign toggle */}
        {onAreaToggle && (
          <button onClick={onAreaToggle} style={{ padding: 4, color: 'var(--ink-4)' }}>
            <Icons.folder size={13} />
          </button>
        )}

        {/* Status pill — promote backlog→active or demote active→backlog */}
        {!task.done && onStatusChange && (task.status === 'backlog' || !task.status) && (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange('active') }}
            title="Set active"
            style={{
              flexShrink: 0, fontSize: 11, fontFamily: 'var(--font-mono)',
              padding: '3px 7px', borderRadius: 99,
              border: '1px solid var(--rule)', background: 'transparent',
              color: 'var(--ink-3)', letterSpacing: '0.04em',
            }}
          >↑</button>
        )}
        {!task.done && onStatusChange && task.status === 'active' && (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange('backlog') }}
            title="Move to backlog"
            style={{
              flexShrink: 0, fontSize: 11, fontFamily: 'var(--font-mono)',
              padding: '3px 7px', borderRadius: 99,
              border: '1px solid var(--ink-3)', background: 'var(--ink)',
              color: 'var(--paper)', letterSpacing: '0.04em',
            }}
          >●</button>
        )}

        {onDelete ? (
          <button onClick={onDelete} style={{ padding: '4px', color: 'var(--ink-4)' }}>
            <Icons.close size={14} />
          </button>
        ) : !onAreaToggle && !onRescheduleToggle && !onStatusChange && (
          <Icons.arrow size={14} style={{ color: 'var(--ink-4)' }} />
        )}
      </div>
    </button>
    </div>
  )
}
