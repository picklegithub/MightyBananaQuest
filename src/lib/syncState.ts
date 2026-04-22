/**
 * syncState.ts — Simple event bus for sync progress, usable across components
 */

import { useEffect, useState } from 'react'
import type { PullPreview } from './sync'

export type SyncPhase = 'idle' | 'pushing' | 'previewing' | 'pulling' | 'done' | 'error'

export interface SyncState {
  phase:          SyncPhase
  pushProgress:   number           // 0–100
  pullProgress:   number           // 0–100
  lastSyncAt:     number           // ms timestamp, 0 = never
  errorMsg:       string | null
  pendingPreview: PullPreview | null  // set when awaiting user confirmation
}

const DEFAULT_STATE: SyncState = {
  phase:          'idle',
  pushProgress:   0,
  pullProgress:   0,
  lastSyncAt:     0,
  errorMsg:       null,
  pendingPreview: null,
}

let state: SyncState = { ...DEFAULT_STATE }
const subscribers = new Set<(s: SyncState) => void>()

function notify() {
  for (const cb of subscribers) {
    cb(state)
  }
}

export function getSyncState(): SyncState {
  return state
}

export function setSyncState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch }
  notify()
}

export function onSyncStateChange(cb: (s: SyncState) => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

export function useSyncState(): SyncState {
  const [s, setS] = useState<SyncState>(getSyncState)

  useEffect(() => {
    // Sync with latest in case it changed between render and effect
    setS(getSyncState())
    return onSyncStateChange(setS)
  }, [])

  return s
}
