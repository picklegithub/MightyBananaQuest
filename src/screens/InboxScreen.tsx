import React, { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, processInboxItem, revertInboxItem, addTask, deleteTask } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { SectionHeader } from '../components/ui'
import type { Screen, InboxItem, Task } from '../types'

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

// ── Source colour ─────────────────────────────────────────────────────────────
const SOURCE_COLOR: Record<InboxItem['source'], string> = {
  voice:   'var(--accent)',
  capture: 'var(--ink-3)',
  share:   'var(--ink-3)',
  email:   'var(--ink-3)',
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

// ── Triage pills ──────────────────────────────────────────────────────────────
function TriagePills({
  item,
  onAction,
}: {
  item: InboxItem
  onAction: (undo: UndoState) => void
}) {
  const hasUrl     = !!item.sourceMeta?.url
  const processing = useRef(false)

  async function triage(action: () => Promise<void>) {
    if (processing.current) return
    processing.current = true
    try { await action() } finally { processing.current = false }
  }

  async function handleToTask() {
    await triage(async () => {
      const now    = Date.now()
      const taskId = crypto.randomUUID()
      const task: Task = {
        id: taskId, title: item.text,
        cat: '', effort: 'm', due: '', quad: 'q2',
        recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, 'converted', taskId)
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
      const taskId = crypto.randomUUID()
      const task: Task = {
        id: taskId, title: item.text,
        cat: '', effort: 'm', due: '', status: 'someday', quad: 'q2',
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
      const taskId = crypto.randomUUID()
      const task: Task = {
        id: taskId, title: item.text,
        cat: '', effort: 's', due: '', status: 'someday',
        notes: `readLater · ${item.sourceMeta?.url ?? ''}`,
        quad: 'q2', recurring: null, done: false, streak: 0, sub: [],
        createdAt: now, updatedAt: now,
      }
      await addTask(task)
      await processInboxItem(item.id, 'someday', taskId)
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

  const pillBase: React.CSSProperties = {
    flexShrink: 0, padding: '5px 12px', borderRadius: 999,
    fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink-2)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 14px 10px',
      borderTop: '1px solid var(--rule)', background: 'var(--paper-2)',
    }}>
      <button
        onClick={handleToTask}
        style={{ ...pillBase, borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        → Task
      </button>
      <button onClick={handleSomeday} style={pillBase}>Someday</button>
      {hasUrl && (
        <button onClick={handleReadLater} style={pillBase}>Read later</button>
      )}
      <button onClick={handleArchive} style={pillBase}>Archive</button>
    </div>
  )
}

// ── Single row ────────────────────────────────────────────────────────────────
function InboxRow({
  item,
  onAction,
}: {
  item: InboxItem
  onAction: (undo: UndoState) => void
}) {
  const fresh     = isFresh(item.createdAt)
  const color     = SOURCE_COLOR[item.source]
  const iconKey   = SOURCE_ICON[item.source]
  const GlyphIcon = Icons[iconKey] ?? Icons.inbox
  const lowConf   = (item.sourceMeta?.transcriptConfidence ?? 1) < 0.6

  return (
    <div style={{
      border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden',
      background: 'var(--paper-2)',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px 10px' }}>
        {/* Source icon */}
        <div style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, marginTop: 1,
        }}>
          <GlyphIcon size={14} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {lowConf && item.source === 'voice' ? (
            <>
              <div style={{
                fontSize: 13, fontWeight: 500, color: 'var(--ink-3)',
                fontStyle: 'italic', lineHeight: 1.4, marginBottom: 2,
              }}>
                {item.text}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                letterSpacing: '0.04em',
              }}>
                Tap to listen
              </div>
            </>
          ) : (
            <div style={{
              fontSize: 13.5, fontWeight: 500, color: 'var(--ink)',
              lineHeight: 1.4,
            }}>
              {item.text}
            </div>
          )}
        </div>

        {/* Right: fresh dot + relative time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: 2 }}>
          {fresh && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent)', flexShrink: 0,
            }} />
          )}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
          }}>
            {relativeTime(item.createdAt)}
          </span>
        </div>
      </div>

      {/* Triage pills */}
      <TriagePills item={item} onAction={onAction} />
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  navigate: (s: Screen) => void
  back: () => void
}

export const InboxScreen = ({ back }: Props) => {
  const [undoState, setUndoState] = useState<UndoState | null>(null)

  const items = useLiveQuery(
    () => db.inboxItems.where('status').equals('inbox').sortBy('createdAt'),
    []
  ) ?? []

  const fresh = items.filter(i => isFresh(i.createdAt))
  const older = items.filter(i => !isFresh(i.createdAt))

  const voiceN   = items.filter(i => i.source === 'voice').length
  const shareN   = items.filter(i => i.source === 'share').length
  const captureN = items.filter(i => i.source === 'capture' || i.source === 'email').length

  function handleAction(undo: UndoState) {
    setUndoState(undo)
  }

  const n = items.length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--paper)',
      borderRadius: '20px 20px 0 0', overflow: 'hidden',
    }}>
      {/* Sheet handle */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        paddingTop: 10, paddingBottom: 4, flexShrink: 0,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
      </div>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 20px 14px', borderBottom: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <button onClick={back} style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
          <Icons.close size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            color: 'var(--ink-3)', textTransform: 'uppercase',
          }}>
            Inbox · {n} to process
          </div>
        </div>
        {/* Overflow placeholder */}
        <button style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
          <Icons.more size={20} />
        </button>
      </div>

      {/* Scroll area */}
      <div className="screen-scroll" style={{ padding: '20px 20px 40px', flex: 1 }}>

        {/* Empty state */}
        {n === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.6,
            }}>
              Nothing to sort. Capture something when it comes.
            </p>
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
            </div>

            {/* Fresh section */}
            {fresh.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <SectionHeader title="Fresh" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {fresh.map(item => (
                    <InboxRow key={item.id} item={item} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )}

            {/* Older section */}
            {older.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <SectionHeader title="Older" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {older.map(item => (
                    <InboxRow key={item.id} item={item} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Undo toast */}
      {undoState && (
        <UndoToast undo={undoState} onDismiss={() => setUndoState(null)} />
      )}
    </div>
  )
}
