import React from 'react'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { useNav } from '../lib/navContext'

interface Props {
  title:       string
  icon:        string
  phase:       number
  description: string
}

export function ComingSoonScreen({ title, icon, phase, description }: Props) {
  const { back } = useNav()
  const I = (Icons as Record<string, React.FC<{ size?: number }>>)[icon] ?? Icons.sparkle

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--paper)', overflow: 'hidden',
    }}>
      <ScreenHeader
        title={title}
        back={back}
        icon={<I size={22} />}
      />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24, padding: '40px 32px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>🚧</div>

        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.16em', color: 'var(--accent)',
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            Coming in Phase {phase}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 26,
            fontStyle: 'italic', color: 'var(--ink)', margin: '0 0 14px',
          }}>
            {title}
          </h2>
          <p style={{
            fontSize: 14, color: 'var(--ink-3)',
            lineHeight: 1.65, maxWidth: 340, margin: '0 auto',
          }}>
            {description}
          </p>
        </div>

        <div style={{
          padding: '8px 18px', borderRadius: 20,
          border: '1px solid var(--rule)', background: 'var(--paper-2)',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '0.08em',
        }}>
          Phase {phase} of 9
        </div>
      </div>
    </div>
  )
}
