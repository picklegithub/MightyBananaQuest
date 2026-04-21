import React, { useRef, useState } from 'react'
import { Icons } from './ui/Icons'

interface Props {
  onComplete?: () => void
  onDelete?: () => void
  children: React.ReactNode
  disabled?: boolean
}

const THRESHOLD  = 64   // px to trigger action
const MAX_TRAVEL = 96   // px max drag distance shown

export function SwipeableRow({ onComplete, onDelete, children, disabled }: Props) {
  const [dx,        setDx]        = useState(0)
  const [releasing, setReleasing] = useState(false)
  const startX    = useRef(0)
  const tracking  = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    startX.current  = e.touches[0].clientX
    tracking.current = true
    setReleasing(false)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!tracking.current) return
    const raw  = e.touches[0].clientX - startX.current
    // Only allow right-swipe if onComplete provided, left-swipe if onDelete provided
    const clamped =
      raw > 0
        ? onComplete ? Math.min(raw, MAX_TRAVEL) : 0
        : onDelete   ? Math.max(raw, -MAX_TRAVEL) : 0
    if (Math.abs(clamped) > 8) e.preventDefault()
    setDx(clamped)
  }

  function onTouchEnd() {
    tracking.current = false
    setReleasing(true)
    if (dx >= THRESHOLD && onComplete) {
      onComplete()
      setDx(0)
    } else if (dx <= -THRESHOLD && onDelete) {
      onDelete()
      setDx(0)
    } else {
      setDx(0)
    }
    setTimeout(() => setReleasing(false), 300)
  }

  const revealRight = dx > 0   // complete (green)
  const revealLeft  = dx < 0   // delete  (red)
  const pct         = Math.abs(dx) / THRESHOLD

  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Green reveal (complete) ── */}
      {onComplete && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          paddingLeft: 20,
          background: `hsl(145, 60%, ${48 - pct * 6}%)`,
          opacity: revealRight ? Math.min(pct, 1) : 0,
          transition: releasing ? 'opacity .2s' : 'none',
          borderRadius: 12,
        }}>
          <Icons.check size={20} sw={2.5} style={{ color: 'white' }} />
        </div>
      )}

      {/* ── Red reveal (delete) ── */}
      {onDelete && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 20,
          background: `hsl(4, 75%, ${50 - pct * 6}%)`,
          opacity: revealLeft ? Math.min(pct, 1) : 0,
          transition: releasing ? 'opacity .2s' : 'none',
          borderRadius: 12,
        }}>
          <Icons.close size={18} style={{ color: 'white' }} />
        </div>
      )}

      {/* ── Card content ── */}
      <div style={{
        transform: `translateX(${dx}px)`,
        transition: releasing ? 'transform .28s cubic-bezier(.25,.8,.25,1)' : 'none',
        position: 'relative',
      }}>
        {children}
      </div>
    </div>
  )
}
