import React from 'react'
import { Icons } from './Icons'
import { areaColor } from '../../lib/areaColor'
import { useIsDark } from '../../lib/colorMode'

interface FieldRowProps {
  label: string
  value: string
  /** Icon key from the Icons map */
  icon?: string
  /** Category hue (0–360) — drives OKLCH area colour via areaColor() */
  iconHue?: number
  /** If provided, renders a tap affordance (edit icon) */
  onTap?: () => void
  style?: React.CSSProperties
}

/**
 * FieldRow — labelled summary row for quick-entry sheets.
 * Promoted from QuickCaptureSheet so other sheets can reuse it.
 *
 * Token-safe: uses areaColor() for icon chip colours, never raw hsl().
 */
export const FieldRow = ({ label, value, icon, iconHue, onTap, style }: FieldRowProps) => {
  const isDark = useIsDark()
  const I      = icon ? (Icons[icon as keyof typeof Icons] ?? null) : null

  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        width: '100%', padding: '10px 0',
        display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left',
        background: 'none', border: 'none', borderBottom: '1px solid var(--rule)',
        cursor: onTap ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div className="eyebrow">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {I && (
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: iconHue !== undefined ? areaColor(iconHue, 'bg', isDark) : 'var(--paper-2)',
            color:      iconHue !== undefined ? areaColor(iconHue, 'fg', isDark) : 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I size={13} />
          </div>
        )}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
        {onTap && <Icons.edit size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />}
      </div>
    </button>
  )
}
