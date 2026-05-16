import React, { useState } from 'react'
import { addCategory } from '../../data/db'
import { Icons } from '../ui/Icons'
import { useIsDark } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'

export const AREA_ICONS = ['home','heart','briefcase','book','dollar','family','leaf','drop','bolt','star','bell','layers','pet']

interface Props { onClose: () => void }

export function AddAreaModal({ onClose }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('home')
  const [hue, setHue]   = useState(200)
  const isDark           = useIsDark()

  async function handleSave() {
    if (!name.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    await addCategory({ id: `${id}-${Date.now()}`, name: name.trim(), icon, hue })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 22 }}>New Area</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Name</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Pets, Pool, Mindfulness…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)' }} />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AREA_ICONS.map(ic => {
                const I = Icons[ic] ?? Icons.home
                return (
                  <button key={ic} onClick={() => setIcon(ic)} style={{
                    width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: icon === ic ? areaColor(hue, 'fg', isDark) : 'var(--paper-2)',
                    color: icon === ic ? 'var(--paper)' : 'var(--ink-2)',
                    border: '1px solid', borderColor: icon === ic ? 'transparent' : 'var(--rule)',
                  }}>
                    <I size={18} />
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Colour — hue {hue}°</div>
            <input type="range" min={0} max={360} value={hue} onChange={e => setHue(Number(e.target.value))}
              style={{ width: '100%', accentColor: `hsl(${hue},55%,42%)` }} />
            <div style={{ height: 24, borderRadius: 8, marginTop: 8, background: `hsl(${hue},55%,42%)` }} />
          </div>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: name.trim() ? 'var(--ink)' : 'var(--paper-3)',
            color: name.trim() ? 'var(--paper)' : 'var(--ink-3)',
          }}>
            Add area
          </button>
        </div>
      </div>
    </div>
  )
}
