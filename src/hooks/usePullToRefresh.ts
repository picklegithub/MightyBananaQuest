/**
 * usePullToRefresh — Touch-based pull-to-refresh hook
 *
 * Returns { pullRatio, isPulling, containerProps }
 * Spread containerProps onto the scrollable container div.
 */

import { useRef, useState, useCallback } from 'react'

interface PullToRefreshResult {
  pullRatio:      number   // 0–1, for indicator rendering
  isPulling:      boolean  // true while actively pulling
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove:  (e: React.TouchEvent) => void
    onTouchEnd:   () => void
  }
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  threshold = 72
): PullToRefreshResult {
  const [pullRatio, setPullRatio]   = useState(0)
  const [isPulling, setIsPulling]   = useState(false)
  const startYRef    = useRef<number | null>(null)
  const refreshingRef = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start tracking if already at top of scroll
    const el = e.currentTarget as HTMLElement
    if (el.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
    } else {
      startYRef.current = null
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null || refreshingRef.current) return
    const el = e.currentTarget as HTMLElement
    // If user has scrolled down, cancel
    if (el.scrollTop > 0) {
      startYRef.current = null
      setPullRatio(0)
      setIsPulling(false)
      return
    }
    const delta = e.touches[0].clientY - startYRef.current
    if (delta <= 0) {
      setPullRatio(0)
      setIsPulling(false)
      return
    }
    // Apply rubber-band easing: ratio grows quickly then plateaus
    const ratio = Math.min(delta / threshold, 1.4)
    setPullRatio(Math.min(ratio, 1))
    setIsPulling(delta > 8)
  }, [threshold])

  const onTouchEnd = useCallback(() => {
    if (startYRef.current === null || refreshingRef.current) return
    const doRefresh = pullRatio >= 1
    startYRef.current = null
    setPullRatio(0)
    setIsPulling(false)

    if (doRefresh) {
      refreshingRef.current = true
      onRefresh().finally(() => {
        refreshingRef.current = false
      })
    }
  }, [pullRatio, onRefresh])

  return {
    pullRatio,
    isPulling,
    containerProps: { onTouchStart, onTouchMove, onTouchEnd },
  }
}
