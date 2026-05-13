/**
 * SyncDashboardSheet — E-4 Sync Dashboard Widget
 *
 * Bottom sheet showing queue depth, dead-letter entries with error details,
 * and a retry button. Opens when user taps the SyncStatusBar in idle/error state.
 */

import React, { useEffect, useState } from 'react'
import { Icons } from './ui/Icons'
import { useSyncState } from '../lib/syncState'
import { outboxSize, outboxDeadCount, getDeadEntries, retryDeadLettered } from '../lib/sync'
import { triggerSync } from './SyncStatusBar'

interface DeadEntry {
  key: string
  table: string
  recordId: string
  attempts: number
  lastError?: string
}

interface Props {
  onClose: () => void
}

function relativeTime(ts: number): string {
  if (ts === 0) return 'never'
  const diffMs  = Date.now() - ts
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

function tableLabel(table: string): string {
  const map: Record<string, string> = {
    tasks: 'Task', habits: 'Habit', goals: 'Goal', journal: 'Journal',
    inbox: 'Inbox', categories: 'Category', settings: 'Settings',
    shopping_items: 'Shopping', weekly_reviews: 'Review', daily_plans: 'Daily plan',
  }
  return map[table] ?? table
}

export default function SyncDashboardSheet({ onClose }: Props) {
  const { lastSyncAt, phase, errorMsg } = useSyncState()
  const [pending, setPending]     = useState(0)
  const [dead,    setDead]        = useState(0)
  const [entries, setEntries]     = useState<DeadEntry[]>([])
  const [retrying, setRetrying]   = useState(false)

  const refresh = () => {
    outboxSize().then(setPending).catch(() => {})
    outboxDeadCount().then(setDead).catch(() => {})
    getDeadEntries().then(setEntries).catch(() => {})
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3_000)
    return () => clearInterval(id)
  }, [])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryDeadLettered()
      await triggerSync()
    } finally {
      setRetrying(false)
      refresh()
    }
  }

  const handleSync = () => {
    triggerSync()
    onClose()
  }

  const isActive = phase === 'pushing' || phase === 'pulling'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
        background: 'var(--paper-2)',
        borderRadius: '16px 16px 0 0',
        borderTop: '1px solid var(--rule)',
        padding: '0 0 env(safe-area-inset-bottom)',
        maxHeight: '75vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.22s ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 16px 12px',
          borderBottom: '1px solid var(--rule)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
            color: 'var(--ink-3)', textTransform: 'uppercase',
          }}>
            Sync Status
          </span>
          <button onClick={onClose} style={{ color: 'var(--ink-4)', padding: 4 }}>
            <Icons.close size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Stats grid ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 1, background: 'var(--rule)',
            borderBottom: '1px solid var(--rule)',
          }}>
            {[
              { label: 'Last sync', value: relativeTime(lastSyncAt) },
              { label: 'Pending',   value: pending > 0 ? String(pending) : '—', warn: pending > 0 },
              { label: 'Failed',    value: dead    > 0 ? String(dead)    : '—', error: dead    > 0 },
            ].map(({ label, value, warn, error }) => (
              <div key={label} style={{
                background: 'var(--paper-2)', padding: '14px 12px', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
                  color: error ? 'var(--warn)' : warn ? '#F59E0B' : 'var(--ink)',
                  marginBottom: 4,
                }}>
                  {value}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                  color: 'var(--ink-4)', textTransform: 'uppercase',
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Current status ── */}
          {phase === 'error' && errorMsg && (
            <div style={{
              margin: '12px 16px 0',
              padding: '10px 12px',
              background: 'var(--warn-soft, rgba(239,68,68,0.1))',
              borderRadius: 8,
              border: '1px solid var(--warn)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--warn)',
            }}>
              ⚠ {errorMsg}
            </div>
          )}

          {/* ── Dead-lettered entries ── */}
          {entries.length > 0 && (
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8,
              }}>
                Failed entries
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.slice(0, 8).map(e => (
                  <div key={e.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'var(--paper)', border: '1px solid var(--rule)',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--warn)', flexShrink: 0, marginTop: 4,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)',
                        marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {tableLabel(e.table)} · {e.recordId.slice(0, 8)}…
                      </div>
                      {e.lastError && (
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {e.lastError}
                        </div>
                      )}
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
                        marginTop: 2,
                      }}>
                        {e.attempts} attempt{e.attempts !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {entries.length > 8 && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)',
                    textAlign: 'center', padding: '4px 0',
                  }}>
                    +{entries.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {pending === 0 && dead === 0 && phase !== 'error' && (
            <div style={{
              padding: '24px 16px', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)',
            }}>
              ✓ Everything is synced
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ padding: '16px', display: 'flex', gap: 8 }}>
            {dead > 0 && (
              <button
                onClick={handleRetry}
                disabled={retrying || isActive}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em',
                  color: 'var(--warn)', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--warn)',
                  opacity: retrying || isActive ? 0.5 : 1,
                }}
              >
                {retrying ? 'Retrying…' : `Retry ${dead} failed`}
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={isActive}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em',
                color: 'var(--accent)', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--accent)',
                opacity: isActive ? 0.5 : 1,
              }}
            >
              {isActive ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
