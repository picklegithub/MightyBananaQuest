/**
 * SyncStatusBar — E-2 Global Sync Bar
 *
 * States (from spec):
 *   idle     → ✓ "All synced" (gray) | N pending (amber) | N failed (red)
 *   pushing  → ◌ spinner + "Pushing…" + progress bar
 *   pulling  → ◌ spinner + "Pulling…" + progress bar
 *   done     → ✓ "Synced" (accent, fades to idle after 3s)
 *   error    → ⚠ "{msg} — tap to retry"
 *
 * Tapping the bar in idle/done/error opens SyncDashboardSheet (E-4).
 * Also exports `triggerSync()` so other components can initiate a sync.
 */

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useSyncState, setSyncState, getSyncState } from '../lib/syncState'
import { drainOutbox, incrementalPull, incrementalPullBySeq, outboxSize, outboxDeadCount, retryDeadLettered, pruneEventLog } from '../lib/sync'

const SyncDashboardSheet = lazy(() => import('./SyncDashboardSheet'))

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
  _cancelRequested = false

  try {
    // ── Phase 1: Drain outbox ─────────────────────────────────────────────
    setSyncState({ phase: 'pushing', pushProgress: 0, errorMsg: null })
    const failures = await withTimeout(drainOutbox(), 60_000, 'Drain outbox')
    setSyncState({ pushProgress: 100 })

    if (failures > 0) {
      console.warn(`[sync] ${failures} outbox entries failed — will retry`)
    }

    // ── Phase 2: Incremental pull ─────────────────────────────────────────
    setSyncState({ phase: 'pulling', pullProgress: 10 })
    const seqResult = await withTimeout(
      incrementalPullBySeq(pct => setSyncState({ pullProgress: pct })),
      45_000, 'Seq pull',
    )
    // VITE_REQUIRE_SERVER_SEQ=true retires the synced_at fallback — set once migration 007
    // is confirmed applied on all environments. Without the flag, falls back gracefully.
    const requireSeq = import.meta.env.VITE_REQUIRE_SERVER_SEQ === 'true'
    if (!seqResult && requireSeq) {
      console.warn('[sync] server_seq pull unavailable but VITE_REQUIRE_SERVER_SEQ=true — migration 007 may not be applied')
    }
    const { pulled, deleted } = seqResult ?? (requireSeq ? { pulled: 0, deleted: 0 } : await withTimeout(incrementalPull(), 45_000, 'Incremental pull'))
    setSyncState({ pullProgress: 100 })

    console.debug(`[sync] pulled ${pulled} rows, soft-deleted ${deleted} rows`)

    if (_cancelRequested) return

    setSyncState({
      phase:        'done',
      pullProgress: 100,
      lastSyncAt:   Date.now(),
    })

    // Prune old sync events — fire-and-forget, never blocks the happy path
    pruneEventLog()

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

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ color = 'var(--accent)' }: { color?: string }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
      border: `1.5px solid ${color}`,
      borderTopColor: 'transparent',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return (
    <div style={{
      height: 3, borderRadius: 2,
      background: 'var(--rule)',
      overflow: 'hidden',
      flex: 1,
      maxWidth: 100,
    }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: color,
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

  const [pending,       setPending]       = useState(0)
  const [dead,          setDead]          = useState(0)
  const [dashboardOpen, setDashboardOpen] = useState(false)

  // Poll outbox counts every 5 s
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

  // Tick "last synced" every minute
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 60_000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  const barBase: React.CSSProperties = {
    display:       'flex',
    alignItems:    'center',
    gap:           8,
    padding:       '4px 16px',
    minHeight:     28,
    background:    'var(--paper-2)',
    borderBottom:  '1px solid var(--rule)',
    flexShrink:    0,
    fontFamily:    'var(--font-mono)',
    fontSize:      10,
    letterSpacing: '0.05em',
    color:         'var(--ink-3)',
    position:      'relative',
    zIndex:        100,
    cursor:        'default',
    userSelect:    'none',
  }

  const tappable: React.CSSProperties = { ...barBase, cursor: 'pointer' }

  // ── Active sync phases ──────────────────────────────────────────────────────

  if (phase === 'pushing') {
    return (
      <div style={barBase}>
        <Spinner />
        <span style={{ flex: 1 }}>Pushing…</span>
        <ProgressBar value={pushProgress} />
      </div>
    )
  }

  if (phase === 'previewing') {
    return (
      <div style={barBase}>
        <Spinner />
        <span style={{ flex: 1 }}>Checking for changes…</span>
        <ProgressBar value={pullProgress} />
      </div>
    )
  }

  if (phase === 'pulling') {
    return (
      <div style={barBase}>
        <Spinner />
        <span style={{ flex: 1 }}>Pulling…</span>
        <ProgressBar value={pullProgress} />
      </div>
    )
  }

  // ── Done (brief flash) ──────────────────────────────────────────────────────

  if (phase === 'done') {
    return null
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <>
        <div
          onClick={() => setDashboardOpen(true)}
          style={{ ...tappable, color: 'var(--warn)', background: 'var(--warn-soft, rgba(239,68,68,0.08))' }}
        >
          <span style={{ fontSize: 11, flexShrink: 0 }}>⚠</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {errorMsg ?? 'Sync error'} — tap to retry
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); triggerSync() }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              color: 'var(--warn)', padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--warn)', flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
        {dashboardOpen && (
          <Suspense fallback={null}>
            <SyncDashboardSheet onClose={() => setDashboardOpen(false)} />
          </Suspense>
        )}
      </>
    )
  }

  // ── Idle ────────────────────────────────────────────────────────────────────

  if (dead === 0 && pending === 0) return null

  return (
    <>
      <div
        onClick={() => setDashboardOpen(true)}
        style={tappable}
      >
        {/* Left: status text */}
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Sync state indicator */}
          {dead > 0 ? (
            <span style={{ color: 'var(--warn)', fontSize: 11 }}>⚠</span>
          ) : pending > 0 ? (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#F59E0B',
              flexShrink: 0, display: 'inline-block',
              animation: 'syncPulse 1.8s ease-in-out infinite',
            }} />
          ) : (
            <span style={{ color: 'var(--accent)', fontSize: 11 }}>✓</span>
          )}

          {/* Primary label */}
          {dead > 0 ? (
            <span style={{ color: 'var(--warn)' }}>
              {dead} failed — tap to retry
            </span>
          ) : pending > 0 ? (
            <span style={{ color: '#F59E0B' }}>
              {pending} change{pending !== 1 ? 's' : ''} pending
            </span>
          ) : (
            <span>
              {lastSyncAt > 0 ? `Synced ${relativeTime(lastSyncAt)}` : 'All synced'}
            </span>
          )}
        </span>

        {/* Right: action buttons */}
        {dead > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); retryDeadLettered().then(triggerSync) }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              color: 'var(--warn)', padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--warn)', marginRight: 4, flexShrink: 0,
            }}
          >
            Retry
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); triggerSync() }}
          style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      10,
            letterSpacing: '0.05em',
            color:         dead > 0 ? 'var(--warn)' : pending > 0 ? '#F59E0B' : 'var(--accent)',
            padding:       '2px 8px',
            borderRadius:  4,
            border:        `1px solid ${dead > 0 ? 'var(--warn)' : pending > 0 ? '#F59E0B' : 'var(--accent)'}`,
            flexShrink:    0,
          }}
        >
          Sync{pending > 0 ? ` (${pending})` : ''}
        </button>
      </div>

      {dashboardOpen && (
        <Suspense fallback={null}>
          <SyncDashboardSheet onClose={() => setDashboardOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
