import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from './ui/Icons'
import type { AppSettings } from '../types'

type Theme = AppSettings['theme']

// Cycle order: light → dark → auto
const CYCLE: Theme[] = ['light', 'dark', 'auto']

const LABELS: Record<Theme, string> = {
  light: 'Light',
  dark:  'Dark',
  auto:  'Auto',
}

interface Props {
  /** 'icon' = just the icon button (for headers). 'pill' = icon + label. */
  variant?: 'icon' | 'pill'
}

export function ThemeToggle({ variant = 'icon' }: Props) {
  const settings = useLiveQuery(() => db.settings.get(1), [])
  if (!settings) return null

  const theme = settings.theme

  async function cycle() {
    const idx  = CYCLE.indexOf(theme)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    await db.settings.update(1, { theme: next })
  }

  const icon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'sparkle'
  const I    = Icons[icon]
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]

  if (variant === 'pill') {
    return (
      <button
        onClick={cycle}
        title={`Switch to ${LABELS[next]}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 20,
          border: '1px solid var(--rule)', background: 'var(--paper-2)',
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)',
          letterSpacing: '0.04em',
        }}
      >
        <I size={13} />
        {LABELS[theme].toUpperCase()}
      </button>
    )
  }

  return (
    <button
      onClick={cycle}
      title={`Switch to ${LABELS[next]}`}
      style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center' }}
    >
      <I size={20} />
    </button>
  )
}
