import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icons } from '../components/ui/Icons'

interface Props {
  onAuth: () => void
}

type AuthStep = 'email' | 'sent'
type AuthMode = 'magic' | 'password'

export const AuthScreen = ({ onAuth }: Props) => {
  const [step, setStep] = useState<AuthStep>('email')
  const [mode, setMode] = useState<AuthMode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable redirect URL — uses current origin so magic links always land at the right place
  // e.g. http://localhost:5173/ in dev, https://yourname.github.io/MightyBananaQuest/ in prod
  const redirectTo = window.location.origin + window.location.pathname

  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setStep('sent')
    }
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)
    if (err) {
      if (err.message.toLowerCase().includes('invalid login credentials')) {
        setError('Wrong email or password. If you haven\'t set a password yet, use "Set password" below.')
      } else {
        setError(err.message)
      }
    }
    // onAuth() will be called via onAuthStateChange
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setStep('sent')
    }
  }

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        onAuth()
      }
    })
    return () => subscription.unsubscribe()
  }, [onAuth])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 15,
    border: '1px solid var(--rule)', background: 'var(--paper-2)',
    color: 'var(--ink)', outline: 'none', marginBottom: 12,
    boxSizing: 'border-box',
  }

  const submitButtonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '14px', borderRadius: 12,
    background: disabled ? 'var(--paper-3)' : 'var(--ink)',
    color: disabled ? 'var(--ink-3)' : 'var(--paper)',
    fontSize: 15, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all .15s',
  })

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
      {/* Logo / wordmark */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <img src="/mascot.png" alt="MBQ Mascot" style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: 12 }} />
        <div className="t-display" style={{ fontSize: 28, letterSpacing: '-0.02em', marginBottom: 6 }}>
          MightyBananaQuest
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
          YOUR PERSONAL LIFE ADMIN
        </div>
      </div>

      {step === 'email' ? (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Sign in</div>
          </div>

          {/* Mode toggle */}
          <div style={{
            display: 'flex', borderRadius: 10, border: '1px solid var(--rule)',
            background: 'var(--paper-2)', padding: 3, marginBottom: 20,
          }}>
            {(['magic', 'password'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  background: mode === m ? 'var(--ink)' : 'transparent',
                  color: mode === m ? 'var(--paper)' : 'var(--ink-3)',
                  transition: 'all .15s',
                }}
              >
                {m === 'magic' ? 'MAGIC LINK' : 'PASSWORD'}
              </button>
            ))}
          </div>

          {mode === 'magic' ? (
            <form onSubmit={handleSendMagicLink}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                style={inputStyle}
              />
              {error && <ErrorBox message={error} />}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={submitButtonStyle(loading || !email.trim())}
              >
                {loading
                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>SENDING…</span>
                  : <><Icons.arrow size={18} />Send magic link</>
                }
              </button>
              <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                We'll email you a one-tap sign-in link — no password needed.
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasswordSignIn}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                style={inputStyle}
              />
              {error && <ErrorBox message={error} />}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                style={submitButtonStyle(loading || !email.trim() || !password)}
              >
                {loading
                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>SIGNING IN…</span>
                  : <><Icons.arrow size={18} />Sign in</>
                }
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading}
                style={{
                  width: '100%', marginTop: 10, padding: '10px',
                  fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em', textAlign: 'center',
                }}
              >
                Set / reset password via email →
              </button>
            </form>
          )}

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            All data is stored on-device and synced securely to your account.
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Check your inbox</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 24 }}>
            We sent a link to <strong>{email}</strong>.<br />
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

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      marginBottom: 12, fontSize: 12, color: 'var(--warn)',
      fontFamily: 'var(--font-mono)', padding: '8px 12px',
      background: 'var(--warn-soft)', borderRadius: 8,
    }}>
      {message}
    </div>
  )
}
