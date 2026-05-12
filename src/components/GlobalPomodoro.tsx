import React, { useState, useEffect, useRef } from 'react'
import { Icons } from './ui/Icons'
import { notificationsSupported, getPermission, requestPermission } from '../lib/notifications'

type Phase = 'work' | 'short-break' | 'long-break'
type State = 'idle' | 'running' | 'paused' | 'done'

// Same key as TaskPomodoro — GlobalPomodoro reads from it to stay in sync
const SNAP_KEY = 'mbq:pom-v1'

/** Map TaskPomodoro phase names ('short'/'long') → GlobalPomodoro phase names */
function mapPhase(p: string): Phase {
  if (p === 'short') return 'short-break'
  if (p === 'long')  return 'long-break'
  return 'work'
}

interface Props { workMins: number }

export function GlobalPomodoro({ workMins }: Props) {
  const [expanded, setExpanded]   = useState(false)
  const [phase, setPhase]         = useState<Phase>('work')
  const [state, setState]         = useState<State>('idle')
  const [secsLeft, setSecsLeft]   = useState(workMins * 60)
  const [sessions, setSessions]   = useState(0)  // cumulative work sessions completed
  const [autoCount, setAutoCount] = useState<number | null>(null)  // null = inactive
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextAutoPhase  = useRef<Phase>('short-break')
  // When true, this GlobalPomodoro instance is mirroring an external TaskPomodoro timer.
  // In external mode: countdown reads from localStorage (wall-clock corrected),
  // completion is driven by the pom:done event (not by secsLeft hitting 0 internally).
  const isExternalRef = useRef(false)
  const sessionsRef   = useRef(0)  // kept in sync with sessions for use in closures

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

  // Keep sessionsRef in sync
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

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

  // ── Sync from TaskPomodoro's localStorage snapshot ────────────────────────
  // Reads mbq:pom-v1 on mount and whenever TaskPomodoro dispatches pom:sync,
  // so the floating pill always reflects an active task timer.
  useEffect(() => {
    function syncFromStorage() {
      try {
        const raw = localStorage.getItem(SNAP_KEY)
        if (!raw) return
        const snap = JSON.parse(raw)

        const p = mapPhase(snap.phase ?? 'work')
        const phaseMinsForSnap = p === 'work'
          ? (snap.selMins ?? workMins)
          : p === 'short-break' ? 5 : 15

        // Wall-clock–corrected remaining seconds
        let secsNow = phaseMinsForSnap * 60
        if (snap.running && snap.startedAt != null && snap.secsAtStart != null) {
          const elapsed = (Date.now() - snap.startedAt) / 1000
          secsNow = Math.max(0, snap.secsAtStart - elapsed)
        } else if (snap.pausedSecs != null) {
          secsNow = snap.pausedSecs
        }

        // Detect "reset / never started" — secs is effectively at full duration
        const isReset = !snap.running && !snap.donePhase
          && snap.pausedSecs != null
          && snap.pausedSecs >= phaseMinsForSnap * 60 - 1

        if (snap.donePhase) {
          // Already completed — show done panel (covers page-refresh scenario)
          isExternalRef.current = true
          setPhase(mapPhase(snap.donePhase))
          setSessions(snap.sessions ?? 0)
          setSecsLeft(0)
          setState('done')
          setExpanded(true)
        } else if (snap.running && secsNow > 0) {
          isExternalRef.current = true
          setPhase(p)
          setSessions(snap.sessions ?? 0)
          setSecsLeft(Math.round(secsNow))
          setState('running')
        } else if (!isReset && snap.pausedSecs != null && snap.pausedSecs > 0) {
          isExternalRef.current = true
          setPhase(p)
          setSessions(snap.sessions ?? 0)
          setSecsLeft(Math.round(secsNow))
          setState('paused')
        } else if (isReset) {
          // Timer was reset — return to idle so the pill disappears
          isExternalRef.current = false
          setState('idle')
        }
      } catch { /* ignore */ }
    }

    syncFromStorage()
    window.addEventListener('pom:sync', syncFromStorage)
    return () => window.removeEventListener('pom:sync', syncFromStorage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMins])

  // ── Handle external timer completion (from TaskPomodoro's pom:done) ────────
  // Plays the chime and shows the done panel when pom:done comes from TaskPomodoro.
  // When it's GlobalPomodoro's own timer, completion is handled internally below.
  useEffect(() => {
    function handler(e: Event) {
      if (!isExternalRef.current) return  // own timer handled internally
      const { phase: rawPhase } = (e as CustomEvent<{ phase: string }>).detail
      const completedPhase = mapPhase(rawPhase)

      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      setState('done')
      setExpanded(true)

      // Read latest session count from localStorage
      try {
        const snap = JSON.parse(localStorage.getItem(SNAP_KEY) ?? 'null')
        if (snap) {
          const newSessions = snap.sessions ?? 0
          setSessions(newSessions)
          sessionsRef.current = newSessions
        }
      } catch {}

      playChime(completedPhase)

      // Start 5s auto-flow
      const suggestLong = completedPhase === 'work' && sessionsRef.current % 4 === 0 && sessionsRef.current > 0
      const autoNext: Phase = completedPhase === 'work'
        ? (suggestLong ? 'long-break' : 'short-break')
        : 'work'
      startCountdown(autoNext)
    }

    window.addEventListener('pom:done', handler)
    return () => window.removeEventListener('pom:done', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Notification chime ────────────────────────────────────────────────────
  function playChime(ph: Phase) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx  = new Ctx() as AudioContext
      // Work done → celebratory ascending C5-E5-G5
      // Break done → gentle descending G5-E5-C5
      const notes = ph === 'work'
        ? [523.25, 659.25, 783.99]
        : [783.99, 659.25, 523.25]
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const t = ctx.currentTime + i * 0.2
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
        osc.start(t)
        osc.stop(t + 0.6)
      })
      setTimeout(() => ctx.close(), 2500)
    } catch { /* audio unavailable */ }
  }

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    if (isExternalRef.current) {
      // External mode: read from localStorage each tick for wall-clock accuracy
      intervalRef.current = setInterval(() => {
        try {
          const snap = JSON.parse(localStorage.getItem(SNAP_KEY) ?? 'null')
          if (snap?.running && snap.startedAt != null && snap.secsAtStart != null) {
            const elapsed   = (Date.now() - snap.startedAt) / 1000
            const remaining = Math.max(0, snap.secsAtStart - elapsed)
            setSecsLeft(Math.round(remaining))
          } else {
            setSecsLeft(s => Math.max(0, s - 1))
          }
        } catch {
          setSecsLeft(s => Math.max(0, s - 1))
        }
      }, 1000)
    } else {
      // Own timer: simple decrement
      intervalRef.current = setInterval(() => {
        setSecsLeft(s => Math.max(0, s - 1))
      }, 1000)
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state])

  // ── Completion detection (own timer only) ────────────────────────────────
  // External timer completion is handled by the pom:done listener above.
  useEffect(() => {
    if (isExternalRef.current) return  // TaskPomodoro owns that timer's lifecycle
    if (state !== 'running' || secsLeft !== 0) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    setState('done')
    setExpanded(true)
    const newSessions = phase === 'work' ? sessions + 1 : sessions
    if (phase === 'work') setSessions(newSessions)
    window.dispatchEvent(new CustomEvent('pom:done', { detail: { phase } }))
    playChime(phase)
    // Kick off 5s auto-flow countdown
    const suggestLong = phase === 'work' && newSessions % 4 === 0
    const autoNext: Phase = phase === 'work'
      ? (suggestLong ? 'long-break' : 'short-break')
      : 'work'
    startCountdown(autoNext)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft, state, phase])

  // ── Auto-flow countdown ───────────────────────────────────────────────────
  function cancelCountdown() {
    if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null }
    setAutoCount(null)
  }

  function startCountdown(next: Phase) {
    nextAutoPhase.current = next
    setAutoCount(5)
    autoIntervalRef.current = setInterval(() => {
      setAutoCount(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(autoIntervalRef.current!)
          autoIntervalRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // autoCount hits 0 → fire auto-start
  useEffect(() => {
    if (autoCount !== 0) return
    startPhase(nextAutoPhase.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCount])

  // switchPhase — changes phase, leaves timer idle
  function switchPhase(p: Phase) {
    isExternalRef.current = false  // user took control via GlobalPomodoro
    cancelCountdown()
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (p === 'long-break') setSessions(0)
    setPhase(p)
    setState('idle')
    setSecsLeft(phaseMins[p] * 60)
  }

  // startPhase — changes phase AND immediately starts the timer
  function startPhase(p: Phase) {
    isExternalRef.current = false  // user took control via GlobalPomodoro
    cancelCountdown()
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (p === 'long-break') setSessions(0)
    setPhase(p)
    setSecsLeft(phaseMins[p] * 60)
    setState('running')
    // Request notification permission on first timer start (only when not yet asked)
    if (notificationsSupported() && getPermission() === 'default') {
      requestPermission()
    }
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
              <button onClick={() => startPhase(nextBreak)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: doneColor, color: 'white', border: 'none',
              }}>
                {suggestLong ? '15m break' : '5m break'}
              </button>
              <button onClick={() => { cancelCountdown(); switchPhase('work') }} style={{
                padding: '10px 12px', borderRadius: 10, fontSize: 11,
                background: 'var(--paper-2)', color: 'var(--ink-2)',
                border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)',
              }}>
                Skip
              </button>
            </>
          ) : (
            <button onClick={() => startPhase('work')} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: phaseColor['work'], color: 'white', border: 'none',
            }}>
              Start focus
            </button>
          )}
        </div>

        {/* 5s auto-flow progress bar */}
        {autoCount !== null && autoCount > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              height: 2, borderRadius: 1,
              background: 'var(--rule)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 1,
                background: doneColor,
                width: `${(autoCount / 5) * 100}%`,
                transition: 'width 1s linear',
              }} />
            </div>
            <div style={{
              marginTop: 5, textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--ink-3)', letterSpacing: '0.08em',
            }}>
              AUTO-STARTING IN {autoCount}S
            </div>
          </div>
        )}
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
