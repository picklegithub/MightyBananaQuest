import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveInboxItem, addTask } from '../data/db'
import { Icons } from './ui/Icons'
import type { Screen, Task } from '../types'

interface Props {
  navigate: (s: Screen) => void
  visible: boolean
}

export function QuickCapture({ navigate, visible }: Props) {
  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [catId, setCatId]   = useState<string | null>(null)
  const [saved, setSaved]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  function reset() {
    setText('')
    setCatId(null)
    setSaved(false)
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function handleCapture() {
    const trimmed = text.trim()
    if (!trimmed) return

    if (catId) {
      // Area selected → save directly as a task, skip inbox
      const task: Task = {
        id: `t${Date.now()}`,
        title: trimmed,
        cat: catId,
        effort: 'm',
        due: 'Today',
        ctx: '@anywhere',
        quad: 'q2',
        recurring: null,
        done: false,
        streak: 0,
        sub: [],
      }
      await addTask(task)
    } else {
      // No area → inbox
      const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      await saveInboxItem({
        id: `i${Date.now()}`,
        kind: 'capture',
        text: trimmed,
        when: now,
        processed: false,
      })
    }

    setSaved(true)
    setTimeout(() => close(), 700)
  }

  if (!visible) return null

  const selectedCat = catId ? categories?.find(c => c.id === catId) : null
  const destination = selectedCat ? selectedCat.name : 'Inbox'

  return (
    <>
      {/* FAB — bottom-right, above nav bar */}
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
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div className="t-display" style={{ fontSize: 18 }}>Capture</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: 2 }}>
                  → {destination.toUpperCase()}
                </div>
              </div>
              <button onClick={close} style={{ color: 'var(--ink-3)' }}>
                <Icons.close size={20} />
              </button>
            </div>

            {/* Text input */}
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && text.trim() && handleCapture()}
              placeholder="What's on your mind?"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                border: '1px solid var(--rule)', background: 'var(--paper-2)',
                fontSize: 15, color: 'var(--ink)', marginBottom: 14,
              }}
            />

            {/* Optional area — sends directly to that area */}
            {categories && categories.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 8 }}>
                  SEND TO AREA (OPTIONAL)
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCatId(catId === c.id ? null : c.id)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 11,
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                        background: catId === c.id ? `hsl(${c.hue},55%,42%)` : 'var(--paper-2)',
                        color: catId === c.id ? 'white' : 'var(--ink-2)',
                        border: '1px solid', borderColor: catId === c.id ? 'transparent' : 'var(--rule)',
                        transition: 'all .15s',
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCapture}
                disabled={!text.trim() || saved}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12, fontWeight: 600, fontSize: 14,
                  background: saved
                    ? 'var(--accent-soft)'
                    : text.trim() ? 'var(--ink)' : 'var(--paper-3)',
                  color: saved
                    ? 'var(--ink)'
                    : text.trim() ? 'var(--paper)' : 'var(--ink-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all .15s',
                }}
              >
                {saved
                  ? <><Icons.check size={16} sw={2.5} /> Saved!</>
                  : catId
                    ? <><Icons.plus size={16} /> Add to {selectedCat?.name}</>
                    : <><Icons.inbox size={16} /> To Inbox</>
                }
              </button>
              <button
                onClick={() => { close(); navigate({ name: 'add' }) }}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: '1px solid var(--rule)', background: 'var(--paper-2)',
                  color: 'var(--ink-2)', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icons.edit size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
