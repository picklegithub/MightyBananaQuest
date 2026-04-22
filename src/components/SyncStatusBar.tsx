/**
 * SyncStatusBar — Rich sync UI shown at the top of the app.
 *
 * Also exports `triggerSync()` as a named export so other components
 * can initiate a sync without mounting this component.
 */

import React, { useEffect, useRef } from 'react'
import { useSyncState, setSyncState, getSyncState } from '../lib/syncState'
import { previewPull, applyPull, pushOnly } from '../lib/sync'

// ── triggerSync (named export) ────────────────────────────────────────────────

let _syncInFlight = false

export async function triggerSync(): Promise<void> {
  if (_syncInFlight) return
  _syncInFlight = true

  try {
    // Push phase
    setSyncState({ phase: 'pushing', pushProgress: 0, errorMsg: null })
    await pushOnly((done, total) => {
      setSyncState({ pushProgress: Math.round((done / total) * 100) })
    })

    // Preview phase
    setSyncState({ phase: 'previewing', pullProgress: 0 })
    const preview = await previewPull()

    // If there are deletions to confirm, surface the preview modal
    if (preview.toDelete.length > 0) {
      setSyncState({ phase: 'pulling', pendingPreview: preview })
      // Caller (SyncStatusBar) will handle user confirmation
      return
    }

    // No destructive changes — auto-apply
    setSyncState({ phase: 'pulling', pullProgress: 50 })
    await applyPull(preview)
    setSyncState({ phase: 'done', pullProgress: 100, lastSyncAt: Date.now(), pendingPreview: null })

    // Fade back to idle after 3s
    setTimeout(() => {
      if (getSyncState().phase === 'done') {
        setSyncState({ phase: 'idle' })
      }
    }, 3000)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    setSyncState({ phase: 'error', errorMsg: msg, pendingPreview: null })
  } finally {
    _syncInFlight = false
  }
}

// ── Format relative time ──────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  if (ts === 0) return 'never'
  const diffMs  = Date.now() - ts
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{
      height: 3, borderRadius: 2,
      background: 'var(--rule)',
      overflow: 'hidden',
      flex: 1,
      maxWidth: 120,
    }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: 'var(--accent)',
        borderRadius: 2,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

// ── Pull Confirmation Modal ────────────────────────────────────────────────────

function PullConfirmModal() {
  const { pendingPreview } = useSyncState()
  if (!pendingPreview) return null

  const { toAdd, toUpdate, toDelete } = pendingPreview

  async function handleApply() {
    setSyncState({ pendingPreview: null, phase: 'pulling', pullProgress: 50 })
    try {
      await applyPull(pendingPreview!)  // pendingPreview is non-null here (checked by parent)
      setSyncState({ phase: 'done', pullProgress: 100, lastSyncAt: Date.now() })
      setTimeout(() => {
        if (getSyncState().phase === 'done') setSyncState({ phase: 'idle' })
      }, 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apply failed'
      setSyncState({ phase: 'error', errorMsg: msg })
    }
  }

  function handleKeepLocal() {
    setSyncState({ pendingPreview: null, phase: 'idle' })
  }

  async function handlePushOnly() {
    setSyncState({ pendingPreview: null, phase: 'pushing', pushProgress: 0 })
    try {
      await pushOnly((done, total) => {
        setSyncState({ pushProgress: Math.round((done / total) * 100) })
      })
      setSyncState({ phase: 'done', lastSyncAt: Date.now() })
      setTimeout(() => {
        if (getSyncState().phase === 'done') setSyncState({ phase: 'idle' })
      }, 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      setSyncState({ phase: 'error', errorMsg: msg })
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 10000,
      display: 'flex', alignItems: 'flex-end',
    }}
      onClick={e => { if (e.target === e.currentTarget) handleKeepLocal() }}
    >
      <div style={{
        background: 'var(--paper)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          marginBottom: 12,
          color: 'var(--ink)',
        }}>
          Pull from cloud?
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          letterSpacing: '0.05em',
          display: 'flex', flexDirection: 'column', gap: 4,
          marginBottom: 16,
        }}>
          {toAdd.length > 0 && (
            <div>+{toAdd.length} new task{toAdd.length !== 1 ? 's' : ''}</div>
          )}
          {toUpdate.length > 0 && (
            <div>~{toUpdate.length} updated task{toUpdate.length !== 1 ? 's' : ''}</div>
          )}
          {toDelete.length > 0 && (
            <div style={{ color: 'var(--warn)' }}>
              {toDelete.length} will be removed locally
            </div>
          )}
          {toAdd.length === 0 && toUpdate.length === 0 && toDelete.length === 0 && (
            <div>No changes to apply</div>
          )}
        </div>

        {toDelete.length > 0 && (
          <div style={{
            background: 'var(--warn-soft)',
            border: '1px solid var(--warn)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--warn)',
            lineHeight: 1.5,
          }}>
            Removing {toDelete.length} task{toDelete.length !== 1 ? 's' : ''} that{' '}
            {toDelete.length !== 1 ? 'were' : 'was'} deleted on another device.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleKeepLocal}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'var(--paper-2)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)', fontSize: 14, fontWeight: 500,
            }}
          >
            Keep local only
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'var(--ink)',
              color: 'var(--paper)', fontSize: 14, fontWeight: 600,
            }}
          >
            Pull changes
          </button>
        </div>

        <button
          onClick={handlePushOnly}
          style={{
            marginTop: 14,
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: '0.05em',
            textAlign: 'center',
          }}
        >
          Push only (don&apos;t pull)
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SyncStatusBar() {
  const syncState = useSyncState()
  const { phase, pushProgress, pullProgress, lastSyncAt, errorMsg, pendingPreview } = syncState

  // Tick "last synced" display every minute
  const [, setTick] = React.useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 60000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 16px',
    minHeight: 28,
    background: 'var(--paper-2)',
    borderBottom: '1px solid var(--rule)',
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.05em',
    color: 'var(--ink-3)',
    position: 'relative',
    zIndex: 100,
  }

  if (phase === 'idle') {
    return (
      <>
        <div style={barStyle}>
          <span style={{ flex: 1 }}>
            Last synced: {relativeTime(lastSyncAt)}
          </span>
          <button
            onClick={triggerSync}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.05em',
              color: 'var(--accent)',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid var(--accent)',
            }}
          >
            Sync
          </button>
        </div>
        {pendingPreview && <PullConfirmModal />}
      </>
    )
  }

  if (phase === 'pushing') {
    return (
      <div style={barStyle}>
        <span>Pushing&hellip;</span>
        <ProgressBar value={pushProgress} />
      </div>
    )
  }

  if (phase === 'previewing') {
    return (
      <div style={barStyle}>
        <span>Checking for changes&hellip;</span>
        <ProgressBar value={pullProgress} />
      </div>
    )
  }

  if (phase === 'pulling') {
    return (
      <>
        <div style={barStyle}>
          <span>Pulling&hellip;</span>
          <ProgressBar value={pullProgress} />
        </div>
        {pendingPreview && <PullConfirmModal />}
      </>
    )
  }

  if (phase === 'done') {
    return (
      <div style={{ ...barStyle, color: 'var(--accent)' }}>
        <span>Synced</span>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ ...barStyle, color: 'var(--warn)', background: 'var(--warn-soft)' }}>
        <span style={{ flex: 1 }}>{errorMsg ?? 'Sync error'}</span>
        <button
          onClick={triggerSync}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--warn)', letterSpacing: '0.05em',
            padding: '2px 8px', borderRadius: 4,
            border: '1px solid var(--warn)',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return null
}
