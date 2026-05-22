import React from 'react'

interface Props {
  name: string
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ScreenErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.name}]`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>
          Something went wrong
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)',
          letterSpacing: '0.04em', maxWidth: 280, lineHeight: 1.6,
        }}>
          {this.props.name} · {error.message}
        </div>
        <button
          onClick={this.reset}
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 12,
            background: 'var(--ink)', color: 'var(--paper)',
            fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em',
            border: 'none', cursor: 'pointer',
          }}
        >
          TRY AGAIN
        </button>
      </div>
    )
  }
}
