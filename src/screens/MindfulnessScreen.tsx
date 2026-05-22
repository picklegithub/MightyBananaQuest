import React, { useState, useEffect, useRef } from 'react'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { useNav } from '../lib/navContext'

const PATTERNS = {
  box: {
    label: 'Box breath', detail: '4–4–4–4', phases: [
      { name: 'Inhale', dur: 4, scale: 1.3 },
      { name: 'Hold',   dur: 4, scale: 1.3 },
      { name: 'Exhale', dur: 4, scale: 0.75 },
      { name: 'Hold',   dur: 4, scale: 0.75 },
    ],
  },
  '478': {
    label: '4–7–8', detail: 'calming', phases: [
      { name: 'Inhale', dur: 4, scale: 1.3 },
      { name: 'Hold',   dur: 7, scale: 1.3 },
      { name: 'Exhale', dur: 8, scale: 0.75 },
    ],
  },
} as const

type PatternKey = keyof typeof PATTERNS

const DURATIONS = [2, 5, 10] // minutes

export function MindfulnessScreen() {
  const { back } = useNav()

  const [pattern, setPattern]       = useState<PatternKey>('box')
  const [duration, setDuration]     = useState(5) // minutes
  const [running, setRunning]       = useState(false)
  const [done, setDone]             = useState(false)
  const [phase, setPhase]           = useState('')
  const [countdown, setCountdown]   = useState(0)
  const [scale, setScale]           = useState(1)
  const [secsLeft, setSecsLeft]     = useState(5 * 60)

  const runningRef = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimers() {
    if (timerRef.current)   { clearTimeout(timerRef.current);   timerRef.current  = null }
    if (tickRef.current)    { clearInterval(tickRef.current);   tickRef.current   = null }
    if (sessionRef.current) { clearInterval(sessionRef.current); sessionRef.current = null }
  }

  function stop(isDone = false) {
    runningRef.current = false
    setRunning(false)
    clearTimers()
    setPhase(''); setCountdown(0); setScale(1)
    if (isDone) {
      setDone(true)
    } else {
      setSecsLeft(duration * 60)
    }
  }

  function runPhase(phaseIdx: number, pat: PatternKey) {
    if (!runningRef.current) return
    const p  = PATTERNS[pat]
    const ph = p.phases[phaseIdx % p.phases.length]
    setPhase(ph.name)
    setScale(ph.scale)
    let c = ph.dur
    setCountdown(c)
    tickRef.current = setInterval(() => {
      c--
      if (c > 0) setCountdown(c)
      else clearInterval(tickRef.current!)
    }, 1000)
    timerRef.current = setTimeout(() => {
      clearInterval(tickRef.current!)
      runPhase(phaseIdx + 1, pat)
    }, ph.dur * 1000)
  }

  function start() {
    clearTimers()
    runningRef.current = true
    setRunning(true)
    setDone(false)

    const totalSecs = duration * 60
    setSecsLeft(totalSecs)

    // Total session countdown
    let remaining = totalSecs
    sessionRef.current = setInterval(() => {
      remaining--
      setSecsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(sessionRef.current!)
        sessionRef.current = null
        stop(true)
      }
    }, 1000)

    runPhase(0, pattern)
  }

  function reset() {
    stop(false)
    setDone(false)
    setSecsLeft(duration * 60)
  }

  useEffect(() => {
    return () => { clearTimers(); runningRef.current = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When pattern changes while idle, reset the display
  useEffect(() => {
    if (!running && !done) { setPhase(''); setCountdown(0); setScale(1) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern])

  // Sync secsLeft when duration changes while idle
  useEffect(() => {
    if (!running && !done) setSecsLeft(duration * 60)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0')
  const ss = String(secsLeft % 60).padStart(2, '0')

  return (
    <div className="screen">
      <ScreenHeader title="Mindfulness" back={back} icon={<Icons.leaf size={22} />} />
      <div className="screen-scroll" style={{ paddingBottom: 48 }}>
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'stretch' }}>

          {/* Pattern + duration selectors — hidden while running */}
          {!running && !done && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['box', '478'] as PatternKey[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setPattern(k)}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 'var(--r-pill)',
                      border: pattern === k ? 'none' : '1px solid var(--rule)',
                      background: pattern === k ? 'var(--accent)' : 'var(--paper-2)',
                      color: pattern === k ? 'var(--paper)' : 'var(--ink-2)',
                      fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {PATTERNS[k].label}
                    <span style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', opacity: 0.7, marginTop: 2 }}>
                      {PATTERNS[k].detail}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 'var(--r-pill)',
                      border: duration === d ? 'none' : '1px solid var(--rule)',
                      background: duration === d ? 'var(--ink)' : 'var(--paper-2)',
                      color: duration === d ? 'var(--paper)' : 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: duration === d ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Done state */}
          {done && (
            <div style={{
              background: 'var(--accent-soft)', borderRadius: 14,
              border: '1px solid var(--rule)', padding: '32px 20px',
              textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
            }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>🌿</div>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink)' }}>
                Session complete
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {duration} minutes of {PATTERNS[pattern].label.toLowerCase()}
              </div>
              <button
                onClick={reset}
                style={{
                  marginTop: 8,
                  background: 'var(--accent)', color: 'var(--paper)',
                  borderRadius: 'var(--r-pill)', border: 'none',
                  padding: '12px 28px', fontFamily: 'var(--font-ui)',
                  fontSize: 15, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Go again
              </button>
            </div>
          )}

          {/* Animated circle */}
          {!done && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
              <div style={{
                width: 200, height: 200, borderRadius: '50%',
                background: 'var(--accent-soft)',
                border: '2px solid var(--accent)',
                opacity: running ? 1 : 0.6,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                transform: `scale(${scale})`,
                transition: 'transform 0.8s ease-in-out, opacity 0.3s',
              }}>
                {running ? (
                  <>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontStyle: 'italic',
                      fontSize: 20, color: 'var(--ink)', marginBottom: 4,
                    }}>
                      {phase}
                    </div>
                    <div style={{ fontSize: 36, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', fontWeight: 300 }}>
                      {countdown}
                    </div>
                  </>
                ) : (
                  <div style={{
                    fontFamily: 'var(--font-display)', fontStyle: 'italic',
                    fontSize: 16, color: 'var(--ink-3)', textAlign: 'center', padding: '0 20px',
                  }}>
                    Press Start to begin
                  </div>
                )}
              </div>

              {/* Session countdown */}
              {running && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                  {mm}:{ss} remaining
                </div>
              )}
            </div>
          )}

          {/* Start/Stop button */}
          {!done && (
            <button
              onClick={running ? () => stop(false) : start}
              style={{
                background: running ? 'var(--warn)' : 'var(--accent)',
                color: 'var(--paper)', borderRadius: 'var(--r-pill)',
                border: 'none', padding: '14px 24px',
                fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {running ? 'Stop' : 'Start'}
            </button>
          )}

          {/* Tips card */}
          {!running && !done && (
            <div style={{
              background: 'var(--paper-2)', borderRadius: 14,
              border: '1px solid var(--rule)', padding: '16px 20px',
            }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Tips</div>
              {[
                'Breathe from your belly',
                'Let thoughts pass like clouds',
                'Soften your jaw and shoulders',
              ].map((tip, i, arr) => (
                <div key={tip} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  fontSize: 13, color: 'var(--ink-2)',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--rule)' : 'none',
                }}>
                  <span style={{ color: 'var(--accent)', fontSize: 10, flexShrink: 0 }}>●</span>
                  {tip}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
