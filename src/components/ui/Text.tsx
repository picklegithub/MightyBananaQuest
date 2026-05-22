import React from 'react'

type Variant = 'eyebrow' | 'mono-label' | 'mono-caption' | 'display' | 'body' | 'body-sm'

interface TextProps {
  variant: Variant
  as?: keyof JSX.IntrinsicElements
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  'eyebrow':      {},  // handled by CSS class
  'mono-label':   {},  // handled by CSS class
  'mono-caption': {},  // handled by CSS class
  'display': {
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    letterSpacing: '-0.01em',
    lineHeight: 1.05,
  },
  'body': {
    fontFamily: 'var(--font-ui)',
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--ink)',
  },
  'body-sm': {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--ink-2)',
  },
}

const VARIANT_CLASS: Record<Variant, string> = {
  'eyebrow':      'eyebrow',
  'mono-label':   'mono-label',
  'mono-caption': 'mono-caption',
  'display':      't-display',
  'body':         '',
  'body-sm':      '',
}

/**
 * Text — enforces typographic variants from the design system.
 * Prevents ad-hoc fontSize/fontFamily combinations drifting out of spec.
 *
 * Usage:
 *   <Text variant="eyebrow">Section header</Text>
 *   <Text variant="display" style={{ fontSize: 22 }}>Title</Text>
 *   <Text variant="mono-caption">11px label</Text>
 */
export const Text = ({ variant, as: Tag = 'span', style, className, children }: TextProps) => {
  const baseStyle = VARIANT_STYLES[variant]
  const baseClass = VARIANT_CLASS[variant]
  const combined  = className ? `${baseClass} ${className}`.trim() : baseClass

  return (
    <Tag
      className={combined || undefined}
      style={baseStyle ? { ...baseStyle, ...style } : style}
    >
      {children}
    </Tag>
  )
}
