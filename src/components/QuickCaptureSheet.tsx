import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, createInboxItem } from '../data/db'
import { EFFORT_ORDER } from '../constants'
import { Icons } from './ui/Icons'
import { UnifiedDuePicker } from './ui/UnifiedDuePicker'
import { parseNL, nlSummary } from '../lib/nlParse'
import type { Task } from '../types'

interface Props {
  onClose: () => void
  onExpand: (title: string) => void   // open full AddTaskSheet with prefilled title
  defaultCatId?: string               // pre-select area (e.g. from CategoryScreen)
  defaultTitle?: string               // pre-fill title (e.g. from Inbox)
  captureToInbox?: boolean            // when true, save to inboxItems instead of tasks
  onCaptured?: () => void             // called after inbox save
}

// ── Web Speech API types ──────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

function ParsedFieldRow({ label, value, icon, iconHue, onTap }: {
  label: string
  value: string
  icon?: string
  iconHue?: number
  onTap?: () => void
}) {
  const I = icon ? (Icons[icon as keyof typeof Icons] ?? null) : null
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%', padding: '10px 0',
        display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left',
        background: 'none', border: 'none', borderBottom: '1px solid var(--rule)',
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <div className="eyebrow">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {I && (
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: iconHue !== undefined ? `hsl(${iconHue},35%,92%)` : 'var(--paper-2)',
            color: iconHue !== undefined ? `hsl(${iconHue},55%,42%)` : 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I size={13} />
          </div>
        )}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
        {onTap && <Icons.edit size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />}
      </div>
    </button>
  )
}

export function QuickCaptureSheet({ onClose, onExpand, defaultCatId, defaultTitle, captureToInbox = false, onCaptured }: Props) {
  const [title,         setTitle]         = useState(defaultTitle ?? '')
  const [effort,        setEffort]        = useState<string>('s')
  const [catId,         setCatId]         = useState<string | null>(defaultCatId ?? null)
  const [due,           setDue]           = useState('')
  const [recurring,     setRecurring]     = useState<string | null>(null)
  const [time,          setTime]          = useState<string | undefined>(undefined)
  const [showSchedule,  setShowSchedule]  = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [listening,     setListening]     = useState(false)
  const [micError,      setMicError]      = useState<string | null>(null)  // null = no error, string = error code
  const [wavePhase,     setWavePhase]     = useState(0)
  const [autoConfirmIn, setAutoConfirmIn] = useState<number | null>(null)  // null = not counting

  const inputRef      = useRef<HTMLInputElement>(null)
  const recognRef     = useRef<SpeechRecognitionInstance | null>(null)
  const waveTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  // Cleanup all timers + recognition on unmount
  useEffect(() => () => {
    recognRef.current?.stop()
    if (waveTimerRef.current)  clearInterval(waveTimerRef.current)
    if (countdownRef.current)  clearInterval(countdownRef.current)
  }, [])

  // Animate waveform bars while listening
  useEffect(() => {
    if (!listening) {
      if (waveTimerRef.current) clearInterval(waveTimerRef.current)
      setWavePhase(0)
      return
    }
    waveTimerRef.current = setInterval(() => setWavePhase(p => p + 1), 60)
    return () => { if (waveTimerRef.current) clearInterval(waveTimerRef.current) }
  }, [listening])

  // ── NL parse on every title change ───────────────────────────────────────
  const parsed  = title.trim() ? parseNL(title, categories) : null
  const summary = parsed && categories ? nlSummary(parsed, categories) : ''

  // Auto-apply parsed fields to state (non-destructive)
  useEffect(() => {
    if (!parsed) return
    if (parsed.catId && !defaultCatId) setCatId(parsed.catId)
    if (parsed.effort)                 setEffort(parsed.effort)
    if (parsed.due)                    setDue(parsed.due)
    if (parsed.time)                   setTime(parsed.time)
    if (parsed.recurring)              setRecurring(parsed.recurring)
  }, [parsed?.catId, parsed?.effort, parsed?.due, parsed?.time, parsed?.recurring])

  function reset() { setTitle(''); setEffort('s'); setCatId(defaultCatId ?? null); setDue(''); setRecurring(null); setTime(undefined); setSaved(false) }

  // ── Capture — accepts an explicit text so auto-confirm avoids stale closure ──
  async function handleCapture(overrideTitle?: string) {
    const trimmed = (overrideTitle ?? title).trim()
    if (!trimmed) return

    if (captureToInbox) {
      await createInboxItem({ text: trimmed, source: 'capture' })
      setSaved(true)
      onCaptured?.()
      setTimeout(() => { reset(); onClose() }, 600)
      return
    }

    const p = parseNL(trimmed, categories)
    const effectiveCatId = catId ?? p.catId ?? null

    const task: Task = {
      id:        `t${Date.now()}`,
      title:     p.title || trimmed,
      cat:       effectiveCatId ?? 'inbox',
      effort:    (p.effort ?? effort) as Task['effort'],
      due:       p.due ?? due,
      quad:      p.quad ?? 'q2',
      recurring: recurring,
      time:      time,
      done:      false,
      streak:    0,
      sub:       [],
    }
    await addTask(task)
    setSaved(true)
    setTimeout(() => { reset(); onClose() }, 600)
  }

  // ── Auto-confirm countdown (12.2) ────────────────────────────────────────
  function triggerAutoConfirm(text: string) {
    let count = 2
    setAutoConfirmIn(count)
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(countdownRef.current!)
        countdownRef.current = null
        setAutoConfirmIn(null)
        handleCapture(text)
      } else {
        setAutoConfirmIn(count)
      }
    }, 1000)
  }

  function cancelAutoConfirm() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setAutoConfirmIn(null)
    // Keep title filled — user can edit and save manually
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  // ── Hold-to-speak (12.1 + 12.3) ─────────────────────────────────────────
  function startHold() {
    cancelAutoConfirm()
    setMicError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: (new () => SpeechRecognitionInstance) | undefined = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { setMicError('unsupported'); return }

    // Stop any prior session
    if (recognRef.current) { recognRef.current.stop(); recognRef.current = null }

    const recog = new SR()
    recog.lang           = 'en-AU'
    recog.interimResults = false
    recog.maxAlternatives = 1

    recog.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setTitle(transcript)        // fill the input (12.2 — parsed preview)
      setListening(false)
      triggerAutoConfirm(transcript)
    }
    recog.onerror = (e: any) => {
      setListening(false)
      const code: string = e?.error ?? ''
      // 'no-speech' = user held but didn't speak; 'aborted' = we called stop()
      if (code !== 'no-speech' && code !== 'aborted') {
        setMicError(code || 'unknown')
      }
    }
    recog.onend   = () => setListening(false)

    recognRef.current = recog
    recog.start()
    setListening(true)
  }

  function endHold() {
    // Stop recognition → fires onresult if speech was detected, then onend
    recognRef.current?.stop()
  }

  // ── Derived display ───────────────────────────────────────────────────────
  const selectedCat  = catId ? categories.find(c => c.id === catId) : null
  const destination  = selectedCat ? selectedCat.name : 'Inbox'
  const effortLabels: Record<string, string> = {
    xs: '5m', s: '15m', m: '1h', l: '2h', xl: '6h', xxl: '1d',
  }

  // ── Waveform bar heights (12.1) ───────────────────────────────────────────
  const BARS = 20
  function waveBarH(i: number): number {
    return 4 + 20 * Math.abs(Math.sin(wavePhase * 0.15 + i * 0.42))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '8px 20px 44px', width: '100%' }}
           onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="t-display" style={{ fontSize: 18 }}>Capture</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 2 }}>
              → {destination.toUpperCase()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

            {/* ── Mic button — hold-to-speak (12.1) ── */}
            <button
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={e => { e.preventDefault(); startHold() }}
              onTouchEnd={e => { e.preventDefault(); endHold() }}
              onTouchCancel={e => { e.preventDefault(); endHold() }}
              title={listening ? 'Release to capture' : 'Hold to speak'}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background:  listening        ? 'var(--warn)'   : 'var(--paper-2)',
                color:       listening        ? 'white'         : micError ? 'var(--warn)' : 'var(--ink-3)',
                border:     `1px solid ${listening ? 'var(--warn)' : 'var(--rule)'}`,
                boxShadow:   listening        ? '0 0 0 4px color-mix(in srgb, var(--warn) 20%, transparent)' : 'none',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                transition: 'background .12s, box-shadow .12s',
              }}
            >
              <Icons.mic size={16} />
            </button>

            <button onClick={onClose} style={{ color: 'var(--ink-3)' }}>
              <Icons.close size={20} />
            </button>
          </div>
        </div>

        {/* ── Live waveform (12.1) — visible while listening ── */}
        {listening && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 2, height: 32, marginBottom: 10, padding: '0 8px',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
              color: 'var(--warn)', marginRight: 6, flexShrink: 0,
            }}>🎙</span>
            {Array.from({ length: BARS }, (_, i) => (
              <div key={i} style={{
                width: 3, height: waveBarH(i),
                borderRadius: 2, background: 'var(--warn)', opacity: 0.8,
                transition: 'height 0.06s ease',
              }} />
            ))}
          </div>
        )}

        {/* Title input */}
        <div style={{ position: 'relative', marginBottom: summary ? 6 : 14 }}>
          <input
            ref={inputRef}
            value={title}
            onChange={e => { cancelAutoConfirm(); setTitle(e.target.value) }}
            onKeyDown={e => e.key === 'Enter' && title.trim() && handleCapture()}
            placeholder={listening ? 'Listening… release to capture' : 'What needs doing? Try "call dentist tomorrow #health"'}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 12,
              border: `1px solid ${listening ? 'var(--warn)' : autoConfirmIn !== null ? 'var(--accent)' : 'var(--rule)'}`,
              background: 'var(--paper-2)',
              fontSize: 15, color: 'var(--ink)',
              transition: 'border-color .15s',
            }}
          />
        </div>

        {/* ── Auto-confirm countdown ── */}
        {autoConfirmIn !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 14px', borderRadius: 10, marginBottom: 4,
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
              <Icons.check size={13} sw={2.5} />
              Auto-saving in {autoConfirmIn}s…
            </div>
            <button
              onClick={cancelAutoConfirm}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 6,
                border: '1px solid var(--accent)', background: 'transparent',
              }}
            >
              Edit
            </button>
          </div>
        )}

        {/* ── Parsed field rows — shown when title has content ── */}
        {title.trim() && (
          <div style={{ marginTop: 4 }}>
            {/* TITLE row — shown only when NL cleaned the title */}
            {parsed && parsed.title && parsed.title !== title.trim() && (
              <ParsedFieldRow label="TITLE" value={parsed.title} />
            )}

            {/* DUE — taps open schedule sheet */}
            <ParsedFieldRow
              label="DUE"
              icon="calendar"
              value={(due || 'No date') + (recurring ? ` · ${recurring}` : '') + (time ? ` · ${time}` : '')}
              onTap={() => setShowSchedule(true)}
            />

            {/* AREA */}
            <ParsedFieldRow
              label="AREA"
              icon={selectedCat ? (selectedCat.icon as string) : 'inbox'}
              iconHue={selectedCat?.hue}
              value={selectedCat ? selectedCat.name : 'Inbox (no area)'}
              onTap={() => {
                if (categories.length === 0) return
                const idx = catId ? categories.findIndex(c => c.id === catId) : -1
                const next = categories[(idx + 1) % categories.length]
                setCatId(idx === categories.length - 1 ? null : next.id)
              }}
            />

            {/* EFFORT */}
            <ParsedFieldRow
              label="EFFORT"
              icon="bolt"
              value={`${effortLabels[effort]} · ${
                { xs: 'Micro', s: 'Small', m: 'Medium', l: 'Long', xl: 'Mammoth', xxl: 'Gargantuan' }[effort] ?? effort
              }`}
              onTap={() => {
                const idx = EFFORT_ORDER.indexOf(effort as 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl')
                setEffort(EFFORT_ORDER[(idx + 1) % EFFORT_ORDER.length])
              }}
            />
          </div>
        )}

        {/* Mic hold hint + error */}
        {!title.trim() && (
          <div style={{ marginBottom: 10 }}>
            {micError && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warn)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
                {micError === 'unsupported'
                  ? 'Voice not supported in this browser (try Chrome or Safari).'
                  : micError === 'not-allowed' || micError === 'service-not-allowed'
                  ? 'Microphone blocked — check your browser or OS settings.'
                  : micError === 'audio-capture'
                  ? 'No microphone found — check your device.'
                  : micError === 'network'
                  ? 'Speech service unavailable — check your connection.'
                  : 'Voice input failed — tap the mic to try again.'}
              </div>
            )}
            {!micError && !listening && autoConfirmIn === null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                Hold 🎙 to speak — release to capture
              </div>
            )}
          </div>
        )}

        {/* ── Schedule sheet ── */}
        {showSchedule && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowSchedule(false) }}
          >
            <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                 onClick={e => e.stopPropagation()}>
              <div style={{ flexShrink: 0, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--rule)' }}>
                <button onClick={() => setShowSchedule(false)} style={{ color: 'var(--ink-3)', fontSize: 13 }}>Cancel</button>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em' }}>SCHEDULE</div>
                <button onClick={() => setShowSchedule(false)} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Done</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
                <UnifiedDuePicker
                  due={due}
                  recurring={recurring}
                  time={time}
                  onChange={(d, r, t) => { setDue(d); setRecurring(r); setTime(t) }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleCapture()}
            disabled={!title.trim() || saved}
            style={{
              flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600, fontSize: 14,
              background: saved ? 'var(--accent-soft)' : title.trim() ? 'var(--ink)' : 'var(--paper-3)',
              color: saved ? 'var(--ink)' : title.trim() ? 'var(--paper)' : 'var(--ink-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all .15s',
            }}
          >
            {saved
              ? <><Icons.check size={16} sw={2.5} /> Saved!</>
              : catId
                ? <><Icons.plus size={16} /> Add to {selectedCat?.name}</>
                : <><Icons.inbox size={16} /> To Inbox</>
            }
          </button>

          {/* Expand to full form */}
          <button
            onClick={() => onExpand(title)}
            title="More options"
            style={{
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid var(--rule)', background: 'var(--paper-2)',
              color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            <Icons.edit size={14} /> MORE
          </button>
        </div>
      </div>
    </div>
  )
}
