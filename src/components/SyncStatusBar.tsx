/**
 * SyncStatusBar — Rich sync UI shown at the top of the app.
 *
 * Also exports `triggerSync()` so other components can initiate a sync
 * without mounting this component.
 *
 * With the new incremental-sync architecture the flow is:
 *   1. Drain outbox  (push pending local changes to Supabase)
 *   2. Incremental pull  (fetch only rows changed since lastPullAt)
 * No preview modal needed — there are no destructive "remote deleted" surprises
 * because soft-delete propagation is handled transparently in the pull.
 */

import React, { useEffect, useRef } from 'react'
import { useSyncState, setSyncState, getSyncState } from '../lib/syncState'
import { drainOutbox, incrementalPull, outboxSize, outboxDeadCount, retryDeadLettered } from '../lib/sync'

// ── triggerSync (named export) ────────────────────────────────────────────────

let _syncInFlight  = false
let _cancelRequested = false

/** Stop any in-progress sync. Leaves all local data intact. */
export function cancelSync(): void {
  _cancelRequested = true
  _syncInFlight    = false
  setSyncState({ phase: 'idle', errorMsg: null })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms
    )
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) }
    )
  })
}

export async function triggerSync(): Promise<void> {
  if (_syncInFlight) return
  _syncInFlight    = true
  _cancelRequested = false   // clear any previous cancel

  try {
    // ── Phase 1: Drain outbox ─────────────────────────────────────────────
    setSyncState({ phase: 'pushing', pushProgress: 0, errorMsg: null })
    const failures = await withTimeout(drainOutbox(), 30_000, 'Drain outbox')
    setSyncState({ pushProgress: 100 })

    if (failures > 0) {
      // Some entries failed but we continue to pull — they'll retry next sync
      console.warn(`[sync] ${failures} outbox entries failed — will retry`)
    }

    // ── Phase 2: Incremental pull ─────────────────────────────────────────
    setSyncState({ phase: 'pulling', pullProgress: 10 })
    const { pulled, deleted } = await withTimeout(incrementalPull(), 45_000, 'Incremental pull')
    setSyncState({ pullProgress: 100 })

    console.debug(`[sync] pulled ${pulled} rows, soft-deleted ${deleted} rows`)

    // If the user hit Cancel while we were in-flight, don't overwrite idle state
    if (_cancelRequested) return

    setSyncState({
      phase:        'done',
      pullProgress: 100,
      lastSyncAt:   Date.now(),
    })

    // Fade back to idle after 3 s
    setTimeout(() => {
      if (getSyncState().phase === 'done') setSyncState({ phase: 'idle' })
    }, 3000)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    setSyncState({ phase: 'error', errorMsg: msg })
  } finally {
    _syncInFlight = false
  }
}

// ── Format relative time ──────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export default function SyncStatusBar() {
  const syncState = useSyncState()
  const { phase, pushProgress, pullProgress, lastSyncAt, errorMsg } = syncState

  // Pending + dead-lettered outbox counts — poll every 5 s
  const [pending, setPending] = React.useState(0)
  const [dead,    setDead]    = React.useState(0)
  useEffect(() => {
    let alive = true
    const refresh = () => {
      outboxSize().then(n => { if (alive) setPending(n) }).catch(() => {})
      outboxDeadCount().then(n => { if (alive) setDead(n) }).catch(() => {})
    }
    refresh()
    const id = setInterval(refresh, 5_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // Tick "last synced" display every minute
  const [, setTick] = React.useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 60_000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const barStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    padding:      '4px 16px',
    minHeight:    28,
    background:   'var(--paper-2)',
    borderBottom: '1px solid var(--rule)',
    flexShrink:   0,
    fontFamily:   'var(--font-mono)',
    fontSize:     10,
    letterSpacing: '0.05em',
    color:        'var(--ink-3)',
    position:     'relative',
    zIndex:       100,
  }

  if (phase === 'idle') {
    return (
      <div style={barStyle}>
        <span style={{ flex: 1 }}>
          Last synced: {relativeTime(lastSyncAt)}
          {pending > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--warn)' }}>· {pending} pending</span>
          )}
          {dead > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--warn)' }}>· {dead} failed</span>
          )}
        </span>
        {dead > 0 && (
          <button
            onClick={() => retryDeadLettered().then(triggerSync)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              color: 'var(--warn)', padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--warn)', marginRight: 4,
            }}
          >
            Retry failed
          </button>
        )}
        <button
          onClick={triggerSync}
          style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      10,
            letterSpacing: '0.05em',
            color:         pending > 0 ? 'var(--warn)' : 'var(--accent)',
            padding:       '2px 8px',
            borderRadius:  4,
            border:        `1px solid ${pending > 0 ? 'var(--warn)' : 'var(--accent)'}`,
          }}
        >
          Sync{pending > 0 ? ` (${pending})` : ''}
        </button>
      </div>
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
      <div style={barStyle}>
        <span>Pulling&hellip;</span>
        <ProgressBar value={pullProgress} />
      </div>
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
            fontFamily:    'var(--font-mono)',
            fontSize:      10,
            color:         'var(--warn)',
            letterSpacing: '0.05em',
            padding:       '2px 8px',
            borderRadius:  4,
            border:        '1px solid var(--warn)',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return null
}
