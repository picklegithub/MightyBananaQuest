import React, { useRef, useCallback } from 'react'
import { Icons } from '../ui/Icons'
import type { Screen } from '../../types'

type TabId = 'dashboard' | 'journal' | 'inbox' | 'more'

interface BottomNavProps {
  active: string
  navigate: (s: Screen) => void
  navigateTab: (s: Screen) => void
  onFabTap: () => void
  onFabLongPress: () => void
  onSearchTap?: () => void
  onMoreTap?: () => void
}

const LONG_PRESS_MS = 480

export const BottomNav = ({ active, navigate, navigateTab, onFabTap, onFabLongPress, onSearchTap, onMoreTap }: BottomNavProps) => {
  const pressTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const startPress = useCallback(() => {
    didLongPress.current = false
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onFabLongPress()
    }, LONG_PRESS_MS)
  }, [onFabLongPress])

  const endPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    if (!didLongPress.current) onFabTap()
    didLongPress.current = false
  }, [onFabTap])

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    didLongPress.current = false
  }, [])

  const tabs: { id: TabId; label: string; icon: string; onTap: () => void }[] = [
    { id: 'dashboard',  label: 'Today',   icon: 'home',    onTap: () => navigateTab({ name: 'dashboard' }) },
    { id: 'journal',    label: 'Journal', icon: 'journal', onTap: () => navigateTab({ name: 'journal' }) },
    { id: 'inbox',      label: 'Inbox',   icon: 'inbox',   onTap: () => navigateTab({ name: 'inbox' }) },
    { id: 'more',       label: 'Explore', icon: 'layers',  onTap: onMoreTap ?? (() => {}) },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '10px 6px calc(10px + env(safe-area-inset-bottom))',
      borderTop: '1px solid var(--rule)', background: 'var(--paper)',
      flexShrink: 0, position: 'relative',
    }}>
      {/* Left two tabs */}
      {tabs.slice(0, 2).map(it => {
        const I = (Icons as Record<string, React.FC<{ size?: number }>>)[it.icon] ?? Icons.home
        const isActive = active === it.id
        return (
          <button key={it.id}
            onClick={it.onTap}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: isActive ? 'var(--ink)' : 'var(--ink-3)', width: 64, padding: '4px 0', minHeight: 44,
            }}>
            <I size={20} />
            <span style={{ fontSize: 10, letterSpacing: '0.04em', fontWeight: isActive ? 600 : 400 }}>{it.label}</span>
          </button>
        )
      })}

      {/* Centre FAB — single tap = quick capture, long press = menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={cancelPress}
          onTouchStart={startPress}
          onTouchEnd={e => { e.preventDefault(); endPress() }}
          onTouchCancel={cancelPress}
          aria-label="Add"
          style={{
            width: 54, height: 54, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-2)', marginTop: -22,
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
        >
          <Icons.plus size={22} />
        </button>
        {/* Hold hint — surfaces the long-press gesture */}
        <div style={{
          position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
          color: 'var(--ink-4)', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          hold
        </div>
      </div>

      {/* Right two tabs */}
      {tabs.slice(2).map(it => {
        const I = (Icons as Record<string, React.FC<{ size?: number }>>)[it.icon] ?? Icons.home
        const isActive = active === it.id
        return (
          <button key={it.id}
            onClick={it.onTap}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: isActive ? 'var(--ink)' : 'var(--ink-3)', width: 64, padding: '4px 0', minHeight: 44,
            }}>
            <I size={20} />
            <span style={{ fontSize: 10, letterSpacing: '0.04em', fontWeight: isActive ? 600 : 400 }}>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
