import { makeId } from '../lib/makeId'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, processInboxItem, revertInboxItem, addTask, deleteTask } from '../data/db'
import { parseNL } from '../lib/nlParse'
import { formatDueLabel, isDueToday, isDueTomorrow } from '../lib/parseDue'
import { Icons } from '../components/ui/Icons'
import { EffortPip, SectionHeader } from '../components/ui'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { SwipeableRow } from '../components/SwipeableRow'
import { EFFORT_LABELS } from '../constants'
import type { Screen, InboxItem, Task, Category } from '../types'
import { useNav } from '../lib/navContext'

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const mins   = Math.floor(diffMs / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function isFresh(createdAt: number): boolean {
  return Date.now() - createdAt < 24 * 60 * 60 * 1000
}

function dueColor(due: string): string {
  if (isDueToday(due))   return 'var(--accent)'
  if (due === 'Overdue') return 'var(--warn)'
  if (isDueTomorrow(due)) return 'var(--ink-2)'
  return 'var(--ink-3)'
}

const SOURCE_ICON: Record<InboxItem['source'], keyof typeof Icons> = {
  voice:   'mic',
  capture: 'edit',
  share:   'rss',
  email:   'inbox',
}

// ── Undo toast ────────────────────────────────────────────────────────────────
interface UndoState {
  label: string
  onUndo: () => Promise<void>
}

function UndoToast({ undo, onDismiss }: { undo: UndoState; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo])

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16,
      background: 'var(--ink)', borderRadius: 12, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10, zIndex: 300,
    }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--paper)' }}>{undo.label}</span>
      <button
        onClick={async () => { if (timerRef.current) clearTimeout(timerRef.current); await undo.onUndo(); onDismiss() }}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
          color: 'var(--accent)', padding: '4px 10px', borderRadius: 8,
          border: '1px solid var(--accent)', background: 'transparent', flexShrink: 0,
        }}
      >
        UNDO
      </button>
    </div>
  )
}

// ── Inbox edit sheet ─────────────────────────────────────────────────────────
function InboxEditSheet({
  item, categories, onClose, onAction, navigate,
}: {
  item: InboxItem
  categories: Category[]
  onClose: () => void
  onAction: (undo: UndoState) => void
  navigate: (s: Screen) => void
}) {
  const parsed  = useMemo(() => parseNL(item.text, categories), [item.text, categories])
  const [title,  setTitle]  = useState(parsed.title || item.text)
  const [effort, setEffort] = useState<Task['effort']>((parsed.effort ?? 'm') as Task['effort'])
  const [catId,  setCatId]  = useState(parsed.catId ?? '')
  const processing = useRef(false)
  const GlyphIcon  = Icons[SOURCE_ICON[item.source]] ?? Icons.inbox
  const dueLabel   = parsed.due ? formatDueLabel(parsed.due) : null
  const hasUrl     = !!item.sourceMeta?.url

  async function triage(action: () => Promise<void>) {
    if (processing.current) return
    processing.current = true
    try { await action() } finally { processing.current = false }
  }

  async function handleCreate(status: 'backlog' | 'someday') {
    await triage(async () => {
      const now = Date.now(), taskId = makeId()
      const task: Task = {
        id: taskId, title: title.trim() || item.text,
        cat: catId, effort,
        due: status === 'someday' ? '' : (parsed.due ?? ''),
        status, recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, status === 'someday' ? 'someday' : 'converted', taskId)
      onAction({
        label: status === 'someday' ? 'Moved to someday.' : 'Added to tasks.',
        onUndo: async () => { await deleteTask(taskId); await revertInboxItem(item.id, 'inbox') },
      })
      onClose()
    })
  }

  async function handleReadLater() {
    await triage(async () => {
      const now = Date.now(), taskId = makeId()
      const task: Task = {
        id: taskId, title: title.trim() || item.text,
        cat: '', effort: 's', due: '', status: 'someday',
        notes: `readLater · ${item.sourceMeta?.url ?? ''}`,
        recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, 'someday', taskId)
      onAction({
        label: 'Saved to read later.',
        onUndo: async () => { await deleteTask(taskId); await revertInboxItem(item.id, 'inbox') },
      })
      navigate({ name: 'all-tasks', initialStatus: 'someday' })
      onClose()
    })
  }

  async function handleArchive() {
    await triage(async () => {
      await processInboxItem(item.id, 'archived')
      onAction({
        label: 'Archived.',
        onUndo: async () => { await revertInboxItem(item.id, 'inbox') },
      })
      onClose()
    })
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 13px', borderRadius: 20, fontSize: 11,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    background: active ? 'var(--ink)' : 'var(--paper-2)',
    color: active ? 'var(--paper)' : 'var(--ink-3)',
    border: `1px solid ${active ? 'var(--ink)' : 'var(--rule)'}`,
    whiteSpace: 'nowrap' as const,
  })

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--paper)', borderRadius: '16px 16px 0 0',
        zIndex: 201, paddingBottom: 'env(safe-area-inset-bottom)',
        maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--rule)',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            border: `1.5px solid ${item.source === 'voice' ? 'var(--accent)' : 'var(--rule)'}`,
            background: 'var(--paper-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: item.source === 'voice' ? 'var(--accent)' : 'var(--ink-3)',
          }}>
            <GlyphIcon size={11} />
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
            letterSpacing: '0.06em', flex: 1,
          }}>
            {relativeTime(item.createdAt)} · {item.source}
          </span>
          <button onClick={onClose} style={{ color: 'var(--ink-4)', padding: 4 }}>
            <Icons.close size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {/* Editable title */}
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={2}
            autoFocus
            style={{
              width: '100%', resize: 'none', boxSizing: 'border-box',
              fontSize: 16, fontWeight: 500, lineHeight: 1.4,
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
            }}
          />

          {dueLabel && (
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              color: dueColor(parsed.due!), padding: '3px 8px',
              background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 6,
            }}>
              <Icons.calendar size={9} /> {dueLabel}
            </div>
          )}

          {/* Effort */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
            }}>Effort</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['xs', 's', 'm', 'l'] as Task['effort'][]).map(e => (
                <button key={e} onClick={() => setEffort(e)} style={pillStyle(effort === e)}>
                  {EFFORT_LABELS[e]}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
              }}>Area</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setCatId('')} style={pillStyle(catId === '')}>None</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setCatId(c.id)} style={pillStyle(catId === c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          padding: '12px 16px 16px', borderTop: '1px solid var(--rule)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleCreate('backlog')}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 12,
                background: 'var(--ink)', color: 'var(--paper)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icons.check size={13} sw={2.5} /> Add to tasks
            </button>
            <button
              onClick={() => handleCreate('someday')}
              style={{
                padding: '12px 16px', borderRadius: 12,
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                color: 'var(--ink-2)', fontSize: 13,
              }}
            >
              Someday
            </button>
            {hasUrl && (
              <button
                onClick={handleReadLater}
                style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  color: 'var(--ink-2)', fontSize: 13,
                }}
              >
                Read later
              </button>
            )}
          </div>
          <button
            onClick={handleArchive}
            style={{
              width: '100%', padding: '8px', borderRadius: 10,
              background: 'transparent', border: 'none',
              color: 'var(--ink-4)', fontSize: 12,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            Archive
          </button>
        </div>
      </div>
    </>
  )
}

// ── Single inbox card ─────────────────────────────────────────────────────────
function InboxCard({
  item,
  onAction,
  navigate,
  categories,
  onOpen,
}: {
  item: InboxItem
  onAction: (undo: UndoState) => void
  navigate: (s: Screen) => void
  categories: Category[]
  onOpen: () => void
}) {
  const processing = useRef(false)
  const parsed = useMemo(() => parseNL(item.text, categories), [item.text, categories])
  const GlyphIcon = Icons[SOURCE_ICON[item.source]] ?? Icons.inbox
  const lowConf  = item.source === 'voice' && (item.sourceMeta?.transcriptConfidence ?? 1) < 0.6
  const hasUrl   = !!item.sourceMeta?.url
  const catName  = parsed.catId ? categories.find(c => c.id === parsed.catId)?.name : undefined
  const dueLabel = parsed.due ? formatDueLabel(parsed.due) : null
  const fresh    = isFresh(item.createdAt)

  async function triage(action: () => Promise<void>) {
    if (processing.current) return
    processing.current = true
    try { await action() } finally { processing.current = false }
  }

  // Primary tap — convert to task and open TaskDetailScreen
  async function handleConvert() {
    await triage(async () => {
      const now    = Date.now()
      const taskId = makeId()
      const task: Task = {
        id: taskId, title: parsed.title || item.text,
        cat: parsed.catId ?? '', effort: (parsed.effort ?? 'm') as Task['effort'],
        due: parsed.due ?? '', status: 'backlog',
        recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, 'converted', taskId)
      navigate({ name: 'task', taskId })
      onAction({
        label: 'Added to tasks.',
        onUndo: async () => {
          await deleteTask(taskId)
          await revertInboxItem(item.id, 'inbox')
        },
      })
    })
  }

  async function handleSomeday() {
    await triage(async () => {
      const now    = Date.now()
      const taskId = makeId()
      const task: Task = {
        id: taskId, title: parsed.title || item.text,
        cat: parsed.catId ?? '', effort: (parsed.effort ?? 'm') as Task['effort'],
        due: '', status: 'someday',
        recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, 'someday', taskId)
      onAction({
        label: 'Moved to someday.',
        onUndo: async () => {
          await deleteTask(taskId)
          await revertInboxItem(item.id, 'inbox')
        },
      })
    })
  }

  async function handleReadLater() {
    await triage(async () => {
      const now    = Date.now()
      const taskId = makeId()
      const task: Task = {
        id: taskId, title: item.text,
        cat: '', effort: 's', due: '', status: 'someday',
        notes: `readLater · ${item.sourceMeta?.url ?? ''}`,
        recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, 'someday', taskId)
      navigate({ name: 'all-tasks', initialStatus: 'someday' })
      onAction({
        label: 'Saved to read later.',
        onUndo: async () => {
          await deleteTask(taskId)
          await revertInboxItem(item.id, 'inbox')
        },
      })
    })
  }

  async function handleArchive() {
    await triage(async () => {
      await processInboxItem(item.id, 'archived')
      onAction({
        label: 'Archived.',
        onUndo: async () => { await revertInboxItem(item.id, 'inbox') },
      })
    })
  }

  return (
    <SwipeableRow onComplete={handleConvert} onDelete={handleArchive}>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--rule)' }}>
        {/* ── Main tappable card — TaskCard-style layout ── */}
        <button
          onClick={onOpen}
          style={{
            width: '100%', textAlign: 'left',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '11px 14px 11px 12px',
            background: 'var(--paper-2)',
            borderBottom: '1px solid var(--rule)',
            borderLeft: '3px solid var(--accent)',
          }}
        >
          {/* Source icon circle */}
          <div style={{
            flexShrink: 0, width: 24, height: 24, borderRadius: '50%', marginTop: 1,
            border: `1.5px solid ${item.source === 'voice' ? 'var(--accent)' : 'var(--rule)'}`,
            background: 'var(--paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: item.source === 'voice' ? 'var(--accent)' : 'var(--ink-3)',
          }}>
            <GlyphIcon size={12} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 500, lineHeight: 1.35,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontStyle: lowConf ? 'italic' : 'normal',
              color: lowConf ? 'var(--ink-3)' : 'var(--ink)',
            }}>
              {parsed.title || item.text}
            </div>

            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <EffortPip effort={parsed.effort ?? 'm'} mono />

              {dueLabel && (
                <>
                  <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                    color: dueColor(parsed.due!), flexShrink: 0,
                    fontWeight: isDueToday(parsed.due!) ? 600 : 400,
                  }}>
                    {dueLabel}
                  </span>
                </>
              )}

              {catName && (
                <>
                  <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                    {catName}
                  </span>
                </>
              )}
            </div>

            {lowConf && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.04em', marginTop: 3 }}>
                Low confidence — review carefully
              </div>
            )}
          </div>

          {/* Right — fresh dot + time ago */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginTop: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {fresh && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {relativeTime(item.createdAt)}
              </span>
            </div>
            <Icons.arrow size={13} style={{ color: 'var(--ink-4)' }} />
          </div>
        </button>

        {/* ── Triage pills ── */}
        <div style={{
          display: 'flex', gap: 6, padding: '8px 12px',
          background: 'var(--paper)',
          overflowX: 'auto',
        }}>
          <button onClick={handleSomeday} style={PILL}>Someday</button>
          {hasUrl && <button onClick={handleReadLater} style={PILL}>Read later</button>}
          <button onClick={handleArchive} style={{ ...PILL, marginLeft: 'auto', color: 'var(--ink-4)' }}>Archive</button>
        </div>
      </div>
    </SwipeableRow>
  )
}

const PILL: React.CSSProperties = {
  flexShrink: 0, padding: '5px 12px', borderRadius: 999,
  fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
  border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink-3)',
  whiteSpace: 'nowrap', cursor: 'pointer',
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  navigate?: (s: Screen) => void
  back?: () => void
  onCapture?: () => void
}

export const InboxScreen = ({ back: backProp, navigate: navProp, onCapture: onCaptureProp }: Props) => {
  const { navigate: ctxNavigate, back: ctxBack, openCapture } = useNav()
  const navigate  = navProp      ?? ctxNavigate
  const back      = backProp     ?? ctxBack
  const onCapture = onCaptureProp ?? openCapture
  const [undoState,    setUndoState]    = useState<UndoState | null>(null)
  const [editingItem,  setEditingItem]  = useState<InboxItem | null>(null)

  const items = useLiveQuery(
    () => db.inboxItems.where('status').equals('inbox').sortBy('createdAt'),
    []
  ) ?? []

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []

  const fresh = items.filter(i => isFresh(i.createdAt))
  const older = items.filter(i => !isFresh(i.createdAt))

  const voiceN   = items.filter(i => i.source === 'voice').length
  const shareN   = items.filter(i => i.source === 'share').length
  const captureN = items.filter(i => i.source === 'capture' || i.source === 'email').length

  async function archiveAll() {
    const snapshot = [...items]
    await Promise.all(snapshot.map(i => processInboxItem(i.id, 'archived')))
    setUndoState({
      label: `${snapshot.length} item${snapshot.length !== 1 ? 's' : ''} archived.`,
      onUndo: async () => { await Promise.all(snapshot.map(i => revertInboxItem(i.id, 'inbox'))) },
    })
  }

  const n = items.length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--paper)', overflow: 'hidden',
    }}>
      <ScreenHeader
        title="Inbox"
        subtitle={n > 0 ? `${n} to triage` : 'all clear'}
        back={back}
        icon={<Icons.inbox size={22} />}
        rightActions={
          <button
            onClick={n > 0 ? archiveAll : undefined}
            aria-label="Archive all"
            title="Archive all"
            style={{ color: n > 0 ? 'var(--ink-3)' : 'var(--ink-4)', display: 'flex', alignItems: 'center' }}
          >
            <Icons.more size={20} />
          </button>
        }
      />

      <div className="screen-scroll" style={{ padding: '20px 16px 40px', flex: 1 }}>

        {/* Empty state */}
        {n === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 20 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20,
            }}>
              Nothing to sort. Capture something when it comes.
            </p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
              Tap{' '}
              <span style={{
                display: 'inline-block', width: 22, height: 22, borderRadius: '50%',
                background: 'var(--ink)', color: 'var(--paper)',
                fontFamily: 'inherit', fontSize: 14, lineHeight: '22px', textAlign: 'center',
                verticalAlign: 'middle', margin: '0 2px',
              }}>+</span>{' '}
              to capture
            </div>
          </div>
        )}

        {n > 0 && (
          <>
            {/* Headline */}
            <div style={{ marginBottom: 4 }}>
              <div className="t-display" style={{ fontSize: 26 }}>
                A small {n === 1 ? 'thing' : 'pile'} to sort.
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
                letterSpacing: '0.06em', marginTop: 6,
              }}>
                {voiceN > 0 && `${voiceN} voice`}
                {voiceN > 0 && (shareN > 0 || captureN > 0) && ' · '}
                {shareN > 0 && `${shareN} shared`}
                {shareN > 0 && captureN > 0 && ' · '}
                {captureN > 0 && `${captureN} capture${captureN !== 1 ? 's' : ''}`}
              </div>
              <div style={{
                marginTop: 8, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5,
              }}>
                Tap a card to open and edit · Someday or Archive to triage quickly
              </div>
            </div>

            {/* Fresh section */}
            {fresh.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <SectionHeader title="Fresh" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {fresh.map(item => (
                    <InboxCard
                      key={item.id} item={item}
                      onAction={setUndoState} navigate={navigate} categories={categories}
                      onOpen={() => setEditingItem(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Older section */}
            {older.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <SectionHeader title="Older" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {older.map(item => (
                    <InboxCard
                      key={item.id} item={item}
                      onAction={setUndoState} navigate={navigate} categories={categories}
                      onOpen={() => setEditingItem(item)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {undoState && (
        <UndoToast undo={undoState} onDismiss={() => setUndoState(null)} />
      )}

      {editingItem && (
        <InboxEditSheet
          item={editingItem}
          categories={categories}
          onClose={() => setEditingItem(null)}
          onAction={setUndoState}
          navigate={navigate}
        />
      )}
    </div>
  )
}
