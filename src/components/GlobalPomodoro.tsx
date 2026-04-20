import React, { useState, useEffect, useRef } from 'react'
import { Icons } from './ui/Icons'

type Phase = 'work' | 'short-break' | 'long-break'
type State = 'idle' | 'running' | 'paused'

interface Props {
  workMins: number  // synced from Settings
}

export function GlobalPomodoro({ workMins }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase]       = useState<Phase>('work')
  const [state, setState]       = useState<State>('idle')
  const [secsLeft, setSecsLeft] = useState(workMins * 60)
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

  // Sync workMins from settings when idle
  useEffect(() => {
    if (state === 'idle' && phase === 'work') setSecsLeft(workMins * 60)
  }, [workMins, state, phase])

  // Countdown tick
  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = setInterval(() => {
        setSecsLeft(s => {
          if (s <= 1) {
            setState('idle')
            clearInterval(intervalRef.current!)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state])

  function switchPhase(p: Phase) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPhase(p)
    setState('idle')
    setSecsLeft(phaseMins[p] * 60)
  }

  const mins  = Math.floor(secsLeft / 60)
  const secs  = secsLeft % 60
  const total = phaseMins[phase] * 60
  const pct   = 1 - secsLeft / total
  const r     = 42
  const circ  = 2 * Math.PI * r

  const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
  const color   = phaseColor[phase]

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed', bottom: 82, left: 20, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 14px', borderRadius: 20,
          background: state === 'running' ? color : 'var(--paper)',
          color:      state === 'running' ? 'white' : 'var(--ink)',
          border: '1px solid', borderColor: state === 'running' ? 'transparent' : 'var(--rule)',
          boxShadow: 'var(--shadow-1)',
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        <Icons.timer size={14} />
        {timeStr}
      </button>
    )
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 82, left: 16, zIndex: 50,
      background: 'var(--paper)', border: '1px solid var(--rule)',
      borderRadius: 20, padding: '16px 16px 14px',
      boxShadow: 'var(--shadow-pop)', width: 230,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color,
        }}>
          {phaseLabel[phase]}
        </span>
        <button onClick={() => setExpanded(false)} style={{ color: 'var(--ink-3)' }}>
          <Icons.close size={15} />
        </button>
      </div>

      {/* Ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={100} height={100}>
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--rule)" strokeWidth={5} />
            <circle
              cx={50} cy={50} r={r} fill="none"
              stroke={color} strokeWidth={5} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {timeStr}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        {(state === 'idle' || state === 'paused') ? (
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
        <button
          onClick={() => setSecsLeft(s => s + 300)}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            border: '1px solid var(--rule)', background: 'var(--paper-2)',
            color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +5m
        </button>
        <button
          onClick={() => switchPhase(phase)}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            border: '1px solid var(--rule)', background: 'var(--paper-2)',
            color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icons.reset size={15} />
        </button>
      </div>

      {/* Phase switchers */}
      <div style={{ display: 'flex', gap: 5 }}>
        {(['work', 'short-break', 'long-break'] as Phase[]).map(p => (
          <button key={p} onClick={() => switchPhase(p)} style={{
            flex: 1, padding: '6px 2px', borderRadius: 6,
            fontSize: 9, fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
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
