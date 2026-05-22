import React from 'react'

interface SectionLabelProps {
  children: React.ReactNode
  /** Optional right-side action element */
  action?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * SectionLabel — mono eyebrow with optional horizontal rule and action.
 * Replaces ad-hoc `className="eyebrow"` + rule combos scattered across screens.
 *
 * Usage:
 *   <SectionLabel>Today</SectionLabel>
 *   <SectionLabel action={<button>See all</button>}>Active tasks</SectionLabel>
 */
export const SectionLabel = ({ children, action, style }: SectionLabelProps) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    ...style,
  }}>
    <span className="eyebrow">{children}</span>
    {action && <div>{action}</div>}
  </div>
)
