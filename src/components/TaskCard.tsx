import React from 'react'
import { Icons } from './ui/Icons'
import { EffortPip } from './ui'
import { formatTime, formatDueLabel } from '../lib/parseDue'
import type { Task } from '../types'

// ── Priority dot colour map ───────────────────────────────────────────────────
const QUAD_COLOR: Record<string, string> = {
  q1: 'var(--warn)',      // Do — urgent + important
  q2: 'var(--accent)',    // Schedule — important
  q3: 'var(--ink-3)',     // Delegate
  q4: 'var(--ink-4)',     // Drop
}
const QUAD_LABEL: Record<string, string> = {
  q1: 'Do', q2: 'Schedule', q3: 'Delegate', q4: 'Drop',
}

// ── Mini sub-task progress ring ───────────────────────────────────────────────
function MiniRing({ progress, hue }: { progress: number; hue?: number }) {
  const r = 8, c = 2 * Math.PI * r
  const stroke = hue !== undefined ? `hsl(${hue}, 55%, 42%)` : 'var(--accent)'
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
  if (due === 'Today')    return 'var(--accent)'
  if (due === 'Overdue')  return 'var(--warn)'
  if (due === 'Tomorrow') return 'var(--ink-2)'
  return 'var(--ink-3)'
}

function friendlyDue(due: string): string {
  if (!due) return ''
  if (due === 'Today' || due === 'Tomorrow' || due === 'Overdue') return due
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return formatDueLabel(due)
  return due
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
}

export function TaskCard({ task, onTap, onComplete, onDelete, hue, areaName, onAreaToggle, onRescheduleToggle }: Props) {
  const subDone = task.sub.filter(s => s.d).length
  const subTotal = task.sub.length
  const subProg = subTotal > 0 ? subDone / subTotal : (task.done ? 1 : 0)

  const ringColor   = hue !== undefined ? `hsl(${hue}, 55%, 42%)` : 'var(--accent)'
  const borderColor = hue !== undefined ? `hsl(${hue}, 45%, 55%)` : 'var(--rule)'
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
    <button
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '11px 14px 11px 12px',
        background: 'var(--paper-2)',
        borderRadius: 12,
        border: '1px solid var(--rule)',
        borderLeft: hue !== undefined ? `3px solid ${ringColor}` : '1px solid var(--rule)',
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
          {task.isHabit && <span style={{ color: 'var(--warn)', marginRight: 4, fontSize: 11 }}>🔥</span>}
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

          {/* Priority — only show q1/q2 */}
          {(task.quad === 'q1' || task.quad === 'q2') && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: QUAD_COLOR[task.quad], flexShrink: 0,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: QUAD_COLOR[task.quad], flexShrink: 0 }} />
              {QUAD_LABEL[task.quad]}
            </span>
          )}

          {/* Active status dot */}
          {task.status === 'active' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: 'var(--accent)', flexShrink: 0,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              Active
            </span>
          )}

          {/* Area label (cross-area views) */}
          {areaName && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
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
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.05em',
                color: 'var(--ink-4)', flexShrink: 0,
              }}>
                <Icons.repeat size={9} /> {task.recurring}
              </span>
            )}

            {/* Sub-task count with progress */}
            {subTotal > 0 && (
              <>
                {hasRepeat && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.05em',
                  color: subDone === subTotal ? ringColor : 'var(--ink-3)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  <Icons.check size={9} sw={2} />
                  {subDone}/{subTotal} subtasks
                </span>
              </>
            )}

            {/* Streak */}
            {task.streak > 0 && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  fontFamily: 'var(--font-mono)', fontSize: 9,
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

        {onDelete ? (
          <button onClick={onDelete} style={{ padding: '4px', color: 'var(--ink-4)' }}>
            <Icons.close size={14} />
          </button>
        ) : !onAreaToggle && !onRescheduleToggle && (
          <Icons.arrow size={14} style={{ color: 'var(--ink-4)' }} />
        )}
      </div>
    </button>
  )
}
