import React, { useState } from 'react'
import { addGoal } from '../data/db'
import { Icons } from './ui/Icons'
import type { Category } from '../types'

const HORIZONS = ['4 weeks', '12 weeks', '6 months', '1 year', 'Ongoing']

interface Props {
  categories: Category[]
  onClose: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

export function AddGoalSheet({ categories, onClose }: Props) {
  const [title,   setTitle]   = useState('')
  const [area,    setArea]    = useState(categories[0]?.id ?? 'home')
  const [horizon, setHorizon] = useState('12 weeks')
  const [why,     setWhy]     = useState('')

  async function handleSave() {
    if (!title.trim()) return
    await addGoal({
      id: `g${Date.now()}`,
      title: title.trim(), area, horizon,
      why: why.trim(), progress: 0, linked: [],
    })
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--paper)', borderRadius: '20px 20px 0 0',
          width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + Header */}
        <div style={{ flexShrink: 0, padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--rule)' }}>
            <h2 className="t-display" style={{ fontSize: 20 }}>New Goal</h2>
            <button onClick={onClose} style={{ color: 'var(--ink-3)' }}>
              <Icons.close size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Goal">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Run a 10km under 50 minutes…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </Field>

          <Field label="Area">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setArea(c.id)} style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)',
                  background: area === c.id ? 'var(--ink)' : 'var(--paper-2)',
                  color: area === c.id ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: area === c.id ? 'var(--ink)' : 'var(--rule)',
                }}>{c.name}</button>
              ))}
            </div>
          </Field>

          <Field label="Horizon">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HORIZONS.map(h => (
                <button key={h} onClick={() => setHorizon(h)} style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)',
                  background: horizon === h ? 'var(--ink)' : 'var(--paper-2)',
                  color: horizon === h ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: horizon === h ? 'var(--ink)' : 'var(--rule)',
                }}>{h}</button>
              ))}
            </div>
          </Field>

          <Field label="Why does this matter?">
            <textarea value={why} onChange={e => setWhy(e.target.value)}
              placeholder="Energy for the year ahead…"
              style={{ width: '100%', minHeight: 72, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 14, resize: 'none', lineHeight: 1.5, color: 'var(--ink)' }} />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--rule)' }}>
          <button onClick={handleSave} disabled={!title.trim()} style={{
            width: '100%', padding: '15px', borderRadius: 14, fontSize: 15, fontWeight: 600,
            background: title.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: title.trim() ? 'var(--paper)' : 'var(--ink-3)',
          }}>
            Save goal
          </button>
        </div>
      </div>
    </div>
  )
}
