import React, { useState, useEffect, useRef } from 'react'
import type { JournalEntry, MoodScore, MoodEnergy } from '../../types'
import { energyToLegacyNum } from '../mood/constants'
import { MoodEntryEmbedded } from '../mood/MoodEntryEmbedded'
import {
  Prompt, SavedIndicator, QuoteCard, RatingRow,
  IMPACT_OPTIONS, EVENING_QUOTES, todayQuote, bigInput, displayInput,
} from './shared'

interface Props {
  existing?: JournalEntry
  onSave: (e: Partial<JournalEntry>) => Promise<void>
}

export function EveningForm({ existing, onSave }: Props) {
  const [win,          setWin]          = useState(existing?.win ?? '')
  const [diff,         setDiff]         = useState(existing?.diff ?? '')
  const [diffFollowOn, setDiffFollowOn] = useState(existing?.diffFollowOn ?? '')
  const [reframe,      setReframe]      = useState(existing?.reframe ?? '')
  const [reframeOpen,  setReframeOpen]  = useState(!!existing?.reframe)
  const [lesson,       setLesson]       = useState(existing?.lesson ?? '')
  const [tomorrow,     setTomorrow]     = useState(existing?.tomorrow ?? '')
  const [notes,        setNotes]        = useState(existing?.notes ?? '')
  // backward-compat energy on JournalEntry (updated when MoodEntryEmbedded saves)
  const [energy,       setEnergy]       = useState<1 | 2 | 3 | undefined>(existing?.energy)
  const [impact,       setImpact]       = useState<1 | 2 | 3 | 4 | undefined>(existing?.impact)
  const [saved,        setSaved]        = useState(false)
  const inited    = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const date = existing?.date ?? new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!existing || inited.current) return
    setWin(existing.win ?? '')
    setDiff(existing.diff ?? '')
    setDiffFollowOn(existing.diffFollowOn ?? '')
    setReframe(existing.reframe ?? '')
    setReframeOpen(!!existing.reframe)
    setLesson(existing.lesson ?? '')
    setTomorrow(existing.tomorrow ?? '')
    setNotes(existing.notes ?? '')
    setEnergy(existing.energy)
    setImpact(existing.impact)
    inited.current = true
  }, [existing?.id])

  // Auto-save journal fields (debounced)
  useEffect(() => {
    if (!win && !diff && !diffFollowOn && !reframe && !lesson && !tomorrow && !notes && !energy && !impact) return
    const t = setTimeout(async () => {
      await onSaveRef.current({
        win, diff,
        diffFollowOn: diffFollowOn || undefined,
        reframe: reframe || undefined,
        lesson, tomorrow,
        notes: notes || undefined,
        energy, impact,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
    return () => clearTimeout(t)
  }, [win, diff, diffFollowOn, reframe, lesson, tomorrow, notes, energy, impact])

  function handleMoodSaved({ energy: e }: { mood: MoodScore; energy: MoodEnergy | null }) {
    // Map energy string → legacy numeric for JournalEntry.energy backward compat
    if (e) setEnergy(energyToLegacyNum(e))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Mood + energy check-in */}
      <MoodEntryEmbedded
        date={date}
        source="evening-journal"
        header="EVENING CHECK-IN"
        onSaved={handleMoodSaved}
      />

      <QuoteCard quote={todayQuote(EVENING_QUOTES)} />

      {/* Impact — kept separate; it's about work output, not wellbeing */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 14 }}>
          TODAY'S IMPACT
        </div>
        <RatingRow label="Impact" help="How much did today's work matter?" options={IMPACT_OPTIONS} value={impact} onChange={v => setImpact(v)} />
      </div>

      <div style={{ marginTop: 8 }}>
        <Prompt num="01" label="Today's win" help="The one moment to celebrate, however small.">
          <input value={win} onChange={e => setWin(e.target.value)} className="journal-input" style={{ ...bigInput }} />
        </Prompt>

        <Prompt num="02" label="What got in the way?" help="Without judgement. Just notice.">
          <input value={diff} onChange={e => setDiff(e.target.value)} className="journal-input" style={{ ...bigInput }} />
        </Prompt>

        {diff.trim() && (
          <div style={{ marginTop: -8, marginBottom: 20, paddingLeft: 32 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
              One thing I'd do differently.
            </div>
            <input value={diffFollowOn} onChange={e => setDiffFollowOn(e.target.value)} className="journal-input" style={{ ...bigInput }} />
            <button onClick={() => setReframeOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-3)' }}>
              <span style={{ fontSize: 14, lineHeight: 1, transform: reframeOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>+</span>
              Reframe
            </button>
            {reframeOpen && (
              <div style={{ marginTop: 8 }}>
                <input value={reframe} onChange={e => setReframe(e.target.value)}
                  placeholder="One thing I'm thinking differently about after today…"
                  className="journal-input" style={{ ...bigInput }} />
              </div>
            )}
          </div>
        )}

        <Prompt num="03" label="Key lesson learnt" help="One thread to carry forward.">
          <input value={lesson} onChange={e => setLesson(e.target.value)} className="journal-input" style={{ ...bigInput }} />
        </Prompt>

        <Prompt num="04" label="What I'm excited about tomorrow" help="Anticipation primes the morning.">
          <input value={tomorrow} onChange={e => setTomorrow(e.target.value)} className="journal-input" style={{ ...bigInput }} />
        </Prompt>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>NOTES</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="journal-input"
            style={{ ...displayInput, minHeight: 72, resize: 'none', lineHeight: 1.6 }} />
        </div>
      </div>

      <SavedIndicator saved={saved} />
    </div>
  )
}
