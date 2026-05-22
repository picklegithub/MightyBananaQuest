import React, { useState, useEffect, useRef } from 'react'
import { Icons } from './ui/Icons'
import type { EffortKey } from '../types'
import { requestPermission } from '../lib/notifications'

// ── Always-dark palette — independent of app theme ───────────────────────────
const D = {
  bg:     '#0d0d0d',
  bg2:    '#161616',
  bg3:    '#1d1d1d',
  ink:    '#f0ece4',
  ink2:   '#9a948c',
  ink3:   '#58534e',
  rule:   '#252525',
  accent: 'hsl(145, 48%, 36%)',
} as const

// ── Phase ─────────────────────────────────────────────────────────────────────
type Phase = 'work' | 'short' | 'long'

const PHASE_LABELS: Record<Phase, string> = {
  work: 'Focus', short: 'Short break', long: 'Long break',
}

const BREAK_MINS: Record<'short' | 'long', number> = { short: 5, long: 15 }

// ── Effort → default focus duration ──────────────────────────────────────────
const EFFORT_TO_POM: Record<EffortKey, number> = {
  xs: 10, s: 15, m: 25, l: 45, xl: 60, xxl: 90,
}

const EFFORT_SHORT: Record<EffortKey, string> = {
  xs: 'MICRO', s: 'SMALL', m: 'MEDIUM', l: 'LONG', xl: 'MAMMOTH', xxl: 'GIANT',
}

const CHIPS = [10, 15, 25, 45, 60, 90]

// ── SVG ring ──────────────────────────────────────────────────────────────────
const SZ   = 280
const CX   = SZ / 2
const CY   = SZ / 2
const R    = 110
const CIRC = 2 * Math.PI * R

// ── Persistence ───────────────────────────────────────────────────────────────
const SNAP_KEY = 'mbq:pom-v1'

interface Snap {
  phase:       Phase
  selMins:     number
  sessions:    number
  running:     boolean
  donePhase:   Phase | null   // which phase just completed (shows done panel)
  startedAt:   number | null
  secsAtStart: number | null
  pausedSecs:  number | null
}

function readSnap(): Snap | null {
  try { return JSON.parse(localStorage.getItem(SNAP_KEY) ?? 'null') }
  catch { return null }
}

function writeSnap(s: Snap): void {
  try { localStorage.setItem(SNAP_KEY, JSON.stringify(s)) }
  catch { /* storage unavailable — degrade gracefully */ }
}

/** Tell GlobalPomodoro to re-sync from localStorage */
function dispatchSync(): void {
  window.dispatchEvent(new Event('pom:sync'))
}

function snapToSecs(snap: Snap): number {
  if (snap.running && snap.startedAt != null && snap.secsAtStart != null) {
    const elapsed = (Date.now() - snap.startedAt) / 1000
    return Math.max(0, snap.secsAtStart - elapsed)
  }
  const phaseMins = snap.phase === 'work'
    ? snap.selMins
    : BREAK_MINS[snap.phase as 'short' | 'long']
  return snap.pausedSecs ?? phaseMins * 60
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  effort?:       EffortKey
  xp?:           number
  pomodoroMins?: number
}

export function TaskPomodoro({ effort, xp = 0, pomodoroMins }: Props) {
  // ── Boot from snapshot ────────────────────────────────────────────────────
  const snap0       = useRef(readSnap()).current
  const defaultMins = pomodoroMins ?? (effort ? EFFORT_TO_POM[effort] : 25) ?? 25

  const initPhase     = snap0?.phase     ?? 'work'
  const initSelMins   = snap0?.selMins   ?? defaultMins
  const initSessions  = snap0?.sessions  ?? 0
  const initDonePhase = snap0?.donePhase ?? null
  const initSecs      = snap0 ? snapToSecs(snap0) : defaultMins * 60
  // Don't restore running if the timer has since completed
  const initRunning   = (snap0?.running === true) && initSecs > 0 && !initDonePhase

  const [phase,     setPhase]     = useState<Phase>(initPhase)
  const [selMins,   setSelMins]   = useState<number>(initSelMins)
  const [sessions,  setSessions]  = useState<number>(initSessions)
  const [secs,      setSecs]      = useState<number>(initSecs)
  const [running,   setRunning]   = useState<boolean>(initRunning)
  // donePhase — set when a phase completes, drives the done panel
  const [donePhase, setDonePhase] = useState<Phase | null>(initDonePhase)
  const [autoCount, setAutoCount] = useState<number | null>(null)  // null = inactive

  const startedAtRef    = useRef<number | null>(
    initRunning && snap0?.startedAt != null ? snap0.startedAt : null
  )
  const secsAtStartRef  = useRef<number>(
    initRunning && snap0?.secsAtStart != null ? snap0.secsAtStart : initSecs
  )
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextAutoPhase   = useRef<Phase>('short')

  // ── Derived ───────────────────────────────────────────────────────────────
  const phaseTotalMins = phase === 'work' ? selMins : BREAK_MINS[phase as 'short' | 'long']
  const total          = phaseTotalMins * 60
  const atStart        = secs === total

  // After a work session, should we recommend the long break?
  // sessions is already incremented when the done panel shows.
  const suggestLong = donePhase === 'work' && sessions > 0 && sessions % 4 === 0
  const nextBreak: Phase = suggestLong ? 'long' : 'short'

  // 4-dot cycle position
  const cyclePos = sessions % 4 === 0 && sessions > 0 ? 4 : sessions % 4

  // ── Snapshot builders ─────────────────────────────────────────────────────
  function makeSnap(overrides: Partial<Snap>): Snap {
    return {
      phase, selMins, sessions,
      running:     false,
      donePhase:   donePhase,
      startedAt:   startedAtRef.current,
      secsAtStart: secsAtStartRef.current,
      pausedSecs:  null,
      ...overrides,
    }
  }

  // ── Countdown — wall-clock corrected ──────────────────────────────────────
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      return
    }

    intervalRef.current = setInterval(() => {
      if (startedAtRef.current == null) return

      const elapsed   = (Date.now() - startedAtRef.current) / 1000
      const remaining = Math.max(0, secsAtStartRef.current - elapsed)
      setSecs(Math.round(remaining))

      if (remaining <= 0) {
        clearInterval(intervalRef.current!)
        intervalRef.current  = null
        startedAtRef.current = null
        setRunning(false)

        const completedPhase = phase   // captured in closure
        const newSessions    = completedPhase === 'work' ? sessions + 1 : sessions

        if (completedPhase === 'work') {
          setSessions(newSessions)
          writeSnap(makeSnap({ sessions: newSessions, running: false, startedAt: null, secsAtStart: null, pausedSecs: 0, donePhase: completedPhase }))
        } else {
          writeSnap(makeSnap({ running: false, startedAt: null, secsAtStart: null, pausedSecs: 0, donePhase: completedPhase }))
        }

        setDonePhase(completedPhase)
        window.dispatchEvent(new CustomEvent('pom:done', { detail: { phase: completedPhase } }))

        // Kick off 5s auto-flow countdown
        const suggestLongBreak = completedPhase === 'work' && newSessions % 4 === 0
        const autoNext: Phase  = completedPhase === 'work'
          ? (suggestLongBreak ? 'long' : 'short')
          : 'work'
        startCountdown(autoNext)
      }
    }, 500)

    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // ── Actions ───────────────────────────────────────────────────────────────
  function play() {
    startedAtRef.current   = Date.now()
    secsAtStartRef.current = secs
    writeSnap(makeSnap({ running: true, startedAt: startedAtRef.current, secsAtStart: secs, pausedSecs: null }))
    setRunning(true)
    dispatchSync()
    // Request notification permission on first timer start (shows browser prompt if not yet decided)
    requestPermission().catch(() => {})
  }

  function pause() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    startedAtRef.current = null
    writeSnap(makeSnap({ running: false, startedAt: null, secsAtStart: null, pausedSecs: secs }))
    setRunning(false)
    dispatchSync()
  }

  function reset() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    startedAtRef.current   = null
    secsAtStartRef.current = total
    writeSnap(makeSnap({ running: false, startedAt: null, secsAtStart: null, pausedSecs: total, donePhase: null }))
    setRunning(false)
    setDonePhase(null)
    setSecs(total)
    dispatchSync()
  }

  function addFive() {
    const next = secs + 300
    setSecs(next)
    if (running && startedAtRef.current != null) {
      secsAtStartRef.current += 300
      writeSnap(makeSnap({ running: true, startedAt: startedAtRef.current, secsAtStart: secsAtStartRef.current, pausedSecs: null }))
    } else {
      writeSnap(makeSnap({ running: false, startedAt: null, secsAtStart: null, pausedSecs: next }))
    }
    dispatchSync()
  }

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

  // switchPhase — changes phase, leaves timer idle (used by Skip)
  function switchPhase(p: Phase) {
    cancelCountdown()
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    startedAtRef.current = null
    const newTotal         = p === 'work' ? selMins * 60 : BREAK_MINS[p as 'short' | 'long'] * 60
    secsAtStartRef.current = newTotal
    setPhase(p)
    setRunning(false)
    setDonePhase(null)
    setSecs(newTotal)
    writeSnap({ phase: p, selMins, sessions, running: false, donePhase: null, startedAt: null, secsAtStart: null, pausedSecs: newTotal })
    dispatchSync()
  }

  // startPhase — changes phase AND immediately starts the timer
  function startPhase(p: Phase) {
    cancelCountdown()
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    const newTotal = p === 'work' ? selMins * 60 : BREAK_MINS[p as 'short' | 'long'] * 60
    const now = Date.now()
    startedAtRef.current   = now
    secsAtStartRef.current = newTotal
    setPhase(p)
    setRunning(true)
    setDonePhase(null)
    setSecs(newTotal)
    writeSnap({ phase: p, selMins, sessions, running: true, donePhase: null, startedAt: now, secsAtStart: newTotal, pausedSecs: null })
    dispatchSync()
    // Request notification permission on first timer start (browser-native prompt)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestPermission()
    }
  }

  function changeSelMins(m: number) {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    startedAtRef.current   = null
    secsAtStartRef.current = m * 60
    setSelMins(m)
    setRunning(false)
    setDonePhase(null)
    setSecs(m * 60)
    writeSnap({ phase, selMins: m, sessions, running: false, donePhase: null, startedAt: null, secsAtStart: null, pausedSecs: m * 60 })
    dispatchSync()
  }

  function handleSlider(raw: number) {
    const near = CHIPS.find(c => Math.abs(c - raw) <= 2)
    changeSelMins(near ?? raw)
  }

  // ── Display values ────────────────────────────────────────────────────────
  const elapsed  = total - secs
  const pct      = total > 0 ? (elapsed / total) * 100 : 0
  const mm       = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss_      = String(secs % 60).padStart(2, '0')
  const btnLabel = running ? 'Pause' : atStart ? 'Start' : 'Resume'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ margin: '20px 0 0', borderRadius: 20, background: D.bg, overflow: 'hidden' }}>

      {/* ── Phase tabs ── */}
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', background: D.bg3, borderRadius: 12, padding: 4, gap: 4 }}>
          {(['work', 'short', 'long'] as Phase[]).map(p => {
            const active = phase === p
            return (
              <button
                key={p}
                onClick={() => switchPhase(p)}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 9,
                  background:    active ? D.accent : 'transparent',
                  color:         active ? '#f0ece4' : D.ink3,
                  fontFamily:    'var(--font-mono)',
                  fontSize:      11,
                  fontWeight:    active ? 700 : 400,
                  letterSpacing: '0.02em',
                  border:        'none',
                  cursor:        'pointer',
                  transition:    'background .15s, color .15s',
                }}
              >
                {PHASE_LABELS[p]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DONE PANEL — shown when a phase just completed
      ══════════════════════════════════════════════════════════════════ */}
      {donePhase !== null ? (
        <>
          <div style={{
            padding:   '32px 24px 24px',
            textAlign: 'center',
          }}>
            {/* Emoji + countdown arc */}
            <div
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, cursor: autoCount ? 'pointer' : 'default' }}
              onClick={() => autoCount !== null && cancelCountdown()}
              title={autoCount ? 'Tap to cancel auto-start' : undefined}
            >
              {autoCount !== null && autoCount > 0 && (
                <svg width={90} height={90} style={{ position: 'absolute', transform: 'rotate(-90deg)' }} aria-hidden="true">
                  <circle cx={45} cy={45} r={40} fill="none" stroke={D.bg3} strokeWidth={2.5} />
                  <circle cx={45} cy={45} r={40} fill="none" stroke={D.accent} strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - autoCount / 5)}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
              )}
              <div style={{ fontSize: 52, lineHeight: 1 }}>
                {donePhase === 'work' ? '🎉' : '💪'}
              </div>
            </div>

            {/* Eyebrow */}
            <div style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      10,
              color:         D.accent,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom:  8,
            }}>
              {donePhase === 'work' ? 'Focus complete' : 'Break complete'}
            </div>

            {/* Headline */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   18,
              fontWeight: 600,
              color:      D.ink,
              marginBottom: 8,
            }}>
              {donePhase === 'work' ? 'Nice work!' : 'Break over!'}
            </div>

            {/* Sub-message */}
            <div style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      11,
              color:         D.ink3,
              lineHeight:    1.6,
              maxWidth:      240,
              margin:        '0 auto',
              letterSpacing: '0.02em',
            }}>
              {donePhase === 'work'
                ? suggestLong
                  ? `Four sessions done — you've earned a ${BREAK_MINS.long}-minute rest.`
                  : `Take a quick ${BREAK_MINS.short}-minute break before round ${sessions + 1}.`
                : 'Ready for another round of focus?'
              }
            </div>

            {/* Session dots — work completion only */}
            {donePhase === 'work' && (
              <div style={{
                display:        'flex',
                justifyContent: 'center',
                gap:            12,
                marginTop:      24,
              }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    width:        12,
                    height:       12,
                    borderRadius: '50%',
                    background:   i < cyclePos ? D.accent : D.bg3,
                    border:       `1.5px solid ${i < cyclePos ? D.accent : D.rule}`,
                    transition:   'background .3s, border-color .3s',
                  }} />
                ))}
              </div>
            )}

            {/* XP earned note — task context only */}
            {donePhase === 'work' && xp > 0 && (
              <div style={{
                marginTop:     16,
                fontFamily:    'var(--font-mono)',
                fontSize:      10,
                color:         D.ink3,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                +{xp} XP when you mark this task complete
              </div>
            )}
          </div>

          {/* Done panel controls */}
          <div style={{ padding: '0 14px 16px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {donePhase === 'work' ? (
                <>
                  {/* Primary: start the break */}
                  <button
                    onClick={() => startPhase(nextBreak)}
                    style={{
                      flex: 1, height: 52, borderRadius: 14,
                      background: D.accent, color: '#f0ece4', border: 'none',
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', letterSpacing: '0.02em',
                    }}
                  >
                    {suggestLong ? `Long break · ${BREAK_MINS.long}m` : `Short break · ${BREAK_MINS.short}m`}
                  </button>
                  {/* Skip: back to idle work */}
                  <button
                    onClick={() => switchPhase('work')}
                    style={{
                      width: 80, height: 52, borderRadius: 14,
                      background: D.bg3, color: D.ink2,
                      border: `1px solid ${D.rule}`,
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      cursor: 'pointer', letterSpacing: '0.02em',
                    }}
                  >
                    Skip
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startPhase('work')}
                  style={{
                    flex: 1, height: 52, borderRadius: 14,
                    background: D.accent, color: '#f0ece4', border: 'none',
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '0.02em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Icons.play size={16} />
                  Start focus
                </button>
              )}
            </div>

            {/* 5s auto-flow countdown bar */}
            {autoCount !== null && autoCount > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 2, borderRadius: 1, background: D.bg3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 1, background: D.accent,
                    width: `${(autoCount / 5) * 100}%`,
                    transition: 'width 1s linear',
                  }} />
                </div>
                <div style={{
                  marginTop: 6, textAlign: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: D.ink3, letterSpacing: '0.1em',
                }}>
                  AUTO-STARTING IN {autoCount}S · TAP TO CANCEL
                </div>
              </div>
            )}
          </div>
        </>

      ) : (
      /* ════════════════════════════════════════════════════════════════
          NORMAL TIMER — ring + duration + controls
      ════════════════════════════════════════════════════════════════ */
        <>
          {/* Ring */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 10px' }}>
            <div style={{ position: 'relative', width: SZ, height: SZ }}>

              <svg
                width={SZ} height={SZ}
                viewBox={`0 0 ${SZ} ${SZ}`}
                style={{ transform: 'rotate(-90deg)' }}
                aria-hidden="true"
              >
                <circle cx={CX} cy={CY} r={R} fill="none" stroke={D.bg3} strokeWidth="3" />
                <circle
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={D.accent}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC - (pct / 100) * CIRC}
                  style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                />
              </svg>

              {/* Centre */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: D.ink3, letterSpacing: '0.14em',
                  textTransform: 'uppercase', marginBottom: 10,
                }}>
                  {PHASE_LABELS[phase].toUpperCase()}
                  {phase === 'work' && ` · SESSION ${sessions + 1}`}
                </div>

                {/* MM : SS */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: D.ink }}>
                  <span style={{
                    fontFamily:          'var(--font-mono)',
                    fontSize:            68,
                    fontWeight:          500,
                    lineHeight:          1,
                    fontFeatureSettings: "'tnum'",
                    letterSpacing:       '-0.03em',
                  }}>
                    {mm}
                  </span>

                  {/* Two-dot colon */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: D.ink3 }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: D.ink3 }} />
                  </div>

                  <span style={{
                    fontFamily:          'var(--font-mono)',
                    fontSize:            68,
                    fontWeight:          500,
                    lineHeight:          1,
                    fontFeatureSettings: "'tnum'",
                    letterSpacing:       '-0.03em',
                  }}>
                    {ss_}
                  </span>
                </div>

                {/* Elapsed · total */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: D.ink3, marginTop: 10, letterSpacing: '0.04em',
                }}>
                  {Math.floor(elapsed / 60)}m elapsed · {phaseTotalMins}m total
                </div>
              </div>
            </div>
          </div>

          {/* Session dots (work only) */}
          {phase === 'work' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: i < cyclePos ? D.accent : D.bg3,
                  border:     `1.5px solid ${i < cyclePos ? D.accent : D.rule}`,
                  transition: 'background .2s, border-color .2s',
                }} />
              ))}
            </div>
          )}

          {/* Duration controls (work only) */}
          {phase === 'work' && (
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: D.ink3, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  Duration
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: D.ink2, letterSpacing: '0.08em',
                }}>
                  {selMins}M{effort ? ` · ${EFFORT_SHORT[effort]}` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {CHIPS.map(m => {
                  const active = selMins === m
                  return (
                    <button key={m} onClick={() => changeSelMins(m)} style={{
                      flex: 1, padding: '10px 4px', borderRadius: 10,
                      background:  active ? D.ink : D.bg3,
                      color:       active ? D.bg  : D.ink2,
                      fontFamily:  'var(--font-mono)',
                      fontSize:    12,
                      fontWeight:  active ? 700 : 400,
                      border:      `1px solid ${active ? D.ink : D.rule}`,
                      cursor:      'pointer',
                      transition:  'all .12s',
                    }}>
                      {m}m
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: D.ink3, width: 16, flexShrink: 0 }}>5</span>
                <input
                  type="range" min={5} max={120} value={selMins}
                  onChange={e => handleSlider(Number(e.target.value))}
                  style={{ flex: 1, accentColor: D.accent, cursor: 'pointer', height: 4 }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: D.ink3, width: 28, flexShrink: 0, textAlign: 'right' }}>120</span>
              </div>
            </div>
          )}

          {/* Normal controls */}
          <div style={{ padding: '0 14px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={running ? pause : play}
              style={{
                flex: 1, height: 52, borderRadius: 14,
                background: D.bg3, color: D.ink,
                border:     `1px solid ${D.rule}`,
                display:    'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize:   15, fontWeight: 600, cursor: 'pointer',
                transition: 'background .15s',
              }}
            >
              {running ? <Icons.pause size={18} /> : <Icons.play size={18} />}
              {btnLabel}
            </button>

            <button onClick={addFive} style={{
              width: 60, height: 52, borderRadius: 14,
              background: D.bg3, color: D.ink2,
              border: `1px solid ${D.rule}`,
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              +5m
            </button>

            <button onClick={reset} aria-label="Reset timer" style={{
              width: 52, height: 52, borderRadius: 14,
              background: D.bg3, color: D.ink2,
              border: `1px solid ${D.rule}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Icons.reset size={16} />
            </button>
          </div>
        </>
      )}

    </div>
  )
}
