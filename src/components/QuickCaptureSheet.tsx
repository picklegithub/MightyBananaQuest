import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask } from '../data/db'
import { EFFORT_ORDER } from '../constants'
import { Icons } from './ui/Icons'
import { parseNL, nlSummary } from '../lib/nlParse'
import type { Task } from '../types'

interface Props {
  onClose: () => void
  onExpand: (title: string) => void   // open full AddTaskSheet with prefilled title
  defaultCatId?: string               // pre-select area (e.g. from CategoryScreen)
  defaultTitle?: string               // pre-fill title (e.g. from Inbox)
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
  onerror: (() => void) | null
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

export function QuickCaptureSheet({ onClose, onExpand, defaultCatId, defaultTitle }: Props) {
  const [title,     setTitle]     = useState(defaultTitle ?? '')
  const [effort,    setEffort]    = useState<string>('s')
  const [catId,     setCatId]     = useState<string | null>(defaultCatId ?? null)
  const [saved,     setSaved]     = useState(false)
  const [listening, setListening] = useState(false)
  const [micError,  setMicError]  = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const recognRef = useRef<SpeechRecognitionInstance | null>(null)

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])
  useEffect(() => () => { recognRef.current?.stop() }, [])

  // ── NL parse on every title change ───────────────────────────────────────
  const parsed  = title.trim() ? parseNL(title, categories) : null
  const summary = parsed && categories ? nlSummary(parsed, categories) : ''

  // Auto-apply parsed area and effort to pickers (non-destructive)
  useEffect(() => {
    if (!parsed) return
    if (parsed.catId && !defaultCatId) setCatId(parsed.catId)
    if (parsed.effort)                 setEffort(parsed.effort)
  }, [parsed?.catId, parsed?.effort])

  function reset() { setTitle(''); setEffort('s'); setCatId(defaultCatId ?? null); setSaved(false) }

  async function handleCapture() {
    const trimmed = title.trim()
    if (!trimmed) return

    // Merge NL parse with manual picker state
    const p = parseNL(trimmed, categories)

    const task: Task = {
      id:        `t${Date.now()}`,
      title:     p.title || trimmed,
      cat:       catId ?? p.catId ?? 'inbox',
      effort:    (p.effort ?? effort) as Task['effort'],
      due:       p.due ?? (catId ? 'Today' : ''),
      ctx:       '@anywhere',
      quad:      p.quad ?? 'q2',
      recurring: null,
      done:      false,
      streak:    0,
      sub:       [],
    }
    await addTask(task)

    setSaved(true)
    setTimeout(() => { reset(); onClose() }, 600)
  }

  // ── Voice input ───────────────────────────────────────────────────────────
  function toggleVoice() {
    setMicError(false)
    const SR: (new () => SpeechRecognitionInstance) | undefined = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { setMicError(true); return }

    if (listening) {
      recognRef.current?.stop()
      setListening(false)
      return
    }

    const recog: SpeechRecognitionInstance = new SR()
    recog.lang        = 'en-AU'
    recog.interimResults = false
    recog.maxAlternatives = 1

    recog.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setTitle(transcript)
      setListening(false)
    }
    recog.onerror = () => { setListening(false); setMicError(true) }
    recog.onend   = () => setListening(false)

    recognRef.current = recog
    recog.start()
    setListening(true)
  }

  const selectedCat  = catId ? categories.find(c => c.id === catId) : null
  const destination  = selectedCat ? selectedCat.name : 'Inbox'
  const effortLabels: Record<string, string> = {
    xs: '5m', s: '15m', m: '1h', l: '2h', xl: '6h', xxl: '1d',
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
            {/* Voice button */}
            <button
              onClick={toggleVoice}
              title={listening ? 'Stop listening' : 'Voice input'}
              style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: listening ? 'var(--warn)' : 'var(--paper-2)',
                color:      listening ? 'white' : micError ? 'var(--warn)' : 'var(--ink-3)',
                border: `1px solid ${listening ? 'var(--warn)' : 'var(--rule)'}`,
                animation: listening ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            >
              <Icons.mic size={16} />
            </button>
            <button onClick={onClose} style={{ color: 'var(--ink-3)' }}>
              <Icons.close size={20} />
            </button>
          </div>
        </div>

        {/* Title + NL hint */}
        <div style={{ position: 'relative', marginBottom: summary ? 6 : 14 }}>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && title.trim() && handleCapture()}
            placeholder={listening ? '🎙 Listening…' : 'What needs doing? Try "call dentist tomorrow #health"'}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 12,
              border: `1px solid ${listening ? 'var(--warn)' : 'var(--rule)'}`,
              background: 'var(--paper-2)',
              fontSize: 15, color: 'var(--ink)',
              transition: 'border-color .15s',
            }}
          />
        </div>

        {/* NL parse summary */}
        {summary && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
            letterSpacing: '0.06em', marginBottom: 12, paddingLeft: 4,
          }}>
            ✦ {summary}
          </div>
        )}

        {/* Effort — compact pill row */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {EFFORT_ORDER.map(k => (
            <button key={k} onClick={() => setEffort(k)} style={{
              flex: 1, padding: '7px 2px', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.02em',
              background: effort === k ? 'var(--ink)' : 'var(--paper-2)',
              color: effort === k ? 'var(--paper)' : 'var(--ink-3)',
              border: '1px solid', borderColor: effort === k ? 'var(--ink)' : 'var(--rule)',
            }}>
              {effortLabels[k]}
            </button>
          ))}
        </div>

        {/* Area — optional */}
        {categories.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 8 }}>
              AREA (OPTIONAL)
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setCatId(catId === c.id ? null : c.id)} style={{
                  padding: '5px 11px', borderRadius: 20, fontSize: 11,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: catId === c.id ? `hsl(${c.hue},55%,42%)` : 'var(--paper-2)',
                  color: catId === c.id ? 'white' : 'var(--ink-2)',
                  border: '1px solid', borderColor: catId === c.id ? 'transparent' : 'var(--rule)',
                  transition: 'all .15s',
                }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* mic error nudge */}
        {micError && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warn)', marginBottom: 10, letterSpacing: '0.04em' }}>
            Voice input isn't available in this browser.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCapture}
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
