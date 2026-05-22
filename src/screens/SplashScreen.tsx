/**
 * SplashScreen — used in two places:
 *   1. Auth gate while Supabase session resolves (App.tsx, onDone is noop)
 *   2. Routed /splash screen (MobileLayout, onDone navigates to dashboard/onboarding)
 */
import React, { useEffect } from 'react'
import mascotUrl from '/mascot.png'

interface Props {
  onDone: () => void
}

export function SplashScreen({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--ink)', color: 'var(--paper)', gap: 12,
    }}>
      <img src={mascotUrl} alt="MBQ Mascot" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <div className="t-display" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>MightyBananaQuest</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        opacity: 0.4, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        The small things, handled.
      </div>
    </div>
  )
}
