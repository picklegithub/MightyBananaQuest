import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { useNav } from '../lib/navContext'
import { localDateISO } from '../lib/useCurrentDate'

const TA_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--paper)', border: '1px solid var(--rule)',
  borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-ui)',
  fontSize: 14, color: 'var(--ink)', resize: 'none', outline: 'none', lineHeight: 1.55,
  boxSizing: 'border-box',
}

export function PositivePsychologyScreen() {
  const { back } = useNav()
  const today = localDateISO()

  const [goods, setGoods] = useState([
    { good: '', why: '' },
    { good: '', why: '' },
    { good: '', why: '' },
  ])
  const [saved, setSaved] = useState(false)

  const existing = useLiveQuery(() => db.journal.get(`three-good-things:${today}`), [today])

  useEffect(() => {
    if (existing?.notes) {
      try { setGoods(JSON.parse(existing.notes)); setSaved(true) } catch {}
    }
  }, [existing])

  async function handleSave() {
    await saveJournalEntry({
      id: `three-good-things:${today}`,
      date: today,
      kind: 'three-good-things' as any,
      notes: JSON.stringify(goods),
    })
    setSaved(true)
  }

  const isEmpty = goods.every(g => !g.good.trim() && !g.why.trim())

  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  function updateGood(i: number, field: 'good' | 'why', val: string) {
    setGoods(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: val } : g))
  }

  return (
    <div className="screen">
      <ScreenHeader title="Positive Psychology" back={back} icon={<Icons.sparkle size={22} />} />
      <div className="screen-scroll" style={{ paddingBottom: 48 }}>
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="eyebrow">{formattedDate}</div>

          {saved && (
            <div style={{
              background: 'var(--accent-soft)', borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Today's entry saved</span>
              <button
                onClick={() => setSaved(false)}
                style={{
                  background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--r-pill)',
                  padding: '5px 14px', fontFamily: 'var(--font-ui)', fontSize: 12,
                  color: 'var(--accent)', cursor: 'pointer',
                }}
              >
                Edit
              </button>
            </div>
          )}

          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'var(--paper-2)', borderRadius: 14,
              border: '1px solid var(--rule)', padding: '20px',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 48, lineHeight: 1, color: 'var(--ink-4)', marginBottom: 4,
              }}>
                {i + 1}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>What went well?</div>
                <textarea
                  style={TA_STYLE}
                  rows={3}
                  placeholder="Something good that happened today…"
                  value={goods[i].good}
                  onChange={e => updateGood(i, 'good', e.target.value)}
                  disabled={saved}
                />
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4,
                }}>
                  Why did this happen?
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 6 }}>
                  This is the active ingredient — don't skip it
                </div>
                <textarea
                  style={TA_STYLE}
                  rows={3}
                  placeholder="What did you do, or what circumstances helped this happen?"
                  value={goods[i].why}
                  onChange={e => updateGood(i, 'why', e.target.value)}
                  disabled={saved}
                />
              </div>
            </div>
          ))}

          {!saved && (
            <button
              onClick={handleSave}
              disabled={isEmpty}
              style={{
                background: isEmpty ? 'var(--rule)' : 'var(--accent)',
                color: isEmpty ? 'var(--ink-3)' : 'var(--paper)',
                borderRadius: 'var(--r-pill)', border: 'none',
                padding: '13px 24px', fontFamily: 'var(--font-ui)',
                fontSize: 15, fontWeight: 500, cursor: isEmpty ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Save
            </button>
          )}

          {saved && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6,
            }}>
              Research shows Three Good Things reduces depressive symptoms by up to 35% when done consistently.
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
