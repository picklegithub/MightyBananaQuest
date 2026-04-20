import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import type { Screen, InboxItem } from '../types'

interface Props { navigate: (s: Screen) => void; back: () => void }

const KIND_ICON: Record<InboxItem['kind'], string> = {
  capture: 'mic',
  rss:     'rss',
  email:   'inbox',
}

const KIND_COLOR: Record<InboxItem['kind'], string> = {
  capture: 'var(--accent)',
  rss:     'hsl(145,55%,40%)',
  email:   'hsl(240,55%,55%)',
}

export const InboxScreen = ({ navigate, back }: Props) => {
  const items = useLiveQuery(() => db.inbox.toArray(), [])

  if (!items) return null

  const unprocessed = items.filter(i => !i.processed)
  const processed   = items.filter(i => i.processed)

  async function dismiss(id: string) {
    await db.inbox.update(id, { processed: true })
  }

  async function addAsTask(item: InboxItem) {
    await db.inbox.update(item.id, { processed: true })
    // Navigate to add screen pre-filled (simplified: just go to add)
    navigate({ name: 'add' })
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center' }}>
          <Icons.back size={20} />
        </button>
        <div>
          <h1 className="t-display" style={{ fontSize: 22 }}>Inbox</h1>
          {unprocessed.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              {unprocessed.length} unprocessed
            </div>
          )}
        </div>
      </div>

      <div className="screen-scroll" style={{ padding: '12px 20px 40px' }}>
        {unprocessed.length === 0 && processed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Icons.inbox size={40} style={{ color: 'var(--ink-4)', margin: '0 auto 12px', display: 'block' }} />
            <div className="t-display" style={{ fontSize: 18, marginBottom: 6 }}>Inbox zero</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Nothing waiting for your attention.</div>
          </div>
        ) : (
          <>
            {unprocessed.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>To process</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {unprocessed.map(item => (
                    <InboxCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} onAddTask={() => addAsTask(item)} />
                  ))}
                </div>
              </div>
            )}

            {processed.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Processed</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.5 }}>
                  {processed.map(item => (
                    <InboxCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InboxCard({ item, onDismiss, onAddTask }: {
  item: InboxItem
  onDismiss?: () => void
  onAddTask?: () => void
}) {
  const I = Icons[KIND_ICON[item.kind]] ?? Icons.inbox
  const color = KIND_COLOR[item.kind]

  return (
    <div style={{
      background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'var(--paper-3)', color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {item.source && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' }}>
              {item.source}
            </div>
          )}
          <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 6 }}>{item.text}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{item.when}</div>
        </div>
      </div>

      {!item.processed && (onDismiss || onAddTask) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
          {onAddTask && (
            <button onClick={onAddTask} style={{
              flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
              background: 'var(--ink)', color: 'var(--paper)', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icons.plus size={12} /> Add as task
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} style={{
              flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
              background: 'var(--paper-3)', color: 'var(--ink-2)', letterSpacing: '0.04em', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icons.check size={12} /> Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}
