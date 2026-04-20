import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveInboxItem } from '../data/db'
import { Icons } from './ui/Icons'
import type { Screen } from '../types'

interface Props {
  navigate: (s: Screen) => void
  visible: boolean  // hide on AddScreen to avoid double entry-points
}

export function QuickCapture({ navigate, visible }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [catId, setCatId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  async function handleCapture() {
    if (!text.trim()) return
    const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    await saveInboxItem({
      id: `i${Date.now()}`,
      kind: 'capture',
      text: text.trim(),
      source: catId || undefined,
      when: now,
      processed: false,
    })
    setText('')
    setCatId('')
    setOpen(false)
  }

  if (!visible) return null

  return (
    <>
      {/* Floating action button — bottom-right, above nav bar */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick capture"
        style={{
          position: 'fixed', bottom: 82, right: 20, zIndex: 50,
          width: 46, height: 46, borderRadius: '50%',
          background: 'var(--ink)', color: 'var(--paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-pop)',
          border: '2px solid var(--paper)',
        }}
      >
        <Icons.bolt size={17} />
      </button>

      {/* Bottom sheet */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 150, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div className="t-display" style={{ fontSize: 18 }}>Quick capture</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 2 }}>
                  SAVES TO INBOX
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--ink-3)' }}>
                <Icons.close size={20} />
              </button>
            </div>

            {/* Text input */}
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && text.trim() && handleCapture()}
              placeholder="Buy pool chemicals, call the vet…"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                border: '1px solid var(--rule)', background: 'var(--paper-2)',
                fontSize: 15, color: 'var(--ink)', marginBottom: 14,
              }}
            />

            {/* Area chips — optional tagging */}
            {categories && categories.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => setCatId('')} style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 11,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: catId === '' ? 'var(--ink)' : 'var(--paper-2)',
                  color: catId === '' ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: catId === '' ? 'var(--ink)' : 'var(--rule)',
                }}>
                  Inbox
                </button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setCatId(c.id)} style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 11,
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                    background: catId === c.id ? `hsl(${c.hue},55%,42%)` : 'var(--paper-2)',
                    color: catId === c.id ? 'white' : 'var(--ink-2)',
                    border: '1px solid', borderColor: catId === c.id ? 'transparent' : 'var(--rule)',
                  }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCapture}
                disabled={!text.trim()}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600, fontSize: 14,
                  background: text.trim() ? 'var(--ink)' : 'var(--paper-3)',
                  color: text.trim() ? 'var(--paper)' : 'var(--ink-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icons.inbox size={16} /> Capture
              </button>
              <button
                onClick={() => { setOpen(false); navigate({ name: 'add' }) }}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: '1px solid var(--rule)', background: 'var(--paper-2)',
                  color: 'var(--ink-2)', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icons.edit size={14} /> Full form
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
