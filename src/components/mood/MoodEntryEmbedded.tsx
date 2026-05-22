/**
 * MoodEntryEmbedded — compact mood + energy check-in card.
 *
 * Designed to sit at the top of MorningForm and EveningForm.
 * Auto-saves to the moodEntries table after an 800ms debounce.
 * Calls onSaved() after each successful save so the parent can
 * update backward-compat JournalEntry fields (morningMood, energy).
 */

import React, { useState, useEffect, useRef } from 'react'
import { makeId } from '../../lib/makeId'
import { saveMoodEntry, getMoodEntryForSource } from '../../data/db'
import type { MoodEntry, MoodScore, MoodEnergy, MoodSource } from '../../types'
import { MoodScalePicker } from './MoodScalePicker'
import { EnergyPicker } from './EnergyPicker'
import { InfluenceTags } from './InfluenceTags'

interface Props {
  date:     string
  source:   Exclude<MoodSource, 'standalone'>
  header?:  string   // e.g. "MORNING CHECK-IN" or "EVENING CHECK-IN"
  onSaved?: (patch: { mood: MoodScore; energy: MoodEnergy | null }) => void
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function MoodEntryEmbedded({ date, source, header, onSaved }: Props) {
  const [mood,           setMood]           = useState<MoodScore | null>(null)
  const [energy,         setEnergy]         = useState<MoodEnergy | null>(null)
  const [influences,     setInfluences]     = useState<string[]>([])
  const [note,           setNote]           = useState('')
  const [showInfluences, setShowInfluences] = useState(false)
  const [showNote,       setShowNote]       = useState(false)
  const [savedAt,        setSavedAt]        = useState<number | null>(null)

  const entryIdRef     = useRef<string | null>(null)
  const createdAtRef   = useRef<number | null>(null)
  const onSavedRef     = useRef(onSaved)
  onSavedRef.current   = onSaved

  // Load existing entry for this date + source
  useEffect(() => {
    getMoodEntryForSource(date, source).then(existing => {
      if (!existing) return
      entryIdRef.current   = existing.id
      createdAtRef.current = existing.createdAt
      setMood(existing.mood)
      setEnergy(existing.energy)
      setInfluences(existing.influences ?? [])
      setNote(existing.note ?? '')
      if ((existing.influences?.length ?? 0) > 0) setShowInfluences(true)
      if (existing.note) setShowNote(true)
    })
  }, [date, source])

  // Auto-save with debounce — mood required
  useEffect(() => {
    if (!mood) return
    const t = setTimeout(async () => {
      const now = Date.now()
      const entry: MoodEntry = {
        id:         entryIdRef.current ?? makeId(),
        date,
        time:       nowHHMM(),
        source,
        mood,
        energy,
        influences,
        emotions:   [],   // emotion picker not shown in embedded mode
        note:       note.trim() || null,
        createdAt:  createdAtRef.current ?? now,
        updatedAt:  now,
      }
      if (!entryIdRef.current) {
        entryIdRef.current   = entry.id
        createdAtRef.current = entry.createdAt
      }
      await saveMoodEntry(entry)
      setSavedAt(now)
      onSavedRef.current?.({ mood, energy })
    }, 800)
    return () => clearTimeout(t)
  }, [mood, energy, influences, note, date, source])

  const headerLabel = header ?? (source === 'morning-journal' ? 'MORNING CHECK-IN' : 'EVENING CHECK-IN')

  return (
    <div style={{
      padding: '16px',
      borderRadius: 14,
      background: 'var(--paper-2)',
      border: '1px solid var(--rule)',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.12em', color: 'var(--ink-4)',
          textTransform: 'uppercase',
        }}>
          {headerLabel}
        </div>
        {savedAt && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)',
            letterSpacing: '0.04em',
          }}>
            ✓ saved
          </div>
        )}
      </div>

      {/* Mood scale */}
      <div style={{ marginBottom: 12 }}>
        <MoodScalePicker value={mood} onChange={setMood} />
      </div>

      {/* Energy — shown after mood is picked */}
      {mood && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '0.1em', color: 'var(--ink-4)',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            ENERGY
          </div>
          <EnergyPicker value={energy} onChange={setEnergy} />
        </div>
      )}

      {/* Expandable sections — shown after mood + energy */}
      {mood && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {!showInfluences && (
            <button
              onClick={() => setShowInfluences(true)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
                color: 'var(--ink-3)', background: 'transparent',
                border: '1px dashed var(--rule)', borderRadius: 999,
                padding: '4px 10px',
              }}
            >
              + Influences
            </button>
          )}
          {!showNote && (
            <button
              onClick={() => setShowNote(true)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
                color: 'var(--ink-3)', background: 'transparent',
                border: '1px dashed var(--rule)', borderRadius: 999,
                padding: '4px 10px',
              }}
            >
              + Note
            </button>
          )}
        </div>
      )}

      {showInfluences && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '0.1em', color: 'var(--ink-4)',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            INFLUENCES
          </div>
          <InfluenceTags selected={influences} onChange={setInfluences} />
        </div>
      )}

      {showNote && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Any notes…"
            rows={2}
            style={{
              width: '100%', background: 'transparent',
              border: 'none', borderBottom: '1px solid var(--rule)',
              outline: 'none', resize: 'none', fontSize: 13,
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              color: 'var(--ink-2)', lineHeight: 1.6,
              padding: '4px 0',
            }}
          />
        </div>
      )}
    </div>
  )
}
