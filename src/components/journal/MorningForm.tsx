import React, { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { JournalEntry, MoodScore, MoodEnergy } from '../../types'
import { moodScoreToState, energyToLegacyNum } from '../mood/constants'
import { MoodEntryEmbedded } from '../mood/MoodEntryEmbedded'
import {
  Prompt, SavedIndicator, QuoteCard, PrioritySlot,
  MORNING_QUOTES, todayQuote, displayInput, bigInput,
} from './shared'

interface Props {
  existing?: JournalEntry
  onSave: (e: Partial<JournalEntry>) => Promise<void>
}

export function MorningForm({ existing, onSave }: Props) {
  // Backward-compat mood fields — updated when MoodEntryEmbedded saves
  const [morningMood, setMorningMood] = useState<'steady' | 'tired' | 'charged' | undefined>(existing?.morningMood)
  const [g0, setG0] = useState(existing?.gratitude?.[0] ?? '')
  const [g1, setG1] = useState(existing?.gratitude?.[1] ?? '')
  const [g2, setG2] = useState(existing?.gratitude?.[2] ?? '')
  const [intention, setIntention] = useState(existing?.intention ?? '')
  const [p0, setP0] = useState(existing?.priorities?.[0] ?? '')
  const [p1, setP1] = useState(existing?.priorities?.[1] ?? '')
  const [p2, setP2] = useState(existing?.priorities?.[2] ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [ptId0, setPtId0] = useState<string | null>(existing?.priorityTaskIds?.[0] ?? null)
  const [ptId1, setPtId1] = useState<string | null>(existing?.priorityTaskIds?.[1] ?? null)
  const [ptId2, setPtId2] = useState<string | null>(existing?.priorityTaskIds?.[2] ?? null)
  const [saved, setSaved] = useState(false)
  const inited    = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const allTasks = useLiveQuery(
    () => db.tasks.filter(t => !t.done && !t.deletedAt).toArray(), []
  ) ?? []

  // Date for the mood entry — derived from existing entry or today
  const date = existing?.date ?? new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!existing || inited.current) return
    setMorningMood(existing.morningMood)
    setG0(existing.gratitude?.[0] ?? '')
    setG1(existing.gratitude?.[1] ?? '')
    setG2(existing.gratitude?.[2] ?? '')
    setIntention(existing.intention ?? '')
    setP0(existing.priorities?.[0] ?? '')
    setP1(existing.priorities?.[1] ?? '')
    setP2(existing.priorities?.[2] ?? '')
    setNotes(existing.notes ?? '')
    setPtId0(existing.priorityTaskIds?.[0] ?? null)
    setPtId1(existing.priorityTaskIds?.[1] ?? null)
    setPtId2(existing.priorityTaskIds?.[2] ?? null)
    inited.current = true
  }, [existing?.id])

  // Auto-save journal fields (debounced)
  useEffect(() => {
    const gratitude       = [g0, g1, g2].filter(Boolean)
    const priorities      = [p0, p1, p2]
    const priorityTaskIds = [ptId0, ptId1, ptId2]
    const hasAny = gratitude.length > 0 || !!intention ||
      priorities.some(Boolean) || !!notes || priorityTaskIds.some(Boolean) || !!morningMood
    if (!hasAny) return
    const t = setTimeout(async () => {
      await onSaveRef.current({
        morningMood, gratitude, intention,
        priorities: priorities.filter(Boolean),
        priorityTaskIds: priorityTaskIds.some(Boolean) ? priorityTaskIds : undefined,
        notes: notes || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
    return () => clearTimeout(t)
  }, [morningMood, g0, g1, g2, intention, p0, p1, p2, notes, ptId0, ptId1, ptId2])

  const ptSlots = [
    { text: p0, setText: setP0, taskId: ptId0, setTaskId: setPtId0 },
    { text: p1, setText: setP1, taskId: ptId1, setTaskId: setPtId1 },
    { text: p2, setText: setP2, taskId: ptId2, setTaskId: setPtId2 },
  ]

  function handleMoodSaved({ mood }: { mood: MoodScore; energy: MoodEnergy | null }) {
    // Map 5-point score → legacy 3-state for JournalEntry.morningMood backward compat
    setMorningMood(moodScoreToState(mood))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Mood + energy check-in (replaces old 3-state MoodPicker) */}
      <MoodEntryEmbedded
        date={date}
        source="morning-journal"
        header="MORNING CHECK-IN"
        onSaved={handleMoodSaved}
      />

      <QuoteCard quote={todayQuote(MORNING_QUOTES)} />

      <div style={{ marginTop: 28 }}>
        <Prompt num="01" label="Three things I'm grateful for" help="Small or large. Specific lands deeper.">
          {[{ value: g0, set: setG0 }, { value: g1, set: setG1 }, { value: g2, set: setG2 }].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', paddingTop: 10, flexShrink: 0, width: 14 }}>{i + 1}.</span>
              <input value={f.value} onChange={e => f.set(e.target.value)} className="journal-input" style={{ ...displayInput }} />
            </div>
          ))}
        </Prompt>

        <Prompt num="02" label="Today's intention" help="One sentence. How will I show up?">
          <input value={intention} onChange={e => setIntention(e.target.value)} className="journal-input" style={{ ...bigInput }} />
        </Prompt>

        <Prompt num="03" label="The three priorities" help="If only these three, the day was good. Tap ⭐ to pin a task.">
          {ptSlots.map((s, i) => (
            <PrioritySlot
              key={i} slotIndex={i} text={s.text}
              onTextChange={s.setText} taskId={s.taskId}
              onTaskSelect={(id, title) => { s.setTaskId(id); s.setText(title) }}
              onTaskClear={() => { s.setTaskId(null); s.setText('') }}
              allTasks={allTasks}
            />
          ))}
        </Prompt>

        <Prompt num="04" label="Notes" help="Anything else on your mind." last>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="journal-input"
            style={{ ...displayInput, minHeight: 72, resize: 'none', lineHeight: 1.6 }} />
        </Prompt>
      </div>

      <SavedIndicator saved={saved} />
    </div>
  )
}

