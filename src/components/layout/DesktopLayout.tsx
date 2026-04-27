import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, completeTask, toggleSubTask } from '../../data/db'
import { Icons } from '../ui/Icons'
import { EFFORT, EFFORT_ORDER, QUAD } from '../../constants'
import { EffortPip, Chip } from '../ui'
import { AddTaskSheet } from '../AddTaskSheet'
import { BottomNav } from './BottomNav'
import { ThemeToggle } from '../ThemeToggle'
import { TaskDetailScreen } from '../../screens/TaskDetailScreen'
import { JournalScreen } from '../../screens/JournalScreen'
import { GoalsScreen } from '../../screens/GoalsScreen'
import { CalendarScreen } from '../../screens/CalendarScreen'
import { ProgressScreen } from '../../screens/ProgressScreen'
import { WeeklyReviewScreen } from '../../screens/WeeklyReviewScreen'
import { InboxScreen } from '../../screens/InboxScreen'
import { SettingsScreen } from '../../screens/SettingsScreen'
import { AllTasksScreen } from '../../screens/AllTasksScreen'
import type { Task, Category, Screen } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────
type DesktopTab = 'dashboard' | 'journal' | 'goals' | 'calendar' | 'inbox' | 'all-tasks' | 'progress' | 'review' | 'settings'

interface Props {
  onLogout: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const now      = new Date()
const DAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]
const DATE_STR = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good morning.'
  if (h >= 12 && h < 17) return 'Good afternoon.'
  if (h >= 17 && h < 21) return 'Good evening.'
  return 'Good night.'
}

// Pomodoro ring SVG
function PomRing({ pct, mm, ss, size = 90 }: { pct: number; mm: string; ss: string; size?: number }) {
  const r    = size / 2 - 6
  const circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={2} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--accent-soft)" strokeWidth={2.5} fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: size === 90 ? 20 : 52,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {size === 90 ? `${mm}:${ss}` : <><span>{mm}</span><span style={{ opacity: 0.4 }}>:</span><span>{ss}</span></>}
      </div>
    </div>
  )
}

// ── Desktop task row ──────────────────────────────────────────────────────────
function DesktopRow({
  task, cats, isSelected, onSelect, onComplete,
}: {
  task: Task
  cats: Category[]
  isSelected: boolean
  onSelect: () => void
  onComplete: () => void
}) {
  const cat = cats.find(c => c.id === task.cat)
  const I   = cat ? (Icons[cat.icon] ?? Icons.sparkle) : Icons.sparkle
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', borderRadius: 8, cursor: 'pointer', marginTop: 2,
        background: isSelected ? 'var(--paper-3)' : 'transparent',
        opacity: task.done ? 0.45 : 1, transition: 'background .12s',
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onComplete() }}
        style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${task.done ? 'var(--accent)' : 'var(--ink-3)'}`,
          background: task.done ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.done && <Icons.check size={10} sw={2.5} stroke="var(--paper)" />}
      </button>

      <I size={13} stroke="var(--ink-3)" />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, textDecoration: task.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title}
        </div>
      </div>

      {task.recurring && (
        <Icons.repeat size={11} stroke="var(--ink-3)" />
      )}
      {task.streak > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          <Icons.flame size={10} />{task.streak}
        </span>
      )}
      <span style={{ fontSize: 10, color: task.quad === 'q1' ? 'var(--warn)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', width: 64, textAlign: 'right', flexShrink: 0 }}>
        {task.due}
      </span>
      <EffortPip effort={task.effort} mono />
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  task, cats, settings, onFocus,
}: {
  task: Task
  cats: Category[]
  settings: { xp: number; streak: number } | null
  onFocus: () => void
}) {
  const cat  = cats.find(c => c.id === task.cat)
  const I    = cat ? (Icons[cat.icon] ?? Icons.sparkle) : Icons.sparkle
  const e    = EFFORT[task.effort]
  const subs = task.sub ?? []

  // Compact pomodoro
  const totalSecs = (task.pomodoroMins ?? 25) * 60
  const [secs, setSecs]       = useState(totalSecs)
  const [running, setRunning] = useState(false)
  const pct = ((totalSecs - secs) / totalSecs) * 100
  const mm  = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss  = String(secs % 60).padStart(2, '0')

  useEffect(() => { setSecs(totalSecs); setRunning(false) }, [task.id, totalSecs])
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running])
  useEffect(() => { if (secs === 0) setRunning(false) }, [secs])

  const subDone = subs.filter(s => s.d).length

  return (
    <div style={{ padding: '24px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}
      className="no-scrollbar">

      {/* Eyebrow */}
      <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <I size={11} /> {cat?.name ?? 'Task'}{task.recurring ? ` · ${task.recurring}` : ''}
      </div>

      {/* Title */}
      <div className="t-display" style={{ fontSize: 24, lineHeight: 1.15, marginBottom: 14 }}>
        {task.title}
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        <Chip>{task.ctx}</Chip>
        <Chip>{e?.label ?? 'Medium'}</Chip>
        <Chip warn={task.quad === 'q1'}>Due {task.due}</Chip>
        {task.streak > 0 && <Chip accent><Icons.flame size={10} /> {task.streak}d streak</Chip>}
      </div>

      {/* Compact Pomodoro */}
      <div style={{ padding: 18, borderRadius: 14, background: 'var(--ink)', color: 'var(--paper)', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <PomRing pct={pct} mm={mm} ss={ss} size={90} />
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>Focus</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
              {task.pomodoroMins ?? 25}min · +{e?.xp ?? 0} XP
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setRunning(r => !r)} style={{
                padding: '6px 14px', borderRadius: 999, background: 'var(--paper)', color: 'var(--ink)',
                fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {running ? <Icons.pause size={12} /> : <Icons.play size={12} />}
                {running ? 'Pause' : (secs === totalSecs ? 'Start' : 'Resume')}
              </button>
              <button onClick={() => { setSecs(totalSecs); setRunning(false) }} style={{
                padding: '6px 10px', borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.2)', color: 'var(--paper)', fontSize: 12,
              }}>
                <Icons.reset size={12} />
              </button>
            </div>
          </div>
        </div>
        <button onClick={onFocus} style={{
          width: '100%', marginTop: 14, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.55)', textAlign: 'center',
        }}>
          OPEN FOCUS MODE →
        </button>
      </div>

      {/* Sub-tasks */}
      {subs.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="eyebrow">Steps</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              {subDone}/{subs.length}
            </span>
          </div>
          {subs.map((s, i) => (
            <div key={i} onClick={() => toggleSubTask(task.id, i)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
              borderBottom: '1px solid var(--rule)', cursor: 'pointer',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                border: `1.5px solid ${s.d ? 'var(--accent)' : 'var(--ink-3)'}`,
                background: s.d ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.d && <Icons.check size={9} sw={2.5} stroke="var(--paper)" />}
              </div>
              <div style={{ fontSize: 13, color: s.d ? 'var(--ink-3)' : 'var(--ink)', textDecoration: s.d ? 'line-through' : 'none' }}>
                {s.t}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Priority matrix */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Priority</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(['q1','q2','q3','q4'] as const).map(q => (
            <div key={q} style={{
              padding: '10px 12px', borderRadius: 8,
              background: q === task.quad ? 'var(--ink)' : 'var(--paper-2)',
              color:      q === task.quad ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid', borderColor: q === task.quad ? 'var(--ink)' : 'var(--rule)',
              fontFamily: 'var(--font-display)', fontSize: 13, fontStyle: 'italic',
            }}>
              {QUAD[q].short}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Focus mode ────────────────────────────────────────────────────────────────
const PHASES = {
  work:  { label: 'Focus',       color: 'var(--accent)' },
  short: { label: 'Short break', color: 'oklch(0.78 0.10 200)' },
  long:  { label: 'Long break',  color: 'oklch(0.78 0.10 280)' },
}

function FocusMode({
  task, cats, settings, onExit,
}: {
  task: Task
  cats: Category[]
  settings: { xp: number; streak: number } | null
  onExit: () => void
}) {
  const cat      = cats.find(c => c.id === task.cat)
  const catHue   = cat?.hue ?? 200
  const e        = EFFORT[task.effort]

  const [phase, setPhase]       = useState<'work' | 'short' | 'long'>('work')
  const [mins,  setMins]        = useState(task.pomodoroMins ?? 25)
  const [running, setRunning]   = useState(false)
  const [secs, setSecs]         = useState((task.pomodoroMins ?? 25) * 60)
  const [sessions, setSessions] = useState(0)
  const [localSubs, setLocalSubs] = useState(task.sub ?? [])

  const totalSecs = (phase === 'work' ? mins : phase === 'short' ? 5 : 15) * 60
  const elapsed   = totalSecs - secs
  const pct       = elapsed / totalSecs
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  const R    = 118
  const CIRC = 2 * Math.PI * R
  const color = PHASES[phase].color
  const cyclePos = sessions % 4 === 0 && sessions > 0 ? 4 : sessions % 4

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSecs(s => {
      if (s <= 1) {
        setRunning(false)
        if (phase === 'work') setSessions(n => n + 1)
        return 0
      }
      return s - 1
    }), 1000)
    return () => clearInterval(id)
  }, [running, phase])

  function switchPhase(p: typeof phase) {
    setPhase(p)
    setRunning(false)
    setSecs((p === 'work' ? mins : p === 'short' ? 5 : 15) * 60)
  }

  function resetDuration(m: number) {
    setMins(m)
    if (phase === 'work') { setSecs(m * 60); setRunning(false) }
  }

  function toggleSub(i: number) {
    setLocalSubs(subs => subs.map((s, idx) => idx === i ? { ...s, d: !s.d } : s))
    toggleSubTask(task.id, i)
  }

  const subDone = localSubs.filter(s => s.d).length
  const subPct  = localSubs.length ? subDone / localSubs.length : 0

  // Dark-mode vars scoped to focus surface
  const dark: React.CSSProperties = {
    '--df-bg':          'oklch(0.16 0.008 80)',
    '--df-bg-2':        'oklch(0.19 0.010 80)',
    '--df-bg-3':        'oklch(0.23 0.012 80)',
    '--df-ink':         'oklch(0.95 0.008 85)',
    '--df-ink-2':       'oklch(0.78 0.006 85)',
    '--df-ink-3':       'oklch(0.58 0.006 85)',
    '--df-ink-4':       'oklch(0.45 0.006 85)',
    '--df-rule':        'oklch(0.28 0.010 80)',
    '--df-rule-2':      'oklch(0.36 0.010 80)',
    '--df-accent':      'oklch(0.80 0.11 145)',
    '--df-accent-soft': 'oklch(0.32 0.06 145)',
    '--df-warn':        'oklch(0.72 0.14 50)',
  } as React.CSSProperties

  const I = cat ? (Icons[cat.icon] ?? Icons.sparkle) : Icons.sparkle

  return (
    <div style={{ ...dark, display: 'flex', height: '100%', background: 'var(--df-bg)', color: 'var(--df-ink)', fontFamily: 'var(--font-ui)' }}>

      {/* Left — task detail */}
      <div style={{ flex: '1 1 56%', minWidth: 0, padding: '28px 32px 40px', overflowY: 'auto', borderRight: '1px solid var(--df-rule)' }} className="no-scrollbar">

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--df-ink-4)', textTransform: 'uppercase', flex: 1 }}>
            <I size={11} style={{ marginRight: 6 }} />
            {cat?.name ?? 'Task'} › Task · due {task.due}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--df-warn)', fontFamily: 'var(--font-mono)' }}>
            <Icons.flame size={11} /> {settings?.streak ?? 0} days
          </span>
          <button onClick={onExit} style={{
            padding: '6px 12px', borderRadius: 7,
            background: 'var(--df-bg-3)', color: 'var(--df-ink-2)',
            border: '1px solid var(--df-rule-2)', fontSize: 11,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icons.close size={11} /> Exit focus
          </button>
        </div>

        {/* Title */}
        <h1 className="t-display" style={{ fontSize: 34, margin: '0 0 16px', lineHeight: 1.08, color: 'var(--df-ink)', fontStyle: 'italic' }}>
          {task.title}
        </h1>

        {/* Chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
          {[
            cat?.name ?? 'Task',
            `${e?.label ?? 'Medium'} · ${e ? (e.mins >= 60 ? `${e.mins/60}h` : `${e.mins}m`) : ''}`,
            QUAD[task.quad]?.short ?? 'Schedule',
            `Due ${task.due}`,
          ].map((label, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 999,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: 'var(--df-bg-2)', color: 'var(--df-ink-2)',
              border: '1px solid var(--df-rule)',
            }}>
              {i === 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: `hsl(${catHue}, 55%, 62%)` }} />}
              {label}
            </span>
          ))}
        </div>

        {/* Sub-tasks */}
        {localSubs.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--df-ink-4)', textTransform: 'uppercase' }}>
                Sub-tasks
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--df-ink-3)' }}>
                {subDone}/{localSubs.length}
              </span>
            </div>
            <div style={{ height: 2, borderRadius: 1, background: 'var(--df-bg-3)', marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${subPct * 100}%`, background: `hsl(${catHue}, 55%, 60%)`, transition: 'width .3s' }} />
            </div>
            {localSubs.map((s, i) => (
              <button key={i} onClick={() => toggleSub(i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 12px', borderRadius: 10, textAlign: 'left', marginBottom: 4,
                background: 'var(--df-bg-2)', border: '1px solid var(--df-rule)',
                opacity: s.d ? 0.55 : 1,
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1.5px solid ${s.d ? `hsl(${catHue},55%,60%)` : 'var(--df-rule-2)'}`,
                  background: s.d ? `hsl(${catHue},55%,60%)` : 'transparent',
                }}>
                  {s.d && <Icons.check size={9} sw={2.5} stroke="oklch(0.12 0 0)" />}
                </span>
                <span style={{ fontSize: 13, color: s.d ? 'var(--df-ink-3)' : 'var(--df-ink)', textDecoration: s.d ? 'line-through' : 'none' }}>
                  {s.t}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--df-ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>
              Notes
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--df-bg-2)', border: '1px solid var(--df-rule)', fontSize: 13, lineHeight: 1.55, color: 'var(--df-ink-2)' }}>
              {task.notes}
            </div>
          </div>
        )}

        {/* Complete */}
        <button onClick={() => { completeTask(task.id); onExit() }} style={{
          width: '100%', marginTop: 24, padding: '14px', borderRadius: 12,
          background: `hsl(${catHue}, 55%, 55%)`, color: 'oklch(0.12 0 0)',
          fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icons.check size={15} sw={2.5} /> Mark complete · +{e?.xp ?? 0} XP
        </button>
      </div>

      {/* Right — live pomodoro */}
      <div style={{ flex: '0 0 400px', padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', background: 'var(--df-bg)' }}>

        {/* Phase switcher */}
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--df-bg-2)', border: '1px solid var(--df-rule)', marginBottom: 24 }}>
          {(['work', 'short', 'long'] as const).map(p => (
            <button key={p} onClick={() => switchPhase(p)} style={{
              flex: 1, padding: '7px 4px', borderRadius: 7,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
              background: phase === p ? PHASES[p].color : 'transparent',
              color: phase === p ? 'oklch(0.14 0 0)' : 'var(--df-ink-3)',
              fontWeight: phase === p ? 600 : 400,
            }}>
              {PHASES[p].label}
            </button>
          ))}
        </div>

        {/* Big ring */}
        <div style={{ position: 'relative', margin: '0 auto 6px', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={280} height={280} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="focus-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.65} />
              </linearGradient>
            </defs>
            <circle cx={140} cy={140} r={R} fill="none" stroke="var(--df-rule)" strokeWidth={6} />
            <circle cx={140} cy={140} r={R} fill="none" stroke={`url(#focus-ring-grad)`}
              strokeWidth={6} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
              transform="rotate(-90 140 140)"
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
            <circle cx={140} cy={140} r={R - 14} fill="none" stroke="var(--df-rule)" strokeWidth={0.5} strokeDasharray="1 4" opacity={0.5} />
          </svg>
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--df-ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
              {PHASES[phase].label} · session {sessions + 1}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 56, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--df-ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {mm}<span style={{ color: 'var(--df-ink-4)' }}>:</span>{ss}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--df-ink-3)', marginTop: 8 }}>
              {Math.floor(elapsed / 60)}m elapsed · {phase === 'work' ? mins : phase === 'short' ? 5 : 15}m total
            </div>
          </div>
        </div>

        {/* Session dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
          {[0,1,2,3].map(i => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i < cyclePos ? color : 'var(--df-bg-3)',
              border: `1px solid ${i < cyclePos ? color : 'var(--df-rule-2)'}`,
              boxShadow: i < cyclePos ? `0 0 10px ${color}` : 'none',
              transition: 'all .3s',
            }} />
          ))}
        </div>

        {/* Duration chips */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--df-ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>
            Duration — {mins}m
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[15,25,35,50,90].map(m => (
              <button key={m} onClick={() => resetDuration(m)} style={{
                flex: 1, padding: '9px 4px', borderRadius: 9,
                fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: mins === m ? 600 : 400,
                background: mins === m ? 'var(--df-ink)' : 'var(--df-bg-2)',
                color:      mins === m ? 'var(--df-bg)' : 'var(--df-ink-2)',
                border: '1px solid', borderColor: mins === m ? 'var(--df-ink)' : 'var(--df-rule)',
              }}>
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 'auto' }}>
          <button onClick={() => setRunning(r => !r)} style={{
            flex: 1, padding: 14, borderRadius: 12,
            background: running ? 'var(--df-bg-3)' : color,
            color: running ? 'var(--df-ink)' : 'oklch(0.14 0 0)',
            border: running ? '1px solid var(--df-rule-2)' : 'none',
            fontSize: 13.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {running ? <Icons.pause size={15} /> : <Icons.play size={15} />}
            {running ? 'Pause' : 'Start'}
          </button>
          <button onClick={() => setSecs(s => s + 300)} style={{
            padding: '14px 18px', borderRadius: 12,
            background: 'var(--df-bg-2)', color: 'var(--df-ink-2)',
            border: '1px solid var(--df-rule-2)',
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          }}>+5m</button>
          <button onClick={() => { setSecs(totalSecs); setRunning(false) }} style={{
            width: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--df-bg-2)', color: 'var(--df-ink-2)',
            border: '1px solid var(--df-rule-2)',
          }}>
            <Icons.reset size={14} />
          </button>
        </div>

        {/* Stats footer */}
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--df-rule)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {[
            { l: 'TODAY',  v: `${sessions}`,            sub: 'sessions' },
            { l: 'FOCUS',  v: `${Math.round((sessions * mins + Math.floor(elapsed / 60)) / 60 * 10) / 10}h`, sub: 'elapsed' },
            { l: 'NEXT',   v: sessions >= 3 ? '15m' : '5m', sub: sessions >= 3 ? 'long break' : 'short break' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--df-ink-4)', textTransform: 'uppercase' }}>{s.l}</div>
              <div className="t-display" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--df-ink)', marginTop: 4, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--df-ink-3)', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Desktop inline add ────────────────────────────────────────────────────────
function DesktopInlineAdd({ catId }: { catId: string }) {
  const [active, setActive] = React.useState(false)
  const [value,  setValue]  = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
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
      due: 'Today',
      ctx: '@anywhere',
      quad: 'q2',
      recurring: null,
      done: false,
      streak: 0,
      sub: [],
    })
    setValue('')
    setActive(false)
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '9px 14px',
          color: 'var(--ink-4)', fontSize: 12,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          border: '1px dashed var(--rule)', borderRadius: 8, marginTop: 6,
        }}
      >
        <Icons.plus size={11} /> Add task…
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
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
          flex: 1, padding: '8px 12px', borderRadius: 8,
          border: '2px solid var(--accent)',
          background: 'var(--paper-2)', fontSize: 13, color: 'var(--ink)',
          outline: 'none', fontFamily: 'var(--font-ui)',
        }}
      />
      <button onClick={handleSave} disabled={!value.trim()} style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: value.trim() ? 'var(--ink)' : 'var(--paper-3)',
        color: value.trim() ? 'var(--paper)' : 'var(--ink-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none',
      }}>
        <Icons.check size={13} sw={2.5} />
      </button>
      <button onClick={() => { setValue(''); setActive(false) }} style={{
        width: 34, height: 34, borderRadius: 8, color: 'var(--ink-3)',
        border: '1px solid var(--rule)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icons.close size={13} />
      </button>
    </div>
  )
}

// ── Main desktop layout ───────────────────────────────────────────────────────
export function DesktopLayout({ onLogout }: Props) {
  const tasks    = useLiveQuery(() => db.tasks.toArray(), []) ?? []
  const cats     = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get(1), [])

  const [tab,        setTab]        = useState<DesktopTab>('dashboard')
  const [catFilter,  setCatFilter]  = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [addTaskPrefill, setAddTaskPrefill] = useState<{ title?: string; catId?: string; due?: string; isHabit?: boolean } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')

  // Navigate within desktop: task selection opens detail panel; settings/other screens switch tabs
  const desktopNavigate = useCallback((s: Screen) => {
    if (s.name === 'task') setSelectedId(s.taskId)
    else if (s.name === 'settings') setTab('settings')
    else if (s.name === 'inbox')    setTab('inbox')
    else if (s.name === 'progress') setTab('progress')
    else if (s.name === 'review')   setTab('review')
  }, [])
  // Back from any inner screen returns to dashboard tab
  const desktopBack = useCallback(() => {
    setTab('dashboard')
    setCatFilter(null)
    setSelectedId(null)
  }, [])

  function openAddTask(prefill?: { title?: string; catId?: string; due?: string; isHabit?: boolean }) {
    setAddTaskPrefill(prefill ?? null)
    setShowAddTask(true)
  }

  // ⌘K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-select first today task on load
  useEffect(() => {
    const today = tasks.filter(t => t.due === 'Today' && !t.done)
    if (today.length > 0 && !selectedId) setSelectedId(today[0].id)
  }, [tasks])

  // Clear selection when switching tabs
  useEffect(() => { setSelectedId(null) }, [tab, catFilter])

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null

  // Task list data for dashboard tab
  const filteredTasks = catFilter ? tasks.filter(t => t.cat === catFilter) : tasks
  const todayTasks    = filteredTasks.filter(t => t.due === 'Today')
  const tomorrowTasks = filteredTasks.filter(t => t.due === 'Tomorrow')
  const weekTasks     = filteredTasks.filter(t => !['Today','Tomorrow'].includes(t.due))
  const searchLower   = search.toLowerCase()
  const searchFilter  = (t: Task) => !search || t.title.toLowerCase().includes(searchLower)

  // BottomNav handlers (desktop)
  function handleTabChange(s: Screen) {
    const name = s.name as string
    const desktopTabMap: Record<string, DesktopTab> = {
      dashboard: 'dashboard', journal: 'journal', goals: 'goals',
      calendar: 'calendar', inbox: 'inbox', 'all-tasks': 'all-tasks',
      progress: 'progress', review: 'review', settings: 'settings',
    }
    setTab(desktopTabMap[name] ?? 'dashboard')
    setCatFilter(null)
  }

  const activeTabName = catFilter ? 'dashboard'
    : (tab === 'journal' || tab === 'goals' || tab === 'calendar') ? tab
    : 'dashboard'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', overflow: 'hidden' }}>

      {/* ── Top row: sidebar + main ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 220, borderRight: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', background: 'var(--paper-2)', flexShrink: 0 }}>
          {/* Brand */}
          <div style={{ padding: '20px 20px 12px' }}>
            <div className="t-display" style={{ fontSize: 17, lineHeight: 1.2 }}>
              Mighty Banana <em style={{ color: 'var(--accent)' }}>Quest</em>
            </div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              {DAY_NAME.slice(0,3)} · {DATE_STR}
            </div>
          </div>

          <div style={{ padding: '0 10px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">

            {/* Nav links */}
            {([
              { id: 'dashboard',  label: 'Today',     icon: 'home'     },
              { id: 'inbox',      label: 'Inbox',     icon: 'inbox'    },
              { id: 'all-tasks',  label: 'All Tasks', icon: 'layers'   },
              { id: 'calendar',   label: 'Calendar',  icon: 'calendar' },
              { id: 'progress',   label: 'Progress',  icon: 'chart'    },
              { id: 'review',     label: 'Review',    icon: 'check'    },
            ] as { id: DesktopTab; label: string; icon: string }[]).map(item => {
              const I      = Icons[item.icon] ?? Icons.home
              const active = tab === item.id && !catFilter
              return (
                <button key={item.id} onClick={() => { setTab(item.id); setCatFilter(null) }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                  background: active ? 'var(--paper)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  boxShadow: active ? 'var(--shadow-1)' : 'none',
                }}>
                  <I size={14} />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: active ? 500 : 400 }}>{item.label}</span>
                </button>
              )
            })}

            {/* Areas */}
            <div className="eyebrow" style={{ padding: '14px 10px 6px' }}>Areas</div>
            {cats.map(c => {
              const I      = Icons[c.icon] ?? Icons.sparkle
              const open   = tasks.filter(t => t.cat === c.id && !t.done).length
              const active = catFilter === c.id
              return (
                <button key={c.id} onClick={() => { setCatFilter(c.id); setTab('dashboard') }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                  background: active ? 'var(--paper)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  boxShadow: active ? 'var(--shadow-1)' : 'none',
                }}>
                  <I size={14} />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: active ? 500 : 400 }}>{c.name}</span>
                  {open > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{open}</span>}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--rule)' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              {settings?.xp?.toLocaleString() ?? '0'} XP · {settings?.streak ?? 0}d streak
            </div>
            <button onClick={onLogout} style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icons.close size={11} /> Sign out
            </button>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Topbar */}
          <div style={{ height: 50, borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--paper-2)', maxWidth: 360 }}>
              <Icons.search size={13} stroke="var(--ink-3)" />
              <input ref={searchRef} placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12, color: 'var(--ink)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', padding: '2px 5px', border: '1px solid var(--rule)', borderRadius: 4 }}>⌘K</span>
            </div>
            <div style={{ flex: 1 }} />
            {settings && (settings.intensity ?? 'balanced') !== 'subtle' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-2)' }}>
                  <Icons.flame size={12} /> {settings.streak}d
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-2)' }}>
                  <Icons.bolt size={12} /> {settings.xp.toLocaleString()}
                </span>
              </div>
            )}
            <ThemeToggle />
            <button onClick={() => setTab('settings')} style={{ color: tab === 'settings' ? 'var(--ink)' : 'var(--ink-2)' }}>
              <Icons.settings size={18} />
            </button>
          </div>

          {/* Content area */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

            {/* Journal tab */}
            {tab === 'journal' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <JournalScreen navigate={desktopNavigate} back={desktopBack} />
              </div>
            )}

            {/* Goals tab */}
            {tab === 'goals' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <GoalsScreen navigate={desktopNavigate} back={desktopBack} onAddTask={() => openAddTask()} onAddHabit={() => openAddTask({ isHabit: true })} />
              </div>
            )}

            {/* Calendar tab */}
            {tab === 'calendar' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <CalendarScreen navigate={desktopNavigate} back={desktopBack}
                  onAddTask={(due?: string) => openAddTask(due ? { due } : undefined)} />
              </div>
            )}

            {/* Inbox tab */}
            {tab === 'inbox' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <InboxScreen navigate={desktopNavigate} back={desktopBack} onAddTask={() => openAddTask()} />
              </div>
            )}

            {/* All Tasks tab */}
            {tab === 'all-tasks' && (
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                  <AllTasksScreen navigate={desktopNavigate} back={desktopBack} onAddTask={() => openAddTask()} />
                </div>
                {selectedTask && (
                  <div style={{ width: 400, flexShrink: 0, borderLeft: '1px solid var(--rule)', overflowY: 'auto', background: 'var(--paper)' }} className="no-scrollbar">
                    <TaskDetailScreen
                      taskId={selectedTask.id}
                      navigate={desktopNavigate}
                      back={() => setSelectedId(null)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Progress tab */}
            {tab === 'progress' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <ProgressScreen navigate={desktopNavigate} back={desktopBack} />
              </div>
            )}

            {/* Review tab */}
            {tab === 'review' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <WeeklyReviewScreen navigate={desktopNavigate} back={desktopBack} />
              </div>
            )}

            {/* Settings tab */}
            {tab === 'settings' && (
              <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
                <SettingsScreen navigate={desktopNavigate} back={desktopBack} onLogout={onLogout} />
              </div>
            )}

            {/* Dashboard tab (default) */}
            {tab === 'dashboard' && (<>
              {/* Task list */}
              <div style={{ flex: 1, padding: '22px 26px', overflowY: 'auto', borderRight: selectedTask ? '1px solid var(--rule)' : 'none' }} className="no-scrollbar">
                <div className="eyebrow">{DAY_NAME} · {DATE_STR}</div>
                <div className="t-display" style={{ fontSize: 32, marginTop: 6, lineHeight: 1.05, marginBottom: 6 }}>
                  {catFilter ? cats.find(c => c.id === catFilter)?.name ?? 'Area' : getGreeting()}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 20 }}>
                  {todayTasks.filter(t => !t.done).length} open today
                  {settings && ` · ${settings.streak} day streak`}
                </div>

                {/* Progress strip */}
                {!catFilter && todayTasks.length > 0 && (
                  <div style={{ padding: 16, borderRadius: 14, background: 'var(--ink)', color: 'var(--paper)', marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.5)' }}>Today</div>
                        <div className="t-display" style={{ fontSize: 32, marginTop: 4 }}>
                          {todayTasks.filter(t => t.done).length}
                          <span style={{ opacity: 0.5, fontSize: 20 }}> / {todayTasks.length}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
                      <div style={{ width: `${(todayTasks.filter(t => t.done).length / todayTasks.length) * 100}%`, height: '100%', background: 'var(--accent-soft)', borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}

                {/* Task sections */}
                {[
                  { heading: 'Today',     tasks: todayTasks },
                  { heading: 'Tomorrow',  tasks: tomorrowTasks },
                  { heading: 'This week', tasks: weekTasks.slice(0, 8) },
                ].map(section => {
                  const visible = section.tasks.filter(searchFilter)
                  if (visible.length === 0) return null
                  return (
                    <div key={section.heading} style={{ marginBottom: 26 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{section.heading}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{visible.filter(t => !t.done).length} open</span>
                      </div>
                      {visible.map(t => (
                        <DesktopRow key={t.id} task={t} cats={cats}
                          isSelected={selectedId === t.id}
                          onSelect={() => setSelectedId(t.id)}
                          onComplete={() => completeTask(t.id)}
                        />
                      ))}
                    </div>
                  )
                })}

                {/* Inline task entry */}
                <DesktopInlineAdd catId={catFilter ?? 'inbox'} />
              </div>

              {/* Detail panel — full TaskDetailScreen */}
              {selectedTask && (
                <div style={{ width: 400, flexShrink: 0, borderLeft: '1px solid var(--rule)', overflowY: 'auto', background: 'var(--paper)' }} className="no-scrollbar">
                  <TaskDetailScreen
                    taskId={selectedTask.id}
                    navigate={desktopNavigate}
                    back={() => setSelectedId(null)}
                  />
                </div>
              )}
            </>)}
          </div>
        </div>
      </div>

      {/* ── Bottom nav (shared with mobile, original tabs) ── */}
      <BottomNav
        active={activeTabName}
        navigate={desktopNavigate}
        navigateTab={handleTabChange}
        onFabTap={() => openAddTask()}
        onFabLongPress={() => openAddTask()}
      />

      {/* Add Task sheet */}
      {showAddTask && (
        <AddTaskSheet
          onClose={() => { setShowAddTask(false); setAddTaskPrefill(null) }}
          defaultTitle={addTaskPrefill?.title}
          defaultCatId={addTaskPrefill?.catId}
          defaultDue={addTaskPrefill?.due}
          defaultIsHabit={addTaskPrefill?.isHabit}
        />
      )}
    </div>
  )
}
