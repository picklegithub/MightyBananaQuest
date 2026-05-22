import React from 'react'
import { Icons } from '../ui/Icons'
import { useCurrentDate } from '../../lib/useCurrentDate'
import { areaColor } from '../../lib/areaColor'
import { useIsDark } from '../../lib/colorMode'

interface ScreenHeaderProps {
  title: string
  /** Optional mono eyebrow subtitle below the title */
  subtitle?: string
  /**
   * When provided, a home icon is rendered to the left of the title.
   * Tapping it navigates to Today. Omit on the root Dashboard screen.
   */
  back?: () => void
  /**
   * Optional hue (0–360) to tint the home icon — used by area screens
   * to carry the area colour into the header.
   */
  iconHue?: number
  /**
   * Custom icon node to render instead of the default home icon.
   * Navigation behaviour (back tap) is unchanged.
   */
  icon?: React.ReactNode
  /** Extra controls rendered on the trailing edge of the title row */
  rightActions?: React.ReactNode
  /**
   * Optional content rendered below the title block — used for
   * inline progress bars, etc.
   */
  footer?: React.ReactNode
  /** Remove the bottom border rule — use when the first scroll content provides its own divider */
  noBorder?: boolean
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  iconHue,
  icon,
  rightActions,
  footer,
  noBorder,
}: ScreenHeaderProps) {
  const { dateStr } = useCurrentDate()
  const isDark      = useIsDark()

  const homeColor = iconHue !== undefined
    ? areaColor(iconHue, 'fg', isDark)
    : 'var(--ink-2)'

  return (
    <div style={{ padding: '14px 20px 12px', borderBottom: noBorder ? 'none' : '1px solid var(--rule)', flexShrink: 0 }}>

      {/* Date eyebrow */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
        color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase',
      }}>
        {dateStr}
      </div>

      {/* Title row: home icon + title + trailing actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {back ? (
          <button
            onClick={back}
            aria-label="Go to Today"
            style={{ color: homeColor, flexShrink: 0, display: 'flex', alignItems: 'center' }}
          >
            {icon ?? <Icons.home size={22} />}
          </button>
        ) : (
          <span style={{ color: 'var(--ink-4)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {icon ?? <Icons.home size={22} />}
          </span>
        )}

        <h1 className="t-display" style={{ fontSize: 22, flex: 1, minWidth: 0 }}>{title}</h1>

        {rightActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {rightActions}
          </div>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
          letterSpacing: '0.06em', marginTop: 4,
        }}>
          {subtitle}
        </div>
      )}

      {/* Optional footer (e.g. progress bar) */}
      {footer}
    </div>
  )
}
