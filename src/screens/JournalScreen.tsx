import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { Seg } from '../components/ui'
import type { Screen, JournalEntry } from '../types'

interface Props { navigate: (s: Screen) => void; phase?: 'morning' | 'evening' | 'history' }

export const JournalScreen = ({ navigate, phase: initPhase }: Props) => {
  const [tab, setTab] = useState<'morning' | 'evening' | 'history'>(initPhase ?? 'morning')
  const entries = useLiveQuery(() => db.journal.toArray(), [])

  if (!entries) return null

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const todayMorning = entries.find(e => e.date === today && e.kind === 'morning')
  const todayEvening = entries.find(e => e.date === today && e.kind === 'evening')

  async function handleSaveMorning(entry: Partial<JournalEntry>) {
    const id = todayMorning?.id ?? `j${Date.now()}`
    await saveJournalEntry({ id, date: today, kind: 'morning', ...todayMorning, ...entry })
  }

  async function handleSaveEvening(entry: Partial<JournalEntry>) {
    const id = todayEvening?.id ?? `j${Date.now()}`
    await saveJournalEntry({ id, date: today, kind: 'evening', ...todayEvening, ...entry })
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Daily Reflection</div>
        <h1 className="t-display" style={{ fontSize: 28 }}>Journal</h1>
      </div>

      {/* Tab */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <Seg value={tab} setValue={v => setTab(v as typeof tab)} options={[
          { v: 'morning', l: '☀️ Morning' },
          { v: 'evening', l: '🌙 Evening' },
          { v: 'history', l: '📖 History' },
        ]} />
      </div>

      <div className="screen-scroll" style={{ padding: '16px 20px 40px' }}>
        {tab === 'morning' && (
          <MorningForm existing={todayMorning} onSave={handleSaveMorning} />
        )}
        {tab === 'evening' && (
          <EveningForm existing={todayEvening} onSave={handleSaveEvening} />
        )}
        {tab === 'history' && (
          <HistoryView entries={entries} />
        )}
      </div>
    </div>
  )
}

// ── Morning form ─────────────────────────────────────────────────────────────
function MorningForm({ existing, onSave }: { existing?: JournalEntry; onSave: (e: Partial<JournalEntry>) => Promise<void> }) {
  const [gratitude,  setGratitude]  = useState(existing?.gratitude?.join('\n') ?? '')
  const [intention,  setIntention]  = useState(existing?.intention ?? '')
  const [priorities, setPriorities] = useState(existing?.priorities?.join('\n') ?? '')
  const [saved, setSaved] = useState(false)

  // Re-hydrate form when existing entry loads or changes from outside
  useEffect(() => {
    setGratitude(existing?.gratitude?.join('\n') ?? '')
    setIntention(existing?.intention ?? '')
    setPriorities(existing?.priorities?.join('\n') ?? '')
  }, [existing?.id])

  async function handleSave() {
    await onSave({
      gratitude: gratitude.split('\n').map(s => s.trim()).filter(Boolean),
      intention,
      priorities: priorities.split('\n').map(s => s.trim()).filter(Boolean),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '14px 16px', background: 'var(--paper-2)', borderRadius: 12, border: '1px solid var(--rule)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-2)' }}>
          "Mornings are for hard things."
        </div>
      </div>

      <JournalField label="3 things I'm grateful for" placeholder={"warm coffee\na quiet flat\ngood sleep"} value={gratitude} onChange={setGratitude} multi />
      <JournalField label="Today's intention" placeholder="Move with patience, not urgency." value={intention} onChange={setIntention} />
      <JournalField label="Top 3 priorities" placeholder={"1. Deep work block\n2. 30-min walk\n3. Call Mum"} value={priorities} onChange={setPriorities} multi />

      <button onClick={handleSave} style={{
        width: '100%', padding: '15px', borderRadius: 14,
        background: saved ? 'var(--accent-soft)' : 'var(--ink)',
        color: saved ? 'var(--ink)' : 'var(--paper)',
        fontSize: 15, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'all .2s',
      }}>
        {saved ? <><Icons.check size={18} sw={2.5} /> Saved</> : 'Save morning entry'}
      </button>
    </div>
  )
}

// ── Evening form ─────────────────────────────────────────────────────────────
function EveningForm({ existing, onSave }: { existing?: JournalEntry; onSave: (e: Partial<JournalEntry>) => Promise<void> }) {
  const [win,      setWin]      = useState(existing?.win ?? '')
  const [diff,     setDiff]     = useState(existing?.diff ?? '')
  const [lesson,   setLesson]   = useState(existing?.lesson ?? '')
  const [tomorrow, setTomorrow] = useState(existing?.tomorrow ?? '')
  const [saved, setSaved] = useState(false)

  // Re-hydrate form when existing entry loads or changes from outside
  useEffect(() => {
    setWin(existing?.win ?? '')
    setDiff(existing?.diff ?? '')
    setLesson(existing?.lesson ?? '')
    setTomorrow(existing?.tomorrow ?? '')
  }, [existing?.id])

  async function handleSave() {
    await onSave({ win, diff, lesson, tomorrow })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '14px 16px', background: 'var(--paper-2)', borderRadius: 12, border: '1px solid var(--rule)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-2)' }}>
          "Pauses are productive."
        </div>
      </div>

      <JournalField label="Today's win" placeholder="Finished the proposal a day early." value={win} onChange={setWin} />
      <JournalField label="What I'd do differently" placeholder="Started the gym session earlier." value={diff} onChange={setDiff} />
      <JournalField label="Lesson learned" placeholder="Mornings are for hard things." value={lesson} onChange={setLesson} />
      <JournalField label="Tomorrow, I'll start with…" placeholder="Walk before breakfast." value={tomorrow} onChange={setTomorrow} />

      <button onClick={handleSave} style={{
        width: '100%', padding: '15px', borderRadius: 14,
        background: saved ? 'var(--accent-soft)' : 'var(--ink)',
        color: saved ? 'var(--ink)' : 'var(--paper)',
        fontSize: 15, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'all .2s',
      }}>
        {saved ? <><Icons.check size={18} sw={2.5} /> Saved</> : 'Save evening entry'}
      </button>
    </div>
  )
}

// ── History view ─────────────────────────────────────────────────────────────
function HistoryView({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>
      No journal entries yet
    </div>
  )

  // Group by date, most recent first
  const byDate: Record<string, JournalEntry[]> = {}
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(byDate).map(([date, dayEntries]) => (
        <div key={date} style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="t-display" style={{ fontSize: 14 }}>{date}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {dayEntries.map(e => (
                <span key={e.id} style={{
                  padding: '2px 8px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                  background: e.kind === 'morning' ? '#fff8e1' : '#e8eaf6',
                  color: e.kind === 'morning' ? '#b8860b' : '#5c6bc0',
                }}>
                  {e.kind === 'morning' ? '☀️ MORNING' : '🌙 EVENING'}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {dayEntries.map(e => (
              <div key={e.id} style={{ marginBottom: 8 }}>
                {e.kind === 'morning' && e.intention && (
                  <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink-2)', marginBottom: 4 }}>"{e.intention}"</div>
                )}
                {e.kind === 'morning' && e.priorities && e.priorities.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.priorities.join(' · ')}</div>
                )}
                {e.kind === 'evening' && e.win && (
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>✓ {e.win}</div>
                )}
                {e.kind === 'evening' && e.lesson && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{e.lesson}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shared form field ─────────────────────────────────────────────────────────
function JournalField({ label, placeholder, value, onChange, multi }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; multi?: boolean
}) {
  const sharedStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: 'var(--paper)', border: '1px solid var(--rule)',
    borderRadius: 10, fontSize: 14, lineHeight: 1.55, color: 'var(--ink)',
    resize: 'none' as const,
  }
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      {multi ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ ...sharedStyle, minHeight: 80 }} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={sharedStyle} />
      )}
    </div>
  )
}
