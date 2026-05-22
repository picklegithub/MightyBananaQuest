import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, createInboxItem } from '../data/db'
import { EFFORT_ORDER } from '../constants'
import { Icons } from './ui/Icons'
import { FieldRow } from './ui/FieldRow'
import { UnifiedDuePicker } from './ui/UnifiedDuePicker'
import { parseNL, nlSummary } from '../lib/nlParse'
import { makeId } from '../lib/makeId'
import type { Task } from '../types'

interface Props {
  onClose: () => void
  onExpand: (title: string) => void
  defaultCatId?: string
  defaultTitle?: string
  captureToInbox?: boolean
  onCaptured?: () => void
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

export function QuickCaptureSheet({
  onClose, onExpand, defaultCatId, defaultTitle,
  captureToInbox = false, onCaptured,
}: Props) {
  const [title,        setTitle]        = useState(defaultTitle ?? '')
  const [effort,       setEffort]       = useState<string>('s')
  const [catId,        setCatId]        = useState<string | null>(defaultCatId ?? null)
  const [due,          setDue]          = useState('')
  const [recurring,    setRecurring]    = useState<string | null>(null)
  const [time,         setTime]         = useState<string | undefined>(undefined)
  const [showSchedule, setShowSchedule] = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [listening,    setListening]    = useState(false)
  const [micError,     setMicError]     = useState<string | null>(null)
  const [wavePhase,    setWavePhase]    = useState(0)
  const [autoConfirmIn, setAutoConfirmIn] = useState<number | null>(null)

  const inputRef     = useRef<HTMLInputElement>(null)
  const recognRef    = useRef<SpeechRecognitionInstance | null>(null)
  const waveRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savingRef    = useRef(false)

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  useEffect(() => () => {
    recognRef.current?.stop()
    if (waveRef.current)      clearInterval(waveRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  useEffect(() => {
    if (!listening) { if (waveRef.current) clearInterval(waveRef.current); setWavePhase(0); return }
    waveRef.current = setInterval(() => setWavePhase(p => p + 1), 60)
    return () => { if (waveRef.current) clearInterval(waveRef.current) }
  }, [listening])

  // NL parse — drives field previews and auto-applies parsed tokens to state
  const parsed  = title.trim() ? parseNL(title, categories) : null
  const summary = parsed ? nlSummary(parsed, categories) : ''

  useEffect(() => {
    if (!parsed) return
    if (parsed.catId   && !defaultCatId) setCatId(parsed.catId)
    if (parsed.effort)                   setEffort(parsed.effort)
    if (parsed.due)                      setDue(parsed.due)
    if (parsed.time)                     setTime(parsed.time)
    if (parsed.recurring)                setRecurring(parsed.recurring)
  }, [parsed?.catId, parsed?.effort, parsed?.due, parsed?.time, parsed?.recurring])

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function doSave(text: string) {
    const trimmed = text.trim()
    if (!trimmed || savingRef.current || saved) return
    savingRef.current = true
    setSaveError(null)

    try {
      if (captureToInbox) {
        await createInboxItem({ text: trimmed, source: 'capture' })
        onCaptured?.()
      } else {
        const p = parseNL(trimmed, categories)
        const task: Task = {
          id:        makeId(),
          title:     p.title || trimmed,
          cat:       catId ?? p.catId ?? 'inbox',
          effort:    (p.effort ?? effort) as Task['effort'],
          due:       p.due ?? due,
          
          recurring,
          time,
          done:      false,
          streak:    0,
          sub:       [],
        }
        await addTask(task)
      }
      setSaved(true)
      setTimeout(onClose, 600)
    } catch (err) {
      console.error('[QuickCapture]', err)
      setSaveError(err instanceof Error ? err.message : String(err))
      savingRef.current = false
    }
  }

  // ── Auto-confirm after voice transcription ───────────────────────────────────
  function triggerAutoConfirm(text: string) {
    let count = 2
    setAutoConfirmIn(count)
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(countdownRef.current!); countdownRef.current = null
        setAutoConfirmIn(null)
        doSave(text)
      } else {
        setAutoConfirmIn(count)
      }
    }, 1000)
  }

  function cancelAutoConfirm() {
    if (!countdownRef.current) return
    clearInterval(countdownRef.current); countdownRef.current = null
    setAutoConfirmIn(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  // ── Voice hold-to-speak ──────────────────────────────────────────────────────
  function startHold() {
    cancelAutoConfirm()
    setMicError(null)
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { setMicError('unsupported'); return }
    if (recognRef.current) { recognRef.current.stop(); recognRef.current = null }
    const r = new SR()
    r.lang = 'en-AU'; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0][0].transcript
      setTitle(t); setListening(false); triggerAutoConfirm(t)
    }
    r.onerror = (e: any) => {
      setListening(false)
      const c: string = e?.error ?? ''
      if (c !== 'no-speech' && c !== 'aborted') setMicError(c || 'unknown')
    }
    r.onend = () => setListening(false)
    recognRef.current = r; r.start(); setListening(true)
  }

  function endHold() { recognRef.current?.stop() }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedCat = catId ? categories.find(c => c.id === catId) : null
  const destination = selectedCat ? selectedCat.name : captureToInbox ? 'Inbox' : 'Backlog'
  const EFFORT_LABEL: Record<string, string> = { xs: '5m', s: '15m', m: '1h', l: '2h', xl: '6h', xxl: '1d' }
  const EFFORT_NAME:  Record<string, string> = { xs: 'Micro', s: 'Small', m: 'Medium', l: 'Long', xl: 'Mammoth', xxl: 'Gargantuan' }
  const BARS = 20
  const waveH = (i: number) => 4 + 20 * Math.abs(Math.sin(wavePhase * 0.15 + i * 0.42))

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '8px 20px 44px', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="t-display" style={{ fontSize: 18 }}>Capture</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 2 }}>
              → {destination.toUpperCase()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
              onTouchStart={e => { e.preventDefault(); startHold() }}
              onTouchEnd={e => { e.preventDefault(); endHold() }}
              onTouchCancel={e => { e.preventDefault(); endHold() }}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: listening ? 'var(--warn)' : 'var(--paper-2)',
                color:      listening ? 'white'        : micError ? 'var(--warn)' : 'var(--ink-3)',
                border:    `1px solid ${listening ? 'var(--warn)' : 'var(--rule)'}`,
                boxShadow:  listening ? '0 0 0 4px color-mix(in srgb, var(--warn) 20%, transparent)' : 'none',
                cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
                transition: 'background .12s, box-shadow .12s',
              }}
            >
              <Icons.mic size={16} />
            </button>
            <button type="button" onClick={onClose} style={{ color: 'var(--ink-3)' }}>
              <Icons.close size={20} />
            </button>
          </div>
        </div>

        {/* Waveform */}
        {listening && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, height: 32, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warn)', marginRight: 6 }}>🎙</span>
            {Array.from({ length: BARS }, (_, i) => (
              <div key={i} style={{ width: 3, height: waveH(i), borderRadius: 2, background: 'var(--warn)', opacity: 0.8, transition: 'height 0.06s ease' }} />
            ))}
          </div>
        )}

        {/* Input — form wrapper triggers mobile keyboard's Go/Return button */}
        <form onSubmit={e => { e.preventDefault(); doSave(inputRef.current?.value ?? title) }}>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSave(inputRef.current?.value ?? title) } }}
            placeholder={listening ? 'Listening… release to capture' : 'What needs doing?  Try "call dentist tomorrow #health"'}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 12, marginBottom: summary ? 6 : 14,
              border: `1px solid ${listening ? 'var(--warn)' : autoConfirmIn !== null ? 'var(--accent)' : 'var(--rule)'}`,
              background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)',
              transition: 'border-color .15s',
            }}
          />
          {/* Visually hidden submit — activates mobile keyboard's Go/Return button */}
          <button type="submit" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, overflow: 'hidden' }} />
        </form>

        {/* Auto-confirm banner */}
        {autoConfirmIn !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 14px', borderRadius: 10, marginBottom: 4,
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
              <Icons.check size={13} sw={2.5} /> Auto-saving in {autoConfirmIn}s…
            </div>
            <button type="button" onClick={cancelAutoConfirm} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent' }}>
              Edit
            </button>
          </div>
        )}

        {/* NL field previews */}
        {title.trim() && (
          <div style={{ marginTop: 4 }}>
            {parsed?.title && parsed.title !== title.trim() && (
              <FieldRow label="TITLE" value={parsed.title} />
            )}
            <FieldRow
              label="DUE" icon="calendar"
              value={(due || 'No date') + (recurring ? ` · ${recurring}` : '') + (time ? ` · ${time}` : '')}
              onTap={() => setShowSchedule(true)}
            />
            <FieldRow
              label="AREA"
              icon={selectedCat ? (selectedCat.icon as string) : 'inbox'}
              iconHue={selectedCat?.hue}
              value={selectedCat ? selectedCat.name : 'Inbox (no area)'}
              onTap={() => {
                if (!categories.length) return
                const idx = catId ? categories.findIndex(c => c.id === catId) : -1
                setCatId(idx === categories.length - 1 ? null : categories[(idx + 1) % categories.length].id)
              }}
            />
            <FieldRow
              label="EFFORT" icon="bolt"
              value={`${EFFORT_LABEL[effort]} · ${EFFORT_NAME[effort] ?? effort}`}
              onTap={() => {
                const idx = EFFORT_ORDER.indexOf(effort as 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl')
                setEffort(EFFORT_ORDER[(idx + 1) % EFFORT_ORDER.length])
              }}
            />
          </div>
        )}

        {/* Mic hint / error */}
        {!title.trim() && (
          <div style={{ marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', lineHeight: 1.5 }}>
            {micError ? (
              <span style={{ color: 'var(--warn)' }}>
                {micError === 'unsupported'    ? 'Voice not supported in this browser (try Chrome or Safari).'
                : micError === 'not-allowed' || micError === 'service-not-allowed' ? 'Microphone blocked — check browser or OS settings.'
                : micError === 'audio-capture' ? 'No microphone found.'
                : micError === 'network'       ? 'Speech service unavailable — check your connection.'
                :                               'Voice input failed — tap the mic to try again.'}
              </span>
            ) : !listening && autoConfirmIn === null ? (
              <span style={{ color: 'var(--ink-4)' }}>Hold 🎙 to speak — release to capture</span>
            ) : null}
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div style={{ padding: '9px 14px', borderRadius: 10, marginBottom: 8, background: 'color-mix(in srgb, var(--warn) 12%, transparent)', border: '1px solid var(--warn)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)', letterSpacing: '0.04em' }}>
            {saveError}
          </div>
        )}

        {/* Schedule sheet */}
        {showSchedule && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowSchedule(false) }}
          >
            <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ flexShrink: 0, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--rule)' }}>
                <button type="button" onClick={() => setShowSchedule(false)} style={{ color: 'var(--ink-3)', fontSize: 13 }}>Cancel</button>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em' }}>SCHEDULE</div>
                <button type="button" onClick={() => setShowSchedule(false)} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Done</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
                <UnifiedDuePicker due={due} recurring={recurring} time={time} onChange={(d, r, t) => { setDue(d); setRecurring(r); setTime(t) }} />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => doSave(inputRef.current?.value ?? title)}
            disabled={!title.trim() || saved}
            style={{
              flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600, fontSize: 14,
              background: saved ? 'var(--accent-soft)' : title.trim() ? 'var(--ink)' : 'var(--paper-3)',
              color:      saved ? 'var(--ink)'         : title.trim() ? 'var(--paper)' : 'var(--ink-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all .15s',
            }}
          >
            {saved
              ? <><Icons.check size={16} sw={2.5} /> Saved!</>
              : catId
                ? <><Icons.plus size={16} /> Add to {selectedCat?.name}</>
                : captureToInbox
                  ? <><Icons.inbox size={16} /> To Inbox</>
                  : <><Icons.plus size={16} /> Add task</>
            }
          </button>
          <button
            type="button"
            onClick={() => onExpand(title)}
            style={{
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid var(--rule)', background: 'var(--paper-2)', color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            <Icons.edit size={14} /> MORE
          </button>
        </div>
      </div>
    </div>
  )
}
