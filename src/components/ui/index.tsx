import React from 'react'
import { EFFORT } from '../../constants'
import type { EffortKey } from '../../types'

// ── Chip ─────────────────────────────────────────────────────────────────────
interface ChipProps { children: React.ReactNode; accent?: boolean; warn?: boolean }
export const Chip = ({ children, accent, warn }: ChipProps) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 999, fontSize: 11,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    border: '1px solid var(--rule)',
    background: accent ? 'var(--accent-soft)' : warn ? 'var(--warn-soft)' : 'var(--paper-2)',
    color: accent ? 'var(--ink)' : warn ? 'var(--warn)' : 'var(--ink-2)',
    borderColor: warn ? 'var(--warn-soft)' : 'var(--rule)',
  }}>{children}</span>
)

// ── Toggle ────────────────────────────────────────────────────────────────────
interface ToggleProps { on: boolean; onChange: (v: boolean) => void }
export const Toggle = ({ on, onChange }: ToggleProps) => (
  <button onClick={() => onChange(!on)} style={{
    width: 44, height: 26, borderRadius: 13, padding: 2,
    background: on ? 'var(--accent)' : 'var(--paper-3)',
    border: '1px solid', borderColor: on ? 'var(--accent)' : 'var(--rule)',
    transition: 'all .2s', display: 'flex', alignItems: 'center',
    justifyContent: on ? 'flex-end' : 'flex-start',
  }}>
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--paper)', boxShadow: 'var(--shadow-1)' }} />
  </button>
)

// ── EffortPip ────────────────────────────────────────────────────────────────
export const EffortPip = ({ effort, mono }: { effort: EffortKey; mono?: boolean }) => {
  const e = EFFORT[effort] ?? EFFORT.m
  const bars = e.bar
  const label = bars >= 5
    ? (e.mins >= 1440 ? Math.round(e.mins / 1440) + 'd' : Math.round(e.mins / 60) + 'h')
    : (e.mins >= 60 ? (e.mins / 60) + 'h' : e.mins + 'm')
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: mono ? 'var(--ink-3)' : 'var(--ink-2)', letterSpacing: '0.06em' }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {[1,2,3,4,5,6].map(i => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i <= bars ? 'currentColor' : 'transparent', border: '1px solid currentColor', opacity: i <= bars ? 1 : 0.35 }} />
        ))}
      </span>
      <span>{label}</span>
    </span>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
interface SectionHeaderProps { title: string; sub?: string; action?: React.ReactNode }
export const SectionHeader = ({ title, sub, action }: SectionHeaderProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--rule)', paddingBottom: 8 }}>
    <div>
      <div className="t-display" style={{ fontSize: 22 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2, letterSpacing: '0.06em' }}>{sub}</div>}
    </div>
    {action}
  </div>
)

// ── ConfettiBurst ─────────────────────────────────────────────────────────────
export const ConfettiBurst = ({ x, y, xp }: { x: number; y: number; xp: number }) => {
  const pieces = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * Math.PI * 2 + Math.random() * 0.4,
    d: 30 + Math.random() * 40,
    r: -20 + Math.random() * 40,
    s: 0.7 + Math.random() * 0.6,
  })), [])
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', left: 0, top: 0, width: 6, height: 8,
          background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--ink)' : 'var(--warn)',
          transform: `translate(${Math.cos(p.a)*p.d}px, ${Math.sin(p.a)*p.d}px) rotate(${p.r}deg) scale(${p.s})`,
          opacity: 0, animation: 'cf 1.2s ease-out forwards', animationDelay: `${i*0.01}s`,
        }} />
      ))}
      <span style={{ position: 'absolute', left: -30, top: -40, width: 60, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600, animation: 'xpFloat 1.2s ease-out forwards' }}>
        +{xp} XP
      </span>
      <style>{`
        @keyframes cf { 0%{opacity:1;transform:translate(0,0)} 100%{opacity:0} }
        @keyframes xpFloat { 0%{opacity:0;transform:translateY(0)} 20%{opacity:1} 100%{opacity:0;transform:translateY(-30px)} }
      `}</style>
    </div>
  )
}

// ── Seg (segmented control) ───────────────────────────────────────────────────
interface SegOption { v: string; l: string }
export const Seg = ({ value, setValue, options }: { value: string; setValue: (v: string) => void; options: SegOption[] }) => (
  <div style={{ display: 'flex', background: 'var(--paper-2)', borderRadius: 8, padding: 2, gap: 2, border: '1px solid var(--rule)' }}>
    {options.map(o => (
      <button key={o.v} onClick={() => setValue(o.v)} style={{
        padding: '6px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        background: value === o.v ? 'var(--ink)' : 'transparent',
        color: value === o.v ? 'var(--paper)' : 'var(--ink-2)',
      }}>{o.l}</button>
    ))}
  </div>
)
