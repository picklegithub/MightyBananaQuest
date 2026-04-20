import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icons } from '../components/ui/Icons'

interface Props {
  onAuth: () => void
}

type AuthStep = 'email' | 'sent'

export const AuthScreen = ({ onAuth }: Props) => {
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.href,
      },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setStep('sent')
    }
  }

  // Check if we've come back from a magic link (hash fragment)
  React.useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        onAuth()
      }
    })
  }, [onAuth])

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
      {/* Logo / wordmark */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div className="t-display" style={{ fontSize: 28, letterSpacing: '-0.02em', marginBottom: 6 }}>
          🍌 MightyBananaQuest
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
          YOUR PERSONAL LIFE ADMIN
        </div>
      </div>

      {step === 'email' ? (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Sign in</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              We'll send a magic link to your email — no password needed.
            </div>
          </div>

          <form onSubmit={handleSendLink}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 15,
                border: '1px solid var(--rule)', background: 'var(--paper-2)',
                color: 'var(--ink)', outline: 'none', marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--warn)', fontFamily: 'var(--font-mono)', padding: '8px 12px', background: 'var(--warn-soft)', borderRadius: 8 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: loading || !email.trim() ? 'var(--paper-3)' : 'var(--ink)',
                color: loading || !email.trim() ? 'var(--ink-3)' : 'var(--paper)',
                fontSize: 15, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .15s',
              }}
            >
              {loading ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>SENDING…</span>
              ) : (
                <>
                  <Icons.arrow size={18} />
                  Send magic link
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            All data is stored on-device and synced securely to your account.
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Check your inbox</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 24 }}>
            We sent a magic link to <strong>{email}</strong>.<br />
            Click it to sign in — it's good for 10 minutes.
          </div>
          <button
            onClick={() => { setStep('email'); setError(null) }}
            style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
          >
            ← Use a different email
          </button>
        </div>
      )}
    </div>
  )
}
