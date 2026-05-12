import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as chrono from 'chrono-node'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask } from '../data/db'
import { Icons } from './ui/Icons'
import type { Task, EffortKey } from '../types'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'listening' | 'parsed' | 'unsupported' | 'denied' | 'no-mic' | 'offline'

interface Parsed {
  title: string
  due:    string | null        // ISO 'YYYY-MM-DD' or friendly string
  dueHint: string | null       // excerpt that triggered the date
  catId:  string | null
  catName: string | null
  catHue:  number | null
  effort: EffortKey
  effortHint: string | null
}

interface Props {
  onClose: () => void
  onExpand: (parsed: Parsed) => void   // hand off to full AddTaskSheet
}

// ── Speech API feature detection ──────────────────────────────────────────────

const SpeechRecognitionCtor: (new () => any) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

// ── Effort keyword map ────────────────────────────────────────────────────────

const EFFORT_MAP: { re: RegExp; key: EffortKey; label: string; mins: string }[] = [
  { re: /\b(tiny|xs|extra small|trivial)\b/i,          key: 'xs', label: 'Tiny',   mins: '5 min'  },
  { re: /\b(small|quick|brief|s\b|short)\b/i,          key: 's',  label: 'Small',  mins: '15 min' },
  { re: /\b(medium|moderate|average|normal)\b/i,        key: 'm',  label: 'Medium', mins: '30 min' },
  { re: /\b(large|big|long|l\b|sizeable)\b/i,           key: 'l',  label: 'Large',  mins: '1 hr'   },
  { re: /\b(huge|xl|extra large|substantial)\b/i,       key: 'xl', label: 'Huge',   mins: '2 hr'   },
  { re: /\b(massive|enormous|xxl|all day|epic)\b/i,     key: 'xxl',label: 'Massive','mins': '4+ hr' },
]

// ── Parsing ───────────────────────────────────────────────────────────────────

function parseTranscript(
  raw: string,
  categories: { id: string; name: string; hue: number }[]
): Parsed {
  let text = raw.trim()

  // Strip leading "add" / "create" / "new" / "remind me to" filler
  text = text.replace(/^(add|create|new|remind me to|task)\s+/i, '')

  // ── Date via chrono-node ──
  const chronoResults = chrono.parse(text, new Date(), { forwardDate: true })
  let due: string | null = null
  let dueHint: string | null = null
  let titleText = text

  if (chronoResults.length > 0) {
    const r = chronoResults[0]
    const d = r.start.date()
    due = d.toISOString().slice(0, 10)
    dueHint = `from "${r.text}"`
    // Remove the date phrase from the title
    titleText = (text.slice(0, r.index) + text.slice(r.index + r.text.length)).trim()
    // Clean up leftover prepositions at the seam
    titleText = titleText.replace(/\s+(on|by|at|for|in|before|after)\s*$/i, '').trim()
    titleText = titleText.replace(/\s+(on|by|at|for|in)\s+/i, ' ').trim()
  }

  // ── Category / area matching ──
  let catId: string | null = null
  let catName: string | null = null
  let catHue: number | null = null

  for (const cat of categories) {
    const re = new RegExp(`\\b${cat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(text)) {
      catId   = cat.id
      catName = cat.name
      catHue  = cat.hue
      titleText = titleText.replace(re, '').trim()
      // Clean up trailing/leading connectors
      titleText = titleText.replace(/\s*,?\s*(in|for|under|to|on)\s*$/i, '').trim()
      break
    }
  }

  // ── Effort keyword ──
  let effort: EffortKey = 'm'
  let effortHint: string | null = null

  for (const e of EFFORT_MAP) {
    const m = text.match(e.re)
    if (m) {
      effort     = e.key
      effortHint = `from "${m[0]}"`
      titleText  = titleText.replace(e.re, '').trim()
      break
    }
  }

  // ── Clean title ──
  // Capitalise first letter, remove duplicate spaces, trim trailing punctuation
  titleText = titleText.replace(/\s+/g, ' ').trim()
  titleText = titleText.replace(/[,\s]+$/, '').trim()
  if (titleText.length > 0) {
    titleText = titleText[0].toUpperCase() + titleText.slice(1)
  } else {
    // Fallback: use full transcript as title
    titleText = raw.trim()
    if (titleText.length > 0) titleText = titleText[0].toUpperCase() + titleText.slice(1)
  }

  return { title: titleText, due, dueHint, catId, catName, catHue, effort, effortHint }
}

function formatDue(iso: string | null): string {
  if (!iso) return ''
  const d   = new Date(iso + 'T12:00:00')
  const now = new Date()
  const diffDays = Math.round((d.getTime() - now.setHours(0,0,0,0)) / 86400000)
  if (diffDays === 0)  return 'Today'
  if (diffDays === 1)  return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

const EFFORT_LABELS: Record<EffortKey, { label: string; mins: string }> = {
  xs:  { label: 'Tiny',    mins: '5 min'  },
  s:   { label: 'Small',   mins: '15 min' },
  m:   { label: 'Medium',  mins: '30 min' },
  l:   { label: 'Large',   mins: '1 hr'   },
  xl:  { label: 'Huge',    mins: '2 hr'   },
  xxl: { label: 'Massive', mins: '4+ hr'  },
}

// ── Waveform bar heights (static — animates via CSS) ──────────────────────────

const BARS = [0.35, 0.65, 0.85, 1, 0.80, 0.55, 0.30, 0.50, 0.70, 0.90, 0.65, 0.35]

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceCapture({ onClose, onExpand }: Props) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  const [phase,       setPhase]       = useState<Phase>(() => SpeechRecognitionCtor ? 'listening' : 'unsupported')
  const [transcript,  setTranscript]  = useState('')
  const [interim,     setInterim]     = useState('')
  const [parsed,      setParsed]      = useState<Parsed | null>(null)
  const [countdown,   setCountdown]   = useState(3)
  const [saved,       setSaved]       = useState(false)

  const recogRef      = useRef<any>(null)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  // Tracks deliberate user stop so onend doesn't restart
  const stoppedRef    = useRef(false)

  // ── Start listening (restarts on natural session end) ─────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) return
    stoppedRef.current = false

    const recog = new SpeechRecognitionCtor()
    recog.lang            = 'en-AU'
    recog.interimResults  = true
    recog.continuous      = false   // iOS doesn't support continuous
    recog.maxAlternatives = 1
    recogRef.current = recog

    recog.onresult = (e: any) => {
      let final = '', inter = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else inter += t
      }
      if (final) setTranscript(prev => prev + final)
      setInterim(inter)
    }

    recog.onerror = (e: any) => {
      const code: string = e.error ?? ''
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        stoppedRef.current = true
        setPhase('denied')
      } else if (code === 'audio-capture') {
        stoppedRef.current = true
        setPhase('no-mic')
      } else if (code === 'network') {
        stoppedRef.current = true
        setPhase('offline')
      } else if (code === 'no-speech') {
        // Browser timed out on silence — restart transparently
        if (!stoppedRef.current) setTimeout(() => startListening(), 200)
      }
      // 'aborted' means we called stop() ourselves — ignore
    }

    recog.onend = () => {
      setInterim('')
      // With continuous:false the browser ends the session after each utterance
      // or on silence timeout. Restart unless the user deliberately stopped.
      if (!stoppedRef.current) {
        setTimeout(() => startListening(), 150)
      }
    }

    recog.start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'listening') startListening()
    return () => {
      stoppedRef.current = true
      recogRef.current?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop and parse ────────────────────────────────────────────────────────
  function stopAndParse() {
    stoppedRef.current = true
    recogRef.current?.stop()
    const full = (transcript + interim).trim()
    if (!full) { onClose(); return }
    const result = parseTranscript(full, categories)
    setParsed(result)
    setPhase('parsed')
    startCountdown(result)
  }

  // ── Auto-confirm countdown ────────────────────────────────────────────────
  function startCountdown(p: Parsed) {
    setCountdown(3)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          confirmSave(p)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function cancelCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }

  useEffect(() => () => cancelCountdown(), [])

  // ── Save ──────────────────────────────────────────────────────────────────
  async function confirmSave(p: Parsed) {
    if (saved) return
    setSaved(true)
    const task: Task = {
      id:        `t${Date.now()}`,
      title:     p.title,
      cat:       p.catId ?? '',
      effort:    p.effort,
      due:       p.due ?? '',
      quad:      'q2',
      recurring: null,
      done:      false,
      streak:    0,
      sub:       [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await addTask(task)
    setTimeout(onClose, 600)
  }

  function handleEdit() {
    cancelCountdown()
    if (!parsed) return
    onExpand(parsed)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'unsupported') return <ErrorSheet onClose={onClose} reason="unsupported" />
  if (phase === 'denied')      return <ErrorSheet onClose={onClose} reason="denied" />
  if (phase === 'no-mic')      return <ErrorSheet onClose={onClose} reason="no-mic" />
  if (phase === 'offline')     return <ErrorSheet onClose={onClose} reason="offline" />

  if (phase === 'parsed' && parsed) {
    return (
      <ParsedView
        transcript={transcript + interim}
        parsed={parsed}
        countdown={countdown}
        saved={saved}
        onConfirm={() => { cancelCountdown(); confirmSave(parsed) }}
        onEdit={handleEdit}
        onClose={() => { cancelCountdown(); onClose() }}
      />
    )
  }

  // Phase: listening
  return (
    <ListeningView
      transcript={transcript}
      interim={interim}
      onStop={stopAndParse}
      onClose={onClose}
    />
  )
}

// ── Listening phase ───────────────────────────────────────────────────────────

function ListeningView({
  transcript, interim, onStop, onClose,
}: {
  transcript: string
  interim:    string
  onStop:     () => void
  onClose:    () => void
}) {
  const display = (transcript + interim).trim()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--ink)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--paper)',
    }}>
      {/* Top label */}
      <div style={{
        position: 'absolute', top: 28, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em',
        color: 'rgba(245,244,240,0.45)',
      }}>
        ◉ LISTENING
      </div>

      {/* Dismiss */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          color: 'rgba(245,244,240,0.4)',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
        }}
      >
        CANCEL
      </button>

      {/* Pulsing mic */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <div style={{
          position: 'absolute', inset: -28, borderRadius: '50%',
          background: 'var(--accent)', opacity: 0.15,
          animation: 'mbq-pulse 1.4s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: -48, borderRadius: '50%',
          background: 'var(--accent)', opacity: 0.07,
          animation: 'mbq-pulse 1.4s ease-out infinite',
          animationDelay: '0.3s',
        }} />
        <button
          onClick={onStop}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', border: 'none', cursor: 'pointer',
          }}
        >
          <Icons.mic size={32} />
        </button>
      </div>

      {/* Waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40, marginBottom: 24 }}>
        {BARS.map((h, i) => (
          <div key={i} style={{
            width: 3,
            height: `${h * 100}%`,
            background: display ? 'var(--accent)' : 'rgba(245,244,240,0.2)',
            borderRadius: 2,
            animation: display ? `mbq-wave 0.6s ease-in-out infinite` : 'none',
            animationDelay: `${i * 0.06}s`,
          }} />
        ))}
      </div>

      {/* Live transcript */}
      <div style={{
        maxWidth: 300, textAlign: 'center', minHeight: 56, padding: '0 24px',
        fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic',
        color: display ? 'rgba(245,244,240,0.95)' : 'rgba(245,244,240,0.3)',
        lineHeight: 1.4,
      }}>
        {display || 'Speak now…'}
      </div>

      {/* Tap-to-stop hint */}
      <div style={{
        position: 'absolute', bottom: 48,
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
        color: 'rgba(245,244,240,0.35)',
      }}>
        TAP MIC TO FINISH
      </div>

      <style>{`
        @keyframes mbq-pulse {
          0%   { transform: scale(1);   opacity: 0.15; }
          100% { transform: scale(1.7); opacity: 0;    }
        }
        @keyframes mbq-wave {
          0%, 100% { transform: scaleY(0.4); }
          50%       { transform: scaleY(1);   }
        }
      `}</style>
    </div>
  )
}

// ── Parsed phase ──────────────────────────────────────────────────────────────

function ParsedView({
  transcript, parsed, countdown, saved,
  onConfirm, onEdit, onClose,
}: {
  transcript: string
  parsed:     Parsed
  countdown:  number
  saved:      boolean
  onConfirm:  () => void
  onEdit:     () => void
  onClose:    () => void
}) {
  const effort = EFFORT_LABELS[parsed.effort]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--paper)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* "You said" header */}
      <div style={{
        padding: '20px 20px 16px',
        background: 'var(--paper-2)',
        borderBottom: '1px solid var(--rule)',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8,
        }}>You said</div>
        <div style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 17, color: 'var(--ink)', lineHeight: 1.4,
        }}>
          "{transcript}"
        </div>
      </div>

      {/* Parsed fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12,
        }}>
          Parsed — tap Edit to change
        </div>

        {/* Title */}
        <ParsedField label="Title" big>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{parsed.title}</span>
        </ParsedField>

        {/* Due */}
        {parsed.due && (
          <ParsedField label="Due" hint={parsed.dueHint} icon={
            <FieldIcon><Icons.calendar size={12} /></FieldIcon>
          }>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{formatDue(parsed.due)}</span>
          </ParsedField>
        )}

        {/* Area */}
        {parsed.catId && (
          <ParsedField label="Area" hint={`from "${parsed.catName}"`} icon={
            <FieldIcon hue={parsed.catHue}><Icons.folder size={12} /></FieldIcon>
          }>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{parsed.catName}</span>
          </ParsedField>
        )}

        {/* Effort */}
        <ParsedField label="Effort" hint={parsed.effortHint} icon={
          <FieldIcon><Icons.bolt size={12} /></FieldIcon>
        }>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {effort.label} · {effort.mins}
          </span>
        </ParsedField>

        {/* Auto-confirm indicator */}
        {!saved && countdown > 0 && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 10,
            background: 'var(--ink)', color: 'var(--paper)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid rgba(245,244,240,0.4)',
              borderTopColor: 'var(--paper)',
              animation: 'mbq-spin 1s linear infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '0.05em', flex: 1,
            }}>
              Auto-saving in {countdown}s
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              opacity: 0.5,
            }}>
              tap Edit to keep
            </span>
          </div>
        )}

        {saved && (
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 10,
            background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.04em',
          }}>
            <Icons.check size={14} />
            Saved!
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px 36px',
        borderTop: '1px solid var(--rule)',
        display: 'flex', gap: 10, flexShrink: 0,
      }}>
        <button
          onClick={onEdit}
          disabled={saved}
          style={{
            padding: '12px 18px', borderRadius: 10,
            border: '1px solid var(--rule)',
            color: 'var(--ink-2)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: saved ? 0.4 : 1,
          }}
        >
          <Icons.edit size={14} />
          Edit
        </button>
        <button
          onClick={onConfirm}
          disabled={saved}
          style={{
            flex: 1, padding: '14px', borderRadius: 12,
            background: saved ? 'var(--accent-soft)' : 'var(--accent)',
            color: saved ? 'var(--accent)' : 'var(--paper)',
            fontWeight: 600, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          <Icons.check size={16} />
          {saved ? 'Saved!' : 'Add task'}
        </button>
      </div>

      <style>{`
        @keyframes mbq-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ParsedField({
  label, hint, icon, big, children,
}: {
  label:    string
  hint?:    string | null
  icon?:    React.ReactNode
  big?:     boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid var(--rule)' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ flex: 1 }}>{children}</span>
        <Icons.edit size={12} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      </div>
      {hint && (
        <div style={{
          marginTop: 3, marginLeft: icon ? 30 : 0,
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--ink-3)', letterSpacing: '0.04em',
        }}>
          ↳ {hint}
        </div>
      )}
    </div>
  )
}

function FieldIcon({ hue, children }: { hue?: number | null; children: React.ReactNode }) {
  const isDark = useIsDark()
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
      background: hue != null ? areaColor(hue, 'bg', isDark) : 'var(--paper-2)',
      color:      hue != null ? areaColor(hue, 'fg', isDark) : 'var(--ink-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  )
}

// ── Error / unsupported sheet ─────────────────────────────────────────────────

const ERROR_CONTENT: Record<
  'unsupported' | 'denied' | 'no-mic' | 'offline',
  { title: string; body: React.ReactNode }
> = {
  unsupported: {
    title: 'Voice not available',
    body: (
      <>
        <p>Your browser doesn't support the Web Speech API.</p>
        <p style={{ marginTop: 8 }}>
          <strong>Works in:</strong> Chrome, Edge, Safari (iOS &amp; macOS).<br />
          <strong>Doesn't work in:</strong> Firefox, Brave (by default).
        </p>
      </>
    ),
  },
  denied: {
    title: 'Microphone blocked',
    body: (
      <>
        <p>Microphone access was denied. Steps to fix:</p>
        <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><strong>Chrome / Edge:</strong> click the lock icon in the address bar → allow Microphone.</li>
          <li><strong>Brave:</strong> click the Shields icon (lion) → disable shields, or go to Settings → Privacy → Site and Shields Settings → Microphone.</li>
          <li><strong>Safari (macOS):</strong> System Settings → Privacy &amp; Security → Microphone → enable Safari.</li>
          <li><strong>Safari (iOS):</strong> Settings → Safari → Microphone → Allow.</li>
        </ul>
        <p style={{ marginTop: 10 }}>After allowing, reload the page and try again.</p>
      </>
    ),
  },
  'no-mic': {
    title: 'No microphone found',
    body: (
      <p>
        The browser couldn't access a microphone. Check that one is connected and not
        in use by another app, then try again.
      </p>
    ),
  },
  offline: {
    title: 'Speech service unavailable',
    body: (
      <p>
        Voice recognition requires an internet connection (it uses an online speech
        service). Check your connection and try again.
      </p>
    ),
  },
}

function ErrorSheet({ onClose, reason }: {
  onClose: () => void
  reason: 'unsupported' | 'denied' | 'no-mic' | 'offline'
}) {
  const { title, body } = ERROR_CONTENT[reason]
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--paper)', borderRadius: '20px 20px 0 0',
        padding: '28px 24px 48px', width: '100%',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
        <div className="t-display" style={{ fontSize: 20, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
          {body}
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: 'var(--ink)', color: 'var(--paper)',
            fontWeight: 600, fontSize: 14,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
