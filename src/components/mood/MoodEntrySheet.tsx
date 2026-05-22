/**
 * MoodEntrySheet — standalone bottom sheet for logging mood outside of journals.
 * Shown from the Mood & Energy screen header or quick-access shortcuts.
 *
 * Has all 5 sections: mood scale → energy → influences → emotions → note.
 * Sections reveal progressively after each step is filled.
 * Explicit "Save entry" button (not auto-save) since this is a deliberate action.
 */

import React, { useState, useEffect } from 'react'
import { makeId } from '../../lib/makeId'
import { saveMoodEntry, getMoodEntryForSource } from '../../data/db'
import type { MoodEntry, MoodScore, MoodEnergy } from '../../types'
import { MoodScalePicker } from './MoodScalePicker'
import { EnergyPicker } from './EnergyPicker'
import { InfluenceTags } from './InfluenceTags'
import { EmotionPicker } from './EmotionPicker'
import { localDateISO } from '../../lib/useCurrentDate'

interface Props {
  onClose: () => void
  onSaved?: (entry: MoodEntry) => void
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function MoodEntrySheet({ onClose, onSaved }: Props) {
  const today = localDateISO()

  const [mood,       setMood]       = useState<MoodScore | null>(null)
  const [energy,     setEnergy]     = useState<MoodEnergy | null>(null)
  const [influences, setInfluences] = useState<string[]>([])
  const [emotions,   setEmotions]   = useState<string[]>([])
  const [note,       setNote]       = useState('')

  const [showEnergy,    setShowEnergy]    = useState(false)
  const [showInfluences, setShowInfluences] = useState(false)
  const [showEmotions,  setShowEmotions]  = useState(false)
  const [showNote,      setShowNote]      = useState(false)
  const [saving,        setSaving]        = useState(false)

  // Reveal energy row after mood is picked
  useEffect(() => {
    if (mood && !showEnergy) setShowEnergy(true)
  }, [mood])

  async function handleSave() {
    if (!mood) return
    setSaving(true)
    const entry: MoodEntry = {
      id:         makeId(),
      date:       today,
      time:       nowHHMM(),
      source:     'standalone',
      mood,
      energy,
      influences,
      emotions,
      note:       note.trim() || null,
      createdAt:  Date.now(),
    }
    await saveMoodEntry(entry)
    onSaved?.(entry)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay)', zIndex: 400,
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>

          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22,
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 22, color: 'var(--ink)',
            }}>
              How are you?
            </div>
            <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>

          {/* ── Mood scale ── */}
          <section style={{ marginBottom: 24 }}>
            <SectionLabel title="MOOD" />
            <MoodScalePicker value={mood} onChange={setMood} size="large" />
          </section>

          {/* ── Energy ── */}
          {showEnergy && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel title="ENERGY" />
              <EnergyPicker value={energy} onChange={setEnergy} />
            </section>
          )}

          {/* Optional sections expand buttons */}
          {mood && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {!showInfluences && (
                <ExpandBtn label="+ Influences" onClick={() => setShowInfluences(true)} />
              )}
              {!showEmotions && (
                <ExpandBtn label="+ Name the feeling" onClick={() => setShowEmotions(true)} />
              )}
              {!showNote && (
                <ExpandBtn label="+ Note" onClick={() => setShowNote(true)} />
              )}
            </div>
          )}

          {/* ── Influences ── */}
          {showInfluences && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel title="WHAT'S INFLUENCING TODAY?" sub="optional · max 8" />
              <InfluenceTags selected={influences} onChange={setInfluences} />
            </section>
          )}

          {/* ── Emotions ── */}
          {showEmotions && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel title="HOW DOES IT FEEL, EXACTLY?" sub="optional · max 5" />
              <EmotionPicker selected={emotions} onChange={setEmotions} />
            </section>
          )}

          {/* ── Note ── */}
          {showNote && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel title="ANY NOTES?" sub="optional" />
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 500))}
                placeholder="What's on your mind…"
                rows={3}
                style={{
                  width: '100%', background: 'var(--paper-2)',
                  border: '1px solid var(--rule)',
                  borderRadius: 10, outline: 'none', resize: 'none',
                  fontSize: 14, fontFamily: 'var(--font-display)',
                  fontStyle: 'italic', color: 'var(--ink)',
                  lineHeight: 1.6, padding: '10px 12px',
                }}
              />
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 9, color: note.length > 400 ? 'var(--warn)' : 'var(--ink-4)', marginTop: 3 }}>
                {note.length}/500
              </div>
            </section>
          )}

          <div style={{ height: 8 }} />
        </div>

        {/* Save button */}
        <div style={{
          flexShrink: 0,
          padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--rule)',
        }}>
          <button
            onClick={handleSave}
            disabled={!mood || saving}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: mood ? 'var(--ink)' : 'var(--paper-3)',
              color: mood ? 'var(--paper)' : 'var(--ink-3)',
              fontSize: 15, fontWeight: 600,
              transition: 'all .15s',
            }}
          >
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        letterSpacing: '0.12em', color: 'var(--ink-4)',
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function ExpandBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 999,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
      color: 'var(--ink-3)', background: 'transparent',
      border: '1px dashed var(--rule)',
    }}>
      {label}
    </button>
  )
}
