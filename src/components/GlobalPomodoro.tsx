import React, { useState, useEffect, useRef } from 'react'
import { Icons } from './ui/Icons'

type Phase = 'work' | 'short-break' | 'long-break'
type State = 'idle' | 'running' | 'paused' | 'done'

interface Props { workMins: number }

export function GlobalPomodoro({ workMins }: Props) {
  const [expanded, setExpanded]   = useState(false)
  const [phase, setPhase]         = useState<Phase>('work')
  const [state, setState]         = useState<State>('idle')
  const [secsLeft, setSecsLeft]   = useState(workMins * 60)
  const [sessions, setSessions]   = useState(0)  // cumulative work sessions completed
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const phaseMins: Record<Phase, number> = {
    work:          workMins,
    'short-break': 5,
    'long-break':  15,
  }

  const phaseColor: Record<Phase, string> = {
    work:          'var(--ink)',
    'short-break': 'hsl(145,55%,40%)',
    'long-break':  'hsl(200,60%,45%)',
  }

  const phaseLabel: Record<Phase, string> = {
    work:          'Focus',
    'short-break': 'Short break',
    'long-break':  'Long break',
  }

  // ── Sync workMins when idle ───────────────────────────────────────────────
  useEffect(() => {
    if (state === 'idle' && phase === 'work') setSecsLeft(workMins * 60)
  }, [workMins, state, phase])

  // ── FAB shortcut ──────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setExpanded(true)
    window.addEventListener('pom:expand', h)
    return () => window.removeEventListener('pom:expand', h)
  }, [])

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setSecsLeft(s => Math.max(0, s - 1))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state])

  // ── Completion detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'running' || secsLeft !== 0) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    setState('done')
    setExpanded(true)
    if (phase === 'work') setSessions(c => c + 1)
    window.dispatchEvent(new CustomEvent('pom:done', { detail: { phase } }))
  }, [secsLeft, state, phase])

  // ── Phase switch ──────────────────────────────────────────────────────────
  function switchPhase(p: Phase) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (p === 'long-break') setSessions(0)
    setPhase(p)
    setState('idle')
    setSecsLeft(phaseMins[p] * 60)
  }

  // ── Derived display values ────────────────────────────────────────────────
  // cyclePos: how many sessions done in this 4-session cycle (1–4 shows as 1–4 dots)
  const cyclePos    = sessions % 4 === 0 && sessions > 0 ? 4 : sessions % 4
  const suggestLong = phase === 'work' && sessions > 0 && sessions % 4 === 0

  const mins    = Math.floor(secsLeft / 60)
  const secs    = secsLeft % 60
  const total   = phaseMins[phase] * 60
  const pct     = total > 0 ? 1 - secsLeft / total : 0
  const r       = 42
  const circ    = 2 * Math.PI * r
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const color   = phaseColor[phase]

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (!expanded) {
    // Hide entirely when idle — no timer is running
    if (state === 'idle') return null

    const isDone    = state === 'done'
    const isRunning = state === 'running'
    const pillBg    = isDone ? 'hsl(145,55%,40%)' : isRunning ? color : 'var(--paper)'
    const pillFg    = isDone || isRunning ? 'white' : 'var(--ink)'

    return (
      <button onClick={() => setExpanded(true)} style={{
        position: 'fixed', bottom: 'calc(82px + env(safe-area-inset-bottom))', right: 16, zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 14px', borderRadius: 20,
        background: pillBg, color: pillFg,
        border: '1px solid', borderColor: isDone || isRunning ? 'transparent' : 'var(--rule)',
        boxShadow: 'var(--shadow-1)',
        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
      }}>
        <Icons.timer size={14} />
        {isDone ? 'Done!' : timeStr}
        {/* Session dots — visible when paused/running and at least 1 session done */}
        {!isDone && cyclePos > 0 && (
          <span style={{ display: 'flex', gap: 2, marginLeft: 1 }}>
            {[0, 1, 2, 3].map(i => (
              <span key={i} style={{
                width: 4, height: 4, borderRadius: '50%', display: 'inline-block',
                background: i < cyclePos
                  ? (isRunning ? 'rgba(255,255,255,0.85)' : color)
                  : (isRunning ? 'rgba(255,255,255,0.25)' : 'var(--rule)'),
              }} />
            ))}
          </span>
        )}
      </button>
    )
  }

  // ── Done panel ────────────────────────────────────────────────────────────
  if (state === 'done') {
    const isWork     = phase === 'work'
    const nextBreak: Phase = suggestLong ? 'long-break' : 'short-break'
    const doneColor  = isWork ? 'hsl(145,55%,40%)' : phaseColor['work']

    return (
      <div style={{
        position: 'fixed', bottom: 'calc(82px + env(safe-area-inset-bottom))', right: 16, zIndex: 60,
        background: 'var(--paper)', border: '1px solid var(--rule)',
        borderRadius: 20, padding: '16px 16px 14px',
        boxShadow: 'var(--shadow-pop)', width: 230,
        animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: doneColor,
          }}>
            {isWork ? 'Focus complete' : 'Break complete'}
          </span>
          <button onClick={() => setExpanded(false)} style={{ color: 'var(--ink-3)' }}>
            <Icons.close size={15} />
          </button>
        </div>

        {/* Celebration */}
        <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>
            {isWork ? '🎉' : '💪'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            {isWork ? 'Nice work!' : 'Break over!'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
            {isWork
              ? (suggestLong ? 'Four sessions — earn a longer rest' : 'Take a short breather')
              : 'Ready for another session?'
            }
          </div>
        </div>

        {/* Session dots (work completions only) */}
        {isWork && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 14 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 9, height: 9, borderRadius: '50%',
                background: i < cyclePos ? doneColor : 'var(--paper-3)',
                border: `1.5px solid ${i < cyclePos ? doneColor : 'var(--rule)'}`,
              }} />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {isWork ? (
            <>
              <button onClick={() => switchPhase(nextBreak)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: doneColor, color: 'white', border: 'none',
              }}>
                {suggestLong ? '15m break' : '5m break'}
              </button>
              <button onClick={() => switchPhase('work')} style={{
                padding: '10px 12px', borderRadius: 10, fontSize: 11,
                background: 'var(--paper-2)', color: 'var(--ink-2)',
                border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)',
              }}>
                Skip
              </button>
            </>
          ) : (
            <button onClick={() => switchPhase('work')} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: phaseColor['work'], color: 'white', border: 'none',
            }}>
              Start focus
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Expanded panel (idle / running / paused) ──────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 'calc(82px + env(safe-area-inset-bottom))', right: 16, zIndex: 60,
      background: 'var(--paper)', border: '1px solid var(--rule)',
      borderRadius: 20, padding: '16px 16px 14px',
      boxShadow: 'var(--shadow-pop)', width: 230,
      animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color }}>
          {phaseLabel[phase]}
        </span>
        <button onClick={() => setExpanded(false)} style={{ color: 'var(--ink-3)' }}>
          <Icons.close size={15} />
        </button>
      </div>

      {/* Progress ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={100} height={100}>
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--rule)" strokeWidth={5} />
            <circle
              cx={50} cy={50} r={r} fill="none"
              stroke={color} strokeWidth={5} strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
            {timeStr}
          </div>
        </div>
      </div>

      {/* Session dots beneath ring (focus phase only) */}
      {phase === 'work' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i < cyclePos ? color : 'var(--paper-3)',
              border: `1px solid ${i < cyclePos ? color : 'var(--rule)'}`,
            }} />
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        {state !== 'running' ? (
          <button onClick={() => setState('running')} style={{
            width: 42, height: 42, borderRadius: '50%', background: color, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icons.play size={17} />
          </button>
        ) : (
          <button onClick={() => setState('paused')} style={{
            width: 42, height: 42, borderRadius: '50%', background: color, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icons.pause size={17} />
          </button>
        )}
        <button onClick={() => setSecsLeft(s => s + 300)} style={{
          width: 42, height: 42, borderRadius: '50%',
          border: '1px solid var(--rule)', background: 'var(--paper-2)',
          color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          +5m
        </button>
        <button onClick={() => switchPhase(phase)} style={{
          width: 42, height: 42, borderRadius: '50%',
          border: '1px solid var(--rule)', background: 'var(--paper-2)', color: 'var(--ink-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.reset size={15} />
        </button>
      </div>

      {/* Phase switchers */}
      <div style={{ display: 'flex', gap: 5 }}>
        {(['work', 'short-break', 'long-break'] as Phase[]).map(p => (
          <button key={p} onClick={() => switchPhase(p)} style={{
            flex: 1, padding: '6px 2px', borderRadius: 6,
            fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em',
            background: phase === p ? 'var(--ink)' : 'var(--paper-2)',
            color:      phase === p ? 'var(--paper)' : 'var(--ink-3)',
            border: '1px solid', borderColor: phase === p ? 'var(--ink)' : 'var(--rule)',
          }}>
            {p === 'work' ? 'Focus' : p === 'short-break' ? 'Short' : 'Long'}
          </button>
        ))}
      </div>
    </div>
  )
}
