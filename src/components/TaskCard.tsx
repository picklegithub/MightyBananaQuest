import React from 'react'
import { Icons } from './ui/Icons'
import { EffortPip } from './ui'
import type { Task } from '../types'

// ── Priority dot colour map ───────────────────────────────────────────────────
const QUAD_COLOR: Record<string, string> = {
  q1: 'var(--warn)',      // Do — urgent + important
  q2: 'var(--accent)',    // Schedule — important
  q3: 'var(--ink-3)',     // Delegate
  q4: 'var(--ink-4)',     // Drop
}
const QUAD_LABEL: Record<string, string> = {
  q1: 'Do', q2: 'Plan', q3: 'Delegate', q4: 'Drop',
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
  const subProg = task.sub.length > 0
    ? subDone / task.sub.length
    : task.done ? 1 : 0

  const ringColor  = hue !== undefined ? `hsl(${hue}, 55%, 42%)` : 'var(--accent)'
  const borderColor = hue !== undefined ? `hsl(${hue}, 45%, 55%)` : 'var(--rule)'
  const showDue = task.due && task.due !== ''

  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
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
        {/* Title */}
        <div style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.35,
          textDecoration: task.done ? 'line-through' : 'none',
          color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>

        {/* Meta row */}
        <div style={{
          marginTop: 3,
          display: 'flex', alignItems: 'center', gap: 6,
          flexWrap: 'nowrap', overflow: 'hidden',
        }}>
          {/* Effort */}
          <EffortPip effort={task.effort} mono />

          {/* Separator dot */}
          {showDue && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />}

          {/* Due date */}
          {showDue && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: dueColor(task.due), flexShrink: 0, fontWeight: task.due === 'Today' ? 600 : 400,
            }}>
              {task.due}
            </span>
          )}

          {/* Priority pill — only show q1/q2 to keep it calm */}
          {(task.quad === 'q1' || task.quad === 'q2') && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.06em',
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
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.06em',
              color: 'var(--accent)', flexShrink: 0,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              Active
            </span>
          )}

          {/* Habit / recurring */}
          {(task.isHabit || task.recurring) && (
            <span style={{ color: task.isHabit ? 'var(--warn)' : 'var(--ink-4)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
              {task.isHabit ? <Icons.flame size={9} /> : <Icons.repeat size={9} />}
            </span>
          )}

          {/* Streak */}
          {task.streak > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--warn)', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {task.streak}
            </span>
          )}

          {/* Sub-task count */}
          {task.sub.length > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--ink-3)', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {subDone}/{task.sub.length}
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
      </div>

      {/* ── Right side ── */}
      {task.sub.length > 0 && <MiniRing progress={subProg} hue={hue} />}

      {/* Reschedule toggle (Calendar context) */}
      {onRescheduleToggle && (
        <button onClick={onRescheduleToggle} style={{ flexShrink: 0, padding: 4, color: 'var(--ink-4)' }}>
          <Icons.calendar size={13} />
        </button>
      )}

      {/* Area assign toggle */}
      {onAreaToggle && (
        <button onClick={onAreaToggle} style={{ flexShrink: 0, padding: 4, color: 'var(--ink-4)' }}>
          <Icons.folder size={13} />
        </button>
      )}

      {onDelete ? (
        <button onClick={onDelete} style={{ flexShrink: 0, padding: '4px', color: 'var(--ink-4)' }}>
          <Icons.close size={14} />
        </button>
      ) : !onAreaToggle && !onRescheduleToggle && task.sub.length === 0 && (
        <Icons.arrow size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      )}
    </button>
  )
}
