import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { useNav } from '../lib/navContext'
import { localDateISO } from '../lib/useCurrentDate'

const ITEMS = [
  { key: 'move',  label: 'Move your body',          desc: "Any movement — walk, stretch, swim, lift. Duration doesn't matter." },
  { key: 'learn', label: 'Learn something new',      desc: 'A fact, skill, chapter, or conversation outside your usual domain.' },
  { key: 'sleep', label: 'Quality sleep last night', desc: '7–9 hours for most adults. Sleep consolidates memory and clears waste.' },
] as const

type CheckKey = 'move' | 'learn' | 'sleep'

function getWeekStart(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getWeekDates(today: string): string[] {
  const start = getWeekStart(today)
  const dates: string[] = []
  const d = new Date(start + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

export function NeuroplasticityScreen() {
  const { back } = useNav()
  const today = localDateISO()

  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({ move: false, learn: false, sleep: false })
  const [saved, setSaved] = useState(false)

  const existing = useLiveQuery(() => db.journal.get(`neuroplasticity:${today}`), [today])

  const weekDates = getWeekDates(today)
  const weekEntries = useLiveQuery(
    () => db.journal.where('id').anyOf(weekDates.map(d => `neuroplasticity:${d}`)).toArray(),
    [today],
  ) ?? []

  const weekStreak = weekEntries.filter(e => {
    try {
      const data = JSON.parse(e.notes ?? '{}')
      return data.move && data.learn && data.sleep
    } catch { return false }
  }).length

  useEffect(() => {
    if (existing?.notes) {
      try {
        const data = JSON.parse(existing.notes)
        setChecks({ move: !!data.move, learn: !!data.learn, sleep: !!data.sleep })
        setSaved(true)
      } catch {}
    }
  }, [existing])

  async function toggle(key: CheckKey) {
    const next = { ...checks, [key]: !checks[key] }
    setChecks(next)
    await saveJournalEntry({
      id: `neuroplasticity:${today}`,
      date: today,
      kind: 'neuroplasticity' as any,
      notes: JSON.stringify(next),
    })
    setSaved(true)
  }

  const allDone = checks.move && checks.learn && checks.sleep

  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="screen">
      <ScreenHeader title="Neuroplasticity" back={back} icon={<Icons.bolt size={22} />} />
      <div className="screen-scroll" style={{ paddingBottom: 48 }}>
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="eyebrow">{formattedDate}</div>

          {/* Checklist card */}
          <div style={{
            background: 'var(--paper-2)', borderRadius: 14,
            border: '1px solid var(--rule)', overflow: 'hidden',
          }}>
            {ITEMS.map((item, i) => (
              <button
                key={item.key}
                onClick={() => toggle(item.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
                  background: checks[item.key] ? 'var(--accent-soft)' : 'transparent',
                  borderBottom: i < ITEMS.length - 1 ? '1px solid var(--rule)' : 'none',
                  transition: 'background 0.15s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  border: checks[item.key] ? 'none' : '2px solid var(--rule)',
                  background: checks[item.key] ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, border 0.15s',
                }}>
                  {checks[item.key] && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5L4.5 8.5L11 1.5" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {/* Label + desc */}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {allDone && (
            <div style={{
              textAlign: 'center', fontSize: 15, fontWeight: 500,
              color: 'var(--accent)', padding: '4px 0',
            }}>
              All done today ✓ 🌿
            </div>
          )}

          {/* Week streak */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)',
            padding: '4px 0',
          }}>
            This week: {weekStreak} of 7 days completed all three
          </div>

          {/* Why card */}
          <div style={{
            background: 'var(--accent-soft)', borderRadius: 12,
            padding: '16px 18px',
          }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Why these three?</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Physical movement stimulates BDNF — a protein supporting neuron growth. Novel learning creates new synaptic connections. Sleep consolidates the day's learning into long-term memory. Together, these outperform any commercial "brain training" game.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
