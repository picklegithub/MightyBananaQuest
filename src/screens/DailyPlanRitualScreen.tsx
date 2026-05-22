import React, { useState, useCallback } from 'react'
import { db, todayISO, saveDailyPlan, updateTask } from '../data/db'
import { Icons } from '../components/ui/Icons'
import {
  DPRStep1Reckoning, DPRStep2Calendar, DPRStep3Pick, DPRStep4Top3,
  tomorrowISO,
} from '../components/daily-plan'
import { MoodScalePicker } from '../components/mood/MoodScalePicker'
import { saveMoodEntry } from '../data/db'
import { makeId } from '../lib/makeId'
import { moodScoreToState } from '../components/mood/constants'
import type { Screen, Reckoning, MoodScore } from '../types'
import { useNav } from '../lib/navContext'

interface DPRProps {
  navigate?: (s: Screen) => void
  back?: () => void
}

const STEP_CTAS: Record<number, string> = {
  1: 'Continue',
  2: 'Pick tasks',
  3: 'Choose your top 3',
  4: 'Start the day',
}

export function DailyPlanRitualScreen({ back: backProp }: DPRProps) {
  const { back: ctxBack } = useNav()
  const back = backProp ?? ctxBack
  const [step, setStep]               = useState(0)
  const [moodScore, setMoodScore]     = useState<MoodScore | null>(null)
  // Legacy 3-state for DailyPlan.mood backward compat
  const mood = moodScore ? moodScoreToState(moodScore) : null
  const [reckonings, setReckonings]   = useState<Reckoning[]>([])
  const [calBudgetMin, setCalBudgetMin] = useState(0)
  const [pickedIds, setPickedIds]     = useState<Set<string>>(new Set())
  const [top3Ids, setTop3Ids]         = useState<string[]>([])
  const [finishing, setFinishing]     = useState(false)

  async function handleNext() {
    if (step === 1) {
      const today    = todayISO()
      const tomorrow = tomorrowISO()
      for (const r of reckonings) {
        if (r.action === 'today') {
          await updateTask(r.taskId, { due: today })
        } else if (r.action === 'reschedule') {
          await updateTask(r.taskId, { due: r.rescheduledTo ?? tomorrow })
        } else if (r.action === 'drop') {
          await updateTask(r.taskId, { status: 'someday', due: '' })
        }
      }
      await saveDailyPlan({ mood, reckonings, completedAt: null })
      setStep(2)
      return
    }

    if (step < 4) {
      await saveDailyPlan({ mood, reckonings, calBudgetMin, pickedIds: [...pickedIds], top3Ids, completedAt: null })
      setStep(s => s + 1)
      return
    }

    setFinishing(true)
    try {
      const existingPlan = await db.dailyPlans.get(todayISO())
      await saveDailyPlan({
        mood, reckonings, calBudgetMin,
        pickedIds: [...pickedIds], top3Ids,
        completedAt: Date.now(),
      })
      if (!existingPlan?.completedAt) {
        const settings = await db.settings.get(1)
        if (settings) await db.settings.update(1, { xp: (settings.xp ?? 0) + 3 })
      }
    } finally {
      setFinishing(false)
      back()
    }
  }

  const handleSkip = useCallback(async () => {
    await saveDailyPlan({ completedAt: null })
    back()
  }, [back])

  return (
    <div style={{
      height: '100%', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '14px 18px 10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--rule)',
      }}>
        <span className="eyebrow" style={{ letterSpacing: '0.16em' }}>
          {step === 0 ? 'DAILY PLAN' : `DAILY PLAN · ${step}/4`}
        </span>
        <button
          onClick={handleSkip}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.10em' }}
        >
          SKIP
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 5, padding: '10px 18px 0', flexShrink: 0 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--accent)' : 'var(--rule)',
            transition: 'background .3s',
          }} />
        ))}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 12px' }} className="no-scrollbar">
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 28 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', textAlign: 'center', color: 'var(--ink)' }}>
              How are you showing up today?
            </div>
            <div style={{ width: '100%' }}>
              <MoodScalePicker
                value={moodScore}
                size="large"
                onChange={async score => {
                  setMoodScore(score)
                  // Save to moodEntries table (daily-plan source)
                  await saveMoodEntry({
                    id:         makeId(),
                    date:       todayISO(),
                    time:       new Date().toTimeString().slice(0, 5),
                    source:     'daily-plan',
                    mood:       score,
                    energy:     null,
                    emotions:   [],
                    influences: [],
                    note:       null,
                    createdAt:  Date.now(),
                  })
                  setStep(1)
                }}
              />
            </div>
          </div>
        )}
        {step === 1 && (
          <DPRStep1Reckoning reckonings={reckonings} onReckoningsChange={setReckonings} />
        )}
        {step === 2 && (
          <DPRStep2Calendar onBudgetChange={setCalBudgetMin} />
        )}
        {step === 3 && (
          <DPRStep3Pick pickedIds={pickedIds} onPickedChange={setPickedIds} mood={mood} />
        )}
        {step === 4 && (
          <DPRStep4Top3 pickedIds={pickedIds} top3Ids={top3Ids} onTop3Change={setTop3Ids} />
        )}
      </div>

      {/* Footer — hidden on mood step */}
      {step > 0 && (
        <div style={{
          padding: '12px 18px',
          paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
          flexShrink: 0, borderTop: '1px solid var(--rule)',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              style={{
                padding: '12px 16px', borderRadius: 10,
                border: '1px solid var(--rule)', color: 'var(--ink-2)',
                fontSize: 13, flexShrink: 0,
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={finishing}
            style={{
              flex: 1, padding: '14px', borderRadius: 12,
              background: 'var(--ink)', color: 'var(--paper)',
              fontWeight: 600, fontSize: 14,
              opacity: finishing ? 0.6 : 1, transition: 'opacity .15s',
            }}
          >
            {finishing ? 'Saving…' : STEP_CTAS[step]}
          </button>
        </div>
      )}
    </div>
  )
}
