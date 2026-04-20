import React from 'react'
import { Icons } from './ui/Icons'
import { EffortPip } from './ui'
import type { Task } from '../types'

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
}

export function TaskCard({ task, onTap, onComplete, onDelete, hue, areaName }: Props) {
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
          marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 7,
          flexWrap: 'nowrap', overflow: 'hidden',
        }}>
          <EffortPip effort={task.effort} mono />

          {showDue && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: dueColor(task.due), flexShrink: 0,
            }}>
              {task.due}
            </span>
          )}

          {task.recurring && (
            <span style={{ color: 'var(--ink-4)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Icons.repeat size={9} />
            </span>
          )}

          {task.streak > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 2,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--warn)', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              <Icons.flame size={9} />
              {task.streak}
            </span>
          )}

          {task.sub.length > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--ink-3)', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {subDone}/{task.sub.length}
            </span>
          )}

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

      {/* ── Right side: sub ring, delete, or arrow ── */}
      {task.sub.length > 0 && (
        <MiniRing progress={subProg} hue={hue} />
      )}
      {onDelete ? (
        <button
          onClick={onDelete}
          style={{ flexShrink: 0, padding: '4px', color: 'var(--ink-4)' }}
        >
          <Icons.close size={14} />
        </button>
      ) : task.sub.length === 0 && (
        <Icons.arrow size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      )}
    </button>
  )
}
