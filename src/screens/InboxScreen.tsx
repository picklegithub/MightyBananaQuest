import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDateISO } from '../lib/useCurrentDate'
import { db, addTask, completeTask, deleteTask, updateTask } from '../data/db'
import { EFFORT } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { SwipeableRow } from '../components/SwipeableRow'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen, Task, Category, EffortKey } from '../types'
import { useIsColorful, useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

// ── Short syntax parser ───────────────────────────────────────────────────────
// Tokens:
//   #word      → category (matched by name prefix, case-insensitive)
//   @today     → due = today's ISO date
//   @tomorrow  → due = tomorrow's ISO date
//   @YYYY-MM-DD → exact due date
//   p1/p2/p3   → status: p1=active, p2=backlog, p3=someday
//   1h/30m/2h  → effort: ≤15m=xs, ≤30m=s, ≤90m=m, ≤3h=l, ≤8h=xl, >8h=xxl

function parseDateToken(token: string): string | null {
  const t = token.toLowerCase()
  if (t === '@today') return localDateISO()
  if (t === '@tomorrow') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // @YYYY-MM-DD
  const dateMatch = token.match(/^@(\d{4}-\d{2}-\d{2})$/)
  if (dateMatch) return dateMatch[1]
  // @Mon, @Tue etc — find next occurrence
  const dayNames = ['sun','mon','tue','wed','thu','fri','sat']
  const dayMatch = token.match(/^@([a-zA-Z]{3})$/)
  if (dayMatch) {
    const target = dayNames.indexOf(dayMatch[1].toLowerCase())
    if (target >= 0) {
      const d = new Date()
      let offset = (target - d.getDay() + 7) % 7
      if (offset === 0) offset = 7  // always next occurrence
      d.setDate(d.getDate() + offset)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }
  return null
}

function parseTimeToken(token: string): EffortKey | null {
  const m = token.match(/^(\d+(?:\.\d+)?)(h|m)$/)
  if (!m) return null
  const val = parseFloat(m[1])
  const mins = m[2] === 'h' ? val * 60 : val
  if (mins <= 5)   return 'xs'
  if (mins <= 20)  return 's'
  if (mins <= 90)  return 'm'
  if (mins <= 180) return 'l'
  if (mins <= 480) return 'xl'
  return 'xxl'
}

interface ParsedCapture {
  title: string
  catId?: string
  due?: string
  status?: Task['status']
  effort?: EffortKey
}

function parseShortSyntax(raw: string, cats: Category[]): ParsedCapture {
  const words = raw.trim().split(/\s+/)
  const result: ParsedCapture = { title: '' }
  const titleWords: string[] = []

  for (const word of words) {
    // Category: #word
    if (word.startsWith('#') && word.length > 1) {
      const slug = word.slice(1).toLowerCase()
      const match = cats.find(c => c.name.toLowerCase().startsWith(slug))
      if (match) { result.catId = match.id; continue }
    }
    // Due date: @token
    if (word.startsWith('@') && word.length > 1) {
      const parsed = parseDateToken(word)
      if (parsed) { result.due = parsed; continue }
    }
    // Status: p1/p2/p3
    if (/^p[123]$/i.test(word)) {
      result.status = word === 'p1' ? 'active' : word === 'p2' ? 'backlog' : 'someday'
      continue
    }
    // Effort: 1h / 30m etc
    const effortKey = parseTimeToken(word.toLowerCase())
    if (effortKey) { result.effort = effortKey; continue }
    titleWords.push(word)
  }

  result.title = titleWords.join(' ')
  return result
}

// ── Voice capture hook ────────────────────────────────────────────────────────
type ListeningState = 'idle' | 'listening' | 'processing' | 'unsupported'

function useVoiceCapture(onResult: (text: string) => void) {
  const [state, setState] = useState<ListeningState>(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    return SR ? 'idle' : 'unsupported'
  })
  const recRef = useRef<any>(null)

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onstart  = () => setState('listening')
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setState('idle')
      onResult(transcript)
    }
    rec.onerror = () => setState('idle')
    rec.onend   = () => setState(s => s === 'listening' ? 'idle' : s)
    rec.start()
    recRef.current = rec
    setState('listening')
  }, [onResult])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setState('idle')
  }, [])

  return { state, start, stop }
}

// ── Ghost input with short syntax + voice ─────────────────────────────────────
function GhostInput({ cats, onSaved }: { cats: Category[]; onSaved: () => void }) {
  const [active, setActive] = useState(false)
  const [value,  setValue]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { state: voiceState, start: startVoice, stop: stopVoice } = useVoiceCapture((text) => {
    setValue(text)
    setActive(true)
    setTimeout(() => inputRef.current?.focus(), 60)
  })

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 40)
  }, [active])

  // Preview parsed tokens
  const parsed = value.trim() ? parseShortSyntax(value, cats) : null
  const hasTokens = parsed && (parsed.catId || parsed.due || parsed.status || parsed.effort)

  async function handleSave() {
    const raw = value.trim()
    if (!raw) { setActive(false); return }
    const p = parseShortSyntax(raw, cats)
    const title = p.title || raw  // fallback to full text if all tokens
    await addTask({
      id: `t${Date.now()}`,
      title,
      cat: p.catId ?? 'inbox',
      effort: p.effort ?? 's',
      due: p.due ?? '',
      status: p.status ?? undefined,
      quad: 'q2',
      recurring: null,
      done: false,
      streak: 0,
      sub: [],
    })
    setValue('')
    setActive(false)
    onSaved()
  }

  if (!active && voiceState === 'idle') {
    return (
      <div style={{ display: 'flex', gap: 7 }}>
        <button
          onClick={() => setActive(true)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 13px',
            borderRadius: 12, border: '1px dashed var(--rule)',
            color: 'var(--ink-4)', fontSize: 13,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '1.5px dashed var(--rule)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-4)', flexShrink: 0,
          }}>
            <Icons.plus size={11} />
          </span>
          New task… <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginLeft: 4 }}>#cat @date p1</span>
        </button>
        <button
          onClick={startVoice}
          title="Voice capture"
          style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            border: '1px solid var(--rule)', background: 'var(--paper-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-3)',
          }}
        >
          <Icons.mic size={16} />
        </button>
      </div>
    )
  }

  // Listening state
  if (voiceState === 'listening') {
    return (
      <button
        onClick={stopVoice}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '12px 16px', borderRadius: 12,
          border: '2px solid var(--accent)', background: 'var(--accent-soft)',
          color: 'var(--accent)', fontSize: 14,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
          animation: 'pulse 1s ease-in-out infinite',
        }} />
        Listening… tap to stop
      </button>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) handleSave()
            if (e.key === 'Escape') { setValue(''); setActive(false) }
          }}
          placeholder="Task… #health @tomorrow p1 1h"
          style={{
            flex: 1, padding: '10px 13px', borderRadius: 12,
            border: '2px solid var(--accent)',
            background: 'var(--paper-2)', fontSize: 14, color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSave}
          disabled={!value.trim()}
          style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: value.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: value.trim() ? 'var(--paper)' : 'var(--ink-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icons.check size={14} sw={2.5} />
        </button>
        <button
          onClick={() => { setValue(''); setActive(false) }}
          style={{ width: 38, height: 38, borderRadius: 10, color: 'var(--ink-3)', border: '1px solid var(--rule)', flexShrink: 0 }}
        >
          <Icons.close size={14} />
        </button>
      </div>

      {/* Token preview */}
      {hasTokens && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7, paddingLeft: 2,
        }}>
          {parsed!.title && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
              padding: '2px 8px', borderRadius: 6, background: 'var(--paper-3)', border: '1px solid var(--rule)',
            }}>
              "{parsed!.title}"
            </span>
          )}
          {parsed!.catId && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
              padding: '2px 8px', borderRadius: 6, background: 'var(--accent-soft)',
            }}>
              #{cats.find(c => c.id === parsed!.catId)?.name ?? parsed!.catId}
            </span>
          )}
          {parsed!.due && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)',
              padding: '2px 8px', borderRadius: 6, background: 'var(--paper-3)', border: '1px solid var(--rule)',
            }}>
              @{parsed!.due}
            </span>
          )}
          {parsed!.status && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)',
              padding: '2px 8px', borderRadius: 6, background: 'var(--paper-3)', border: '1px solid var(--rule)',
            }}>
              {parsed!.status}
            </span>
          )}
          {parsed!.effort && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)',
              padding: '2px 8px', borderRadius: 6, background: 'var(--paper-3)', border: '1px solid var(--rule)',
            }}>
              {EFFORT[parsed!.effort]?.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  navigate: (s: Screen) => void
  back: () => void
}

interface Burst { id: number; x: number; y: number; xp: number }

// ── Effort display label ──────────────────────────────────────────────────────
function effortLabel(effort: Task['effort']): string {
  const mins = EFFORT[effort]?.mins ?? 15
  if (mins >= 1440) return Math.round(mins / 1440) + 'd'
  if (mins >= 60)   return (mins / 60) + 'h'
  return mins + 'm'
}

// ── Single inbox task card ────────────────────────────────────────────────────
function InboxTaskCard({
  task, cats, onNavigate, onComplete, onDelete, onAssign,
}: {
  task: Task
  cats: Category[]
  onNavigate: () => void
  onComplete: (e: React.MouseEvent) => void
  onDelete: () => void
  onAssign: (catId: string) => void
}) {
  const eDef = EFFORT[task.effort]
  const isColorful = useIsColorful()
  const isDark     = useIsDark()
  const cat = cats.find(c => c.id === task.cat)
  const borderColor = (isColorful && cat?.hue !== undefined)
    ? areaColor(cat.hue, 'fg', isDark)
    : 'var(--rule)'

  return (
    <div style={{
      border: '1px solid var(--rule)', borderLeft: `3px solid ${borderColor}`,
      borderRadius: 12, overflow: 'hidden',
      opacity: task.done ? 0.52 : 1, transition: 'opacity .2s',
    }}>
      {/* Main row — swipeable for delete */}
      <SwipeableRow onDelete={onDelete}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px 11px 12px', background: 'var(--paper-2)' }}>

        {/* Complete button — matches TaskCard size */}
        <button
          onClick={onComplete}
          style={{
            flexShrink: 0, marginTop: 1,
            width: 24, height: 24, borderRadius: '50%',
            border: `1.5px solid ${task.done ? 'var(--accent)' : 'var(--rule)'}`,
            background: task.done ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: task.done ? 'var(--paper)' : 'transparent',
            transition: 'all .15s',
          }}
        >
          {task.done && <Icons.check size={11} sw={2.5} />}
        </button>

        {/* Content — tappable to open task detail */}
        <button onClick={onNavigate} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{
            fontSize: 14, fontWeight: 500, lineHeight: 1.35,
            textDecoration: task.done ? 'line-through' : 'none',
            color: 'var(--ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginBottom: 4,
          }}>
            {task.title}
          </div>

          {/* Meta row — matches TaskCard meta style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {eDef && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                letterSpacing: '0.05em',
              }}>
                {eDef.glyph} {effortLabel(task.effort)}
              </span>
            )}
            {task.due && task.due !== '' && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                  letterSpacing: '0.05em', fontWeight: 600,
                }}>
                  {task.due}
                </span>
              </>
            )}
            {task.status && task.status !== 'backlog' && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                color: task.status === 'active' ? 'var(--accent)' : 'var(--ink-4)',
                padding: '1px 6px', borderRadius: 4,
                background: task.status === 'active' ? 'var(--accent-soft)' : 'var(--paper-3)',
              }}>
                {task.status === 'active' ? '⚡ Active' : 'Someday'}
              </span>
            )}
            {task.notes && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
                letterSpacing: '0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 140,
              }}>
                {task.notes}
              </span>
            )}
          </div>
        </button>

      </div>
      </SwipeableRow>

      {/* Area assign row — always visible, scrollable */}
      {!task.done && (
        <div style={{
          borderTop: '1px solid var(--rule)',
          padding: '8px 12px',
          display: 'flex', gap: 5, overflowX: 'auto',
          alignItems: 'center', background: 'var(--paper-2)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
            letterSpacing: '0.08em', flexShrink: 0, marginRight: 2,
          }}>
            MOVE TO
          </span>
          {cats.map(c => {
            // C3: show area icon so triage pills are recognisable at a glance
            const CatIcon = ((Icons as unknown) as Record<string, React.FC<{ size?: number }>>)[c.icon] ?? Icons.home
            return (
              <button
                key={c.id}
                onClick={() => onAssign(c.id)}
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 20,
                  fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: 'var(--paper-3)', color: 'var(--ink-2)',
                  border: '1px solid var(--rule)',
                  whiteSpace: 'nowrap',
                }}
              >
                <CatIcon size={11} />
                {c.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const InboxScreen = ({ navigate, back }: Props) => {
  const [bursts, setBursts] = useState<Burst[]>([])

  const tasks = useLiveQuery(
    () => db.tasks.where('cat').equals('inbox').toArray(),
    []
  )
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? []

  if (!tasks) return null

  const pending = tasks.filter(t => !t.done)
  const done    = tasks.filter(t => t.done)

  async function handleComplete(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    if (task.done) return
    const { xp: gained } = await completeTask(task.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
  }

  async function handleAssign(taskId: string, catId: string) {
    await updateTask(taskId, { cat: catId, due: 'Today' })
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId)
  }

  const isEmpty = tasks.length === 0

  return (
    <div className="screen">
      <ScreenHeader
        title="Inbox"
        subtitle={pending.length > 0 ? `${pending.length} to sort` : undefined}
        back={back}
      />

      <div className="screen-scroll" style={{ padding: '16px 20px 24px' }}>

        {/* Empty state */}
        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '60px 20px 24px' }}>
            <Icons.inbox size={40} style={{ color: 'var(--ink-4)', margin: '0 auto 16px', display: 'block' }} />
            <div className="t-display" style={{ fontSize: 20, marginBottom: 6 }}>Inbox zero</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>
              Captures land here. Assign an area<br />or complete them to clear the queue.
            </div>
          </div>
        )}

        {/* Pending tasks */}
        {pending.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: done.length > 0 ? 24 : 0 }}>
            {pending.map(task => (
              <InboxTaskCard
                key={task.id}
                task={task}
                cats={cats}
                onNavigate={() => navigate({ name: 'task', taskId: task.id })}
                onComplete={e => handleComplete(e, task)}
                onDelete={() => handleDelete(task.id)}
                onAssign={catId => handleAssign(task.id, catId)}
              />
            ))}
          </div>
        )}

        {/* Done tasks — collapsed section */}
        {done.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 10, opacity: 0.5 }}>Completed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {done.map(task => (
                <InboxTaskCard
                  key={task.id}
                  task={task}
                  cats={cats}
                  onNavigate={() => navigate({ name: 'task', taskId: task.id })}
                  onComplete={e => handleComplete(e, task)}
                  onDelete={() => handleDelete(task.id)}
                  onAssign={catId => handleAssign(task.id, catId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ghost input — short syntax + voice */}
        <GhostInput cats={cats} onSaved={() => {}} />
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
