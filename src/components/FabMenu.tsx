import React, { useEffect } from 'react'
import { Icons } from './ui/Icons'

export type FabAction = 'capture' | 'task' | 'goal' | 'habit' | 'journal' | 'pomodoro'

interface MenuItem {
  action: FabAction
  label: string
  icon: string
  accent?: boolean
}

const ITEMS: MenuItem[] = [
  { action: 'journal',  label: 'Journal entry',  icon: 'journal' },
  { action: 'goal',     label: 'New goal',        icon: 'target'  },
  { action: 'habit',    label: 'New habit',       icon: 'flame', accent: true },
  { action: 'task',     label: 'New task',        icon: 'plus'    },
  { action: 'pomodoro', label: 'Pomodoro',        icon: 'timer'   },
]

interface Props {
  onSelect: (action: FabAction) => void
  onClose: () => void
}

export function FabMenu({ onSelect, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Menu — stacked above FAB center */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(74px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 195,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
      }}>
        {[...ITEMS].reverse().map((item, i) => {
          const I = Icons[item.icon]
          return (
            <button
              key={item.action}
              onClick={() => onSelect(item.action)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 18px 10px 12px',
                background: 'var(--paper)', border: '1px solid var(--rule)',
                borderRadius: 999, boxShadow: 'var(--shadow-2)',
                fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                whiteSpace: 'nowrap',
                animation: `fabMenuItemIn 0.16s ease ${i * 0.035}s both`,
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: item.accent ? 'var(--warn-soft)' : 'var(--paper-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: item.accent ? 'var(--warn)' : 'var(--ink-2)',
              }}>
                <I size={13} />
              </span>
              {item.label}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes fabMenuItemIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
