import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { enqueueUpsert } from '../lib/sync'
import { localDateISO } from '../lib/useCurrentDate'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import {
  getMondayISO, getSundayISO, displayRange, computeStats,
  STEP_LABELS,
  StepProgress, StatsStep, MoodStep, GoalsPulseStep, PromptsStep,
  DoneView, HistoryView,
} from '../components/weekly-review'
import type { WeekStats } from '../components/weekly-review'
import type { Screen, WeeklyReview, GoalPulse, GoalPulseStatus } from '../types'
import { useNav } from '../lib/navContext'

interface Props { navigate?: (s: Screen) => void; back?: () => void }

export const WeeklyReviewScreen = ({ back: backProp, navigate: navProp }: Props) => {
  const { back: ctxBack, navigate: ctxNavigate } = useNav()
  const back     = backProp ?? ctxBack
  const navigate = navProp  ?? ctxNavigate
  const week = useMemo(() => {
    const start = getMondayISO(new Date())
    return { start, end: getSundayISO(start) }
  }, [])

  const goals      = useLiveQuery(() => db.goals.toArray(),         [])
  const cats       = useLiveQuery(() => db.categories.toArray(),    []) ?? []
  const reviews    = useLiveQuery(() => db.weeklyReviews.toArray(), [])
  const settings   = useLiveQuery(() => db.settings.get(1),         [])
  const allTasks   = useLiveQuery(() => db.tasks.toArray(),         []) ?? []
  const habitLogs  = useLiveQuery(() => db.habitLog.toArray(),      []) ?? []
  const weekJournal = useLiveQuery(
    () => db.journal.where('date').between(week.start, week.end, true, true).toArray(),
    [week.start, week.end]
  ) ?? []
  const weekPlans = useLiveQuery(
    () => db.dailyPlans.where('date').between(week.start, week.end, true, true).toArray(),
    [week.start, week.end]
  ) ?? []

  const [stats,          setStats]          = useState<WeekStats | null>(null)
  const [view,           setView]           = useState<'wizard' | 'done' | 'history'>('wizard')
  const [step,           setStep]           = useState(0)
  const [review,         setReview]         = useState<WeeklyReview | null>(null)
  const [wins,           setWins]           = useState<[string, string, string]>(['', '', ''])
  const [pulse,          setPulse]          = useState<GoalPulse[]>([])
  const [nextThing,      setNextThing]      = useState('')
  const [prevCommitment, setPrevCommitment] = useState<string | undefined>(undefined)

  useEffect(() => {
    computeStats(week.start, week.end).then(setStats)
  }, [week.start, week.end])

  useEffect(() => {
    if (!reviews) return
    const prevReview = reviews
      .filter(r => r.weekStart < week.start && r.completedAt && r.nextWeekThing)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
    if (prevReview?.nextWeekThing) setPrevCommitment(prevReview.nextWeekThing)

    const existing = reviews.find(r => r.weekStart === week.start)
    if (!existing) {
      db.journal.toArray().then(entries => {
        const thisWeekWins = entries
          .filter(e => e.date >= week.start && e.date <= week.end && e.kind === 'evening' && e.win)
          .map(e => e.win!)
          .slice(0, 3)
        const prefilled: [string, string, string] = ['', '', '']
        thisWeekWins.forEach((w, i) => { prefilled[i] = w })
        setWins(prefilled)
      })
      return
    }
    setReview(existing)
    if (existing.completedAt) {
      setView('done')
    } else {
      if (existing.wins.length === 3) setWins(existing.wins as [string, string, string])
      if (existing.goalPulse.length > 0) setPulse(existing.goalPulse)
      setNextThing(existing.nextWeekThing)
    }
  }, [reviews, week.start, week.end])

  useEffect(() => {
    if (!goals || goals.length === 0 || pulse.length > 0) return
    setPulse(goals.map(g => ({ goalId: g.id, status: 'on-track' as GoalPulseStatus })))
  }, [goals])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week.start + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return localDateISO(d)
  }), [week.start])

  const energyByDay = useMemo(() => {
    const map: Record<string, 1 | 2 | 3> = {}
    for (const e of weekJournal) {
      if (e.kind === 'evening' && e.energy) map[e.date] = e.energy
    }
    return map
  }, [weekJournal])

  const planMoods = useMemo(() => {
    const map: Record<string, 'steady' | 'tired' | 'charged'> = {}
    for (const p of weekPlans) { if (p.mood) map[p.date] = p.mood }
    return map
  }, [weekPlans])

  async function saveReview(patch: Partial<WeeklyReview>): Promise<WeeklyReview> {
    const base: WeeklyReview = review ?? {
      id:             `wr-${week.start}`,
      weekStart:      week.start,
      weekEnd:        week.end,
      tasksCompleted: stats?.tasksCompleted ?? 0,
      xpGained:       stats?.xpGained       ?? 0,
      journalDays:    stats?.journalDays     ?? 0,
      quadCounts:     { q1: 0, q2: 0, q3: 0, q4: 0 },
      wins:           ['', '', ''],
      goalPulse:      [],
      nextWeekThing:  '',
    }
    const updated: WeeklyReview = { ...base, ...patch, updatedAt: Date.now() }
    await db.weeklyReviews.put(updated)
    enqueueUpsert('weekly_reviews', updated.id, updated)
    setReview(updated)
    return updated
  }

  async function handleNext() {
    if (step === 0) {
      await saveReview({
        tasksCompleted: stats?.tasksCompleted ?? 0,
        xpGained:       stats?.xpGained       ?? 0,
        journalDays:    stats?.journalDays     ?? 0,
        quadCounts:     { q1: 0, q2: 0, q3: 0, q4: 0 },
      })
    }
    if (step === 2) await saveReview({ goalPulse: pulse })
    setStep(s => Math.min(s + 1, 3))
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1)
    else back()
  }

  async function handleComplete() {
    if (!nextThing.trim()) return
    const s = await db.settings.get(1)
    if (s) {
      await db.settings.update(1, { xp: (s.xp ?? 0) + 15 })
      const updated = await db.settings.get(1)
      if (updated) enqueueUpsert('settings', String(updated.id), updated)
    }
    await saveReview({ wins, goalPulse: pulse, nextWeekThing: nextThing.trim(), completedAt: Date.now() })
    setView('done')
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Weekly Progress"
        subtitle={displayRange(week.start, week.end).toUpperCase()}
        back={back}
        icon={<Icons.bolt size={22} />}
        rightActions={navigate ? (
          <button
            onClick={() => navigate({ name: 'coping-cards' })}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              padding: '5px 10px', borderRadius: 8,
              background: 'var(--paper-2)', color: 'var(--ink-3)',
              border: '1px solid var(--rule)',
            }}
          >
            coping cards
          </button>
        ) : undefined}
      />

      {view === 'history' && (
        <div className="screen-scroll" style={{ padding: '16px 20px' }}>
          <HistoryView reviews={reviews ?? []} />
        </div>
      )}

      {view === 'done' && review && (
        <div className="screen-scroll" style={{ padding: '16px 20px' }}>
          <DoneView
            review={review}
            onHistory={() => setView('history')}
            goals={goals ?? []}
            onShare={async () => {
              const token = review.shareToken ?? crypto.randomUUID()
              const updated = await saveReview({ shareToken: token })
              return `${window.location.origin}/review/${updated.shareToken}`
            }}
            onRevoke={async () => { await saveReview({ shareToken: undefined }) }}
          />
        </div>
      )}

      {view === 'wizard' && (
        <>
          <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
            <StepProgress step={step} />
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
              color: 'var(--ink-4)', marginTop: 7, textAlign: 'center',
            }}>
              {step + 1} / 4 · {STEP_LABELS[step].toUpperCase()}
            </div>
          </div>

          <div className="screen-scroll" style={{ padding: '20px 20px 110px' }}>
            {!stats ? (
              <div style={{
                textAlign: 'center', paddingTop: 60,
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--ink-4)', letterSpacing: '0.08em',
              }}>
                Computing your week…
              </div>
            ) : (
              <>
                {step === 0 && (
                  <StatsStep
                    stats={stats} streak={settings?.streak ?? 0} xp={settings?.xp ?? 0}
                    tasks={allTasks} habitLogs={habitLogs} cats={cats}
                    energyByDay={energyByDay} weekDays={weekDays}
                  />
                )}
                {step === 1 && (
                  <MoodStep energyByDay={energyByDay} weekDays={weekDays} planMoods={planMoods} />
                )}
                {step === 2 && goals && (
                  <GoalsPulseStep
                    goals={goals} pulse={pulse} cats={cats}
                    onChange={(goalId, status) =>
                      setPulse(prev => [...prev.filter(p => p.goalId !== goalId), { goalId, status }])
                    }
                  />
                )}
                {step === 3 && (
                  <PromptsStep
                    wins={wins}
                    onWinChange={(i, v) => setWins(prev => {
                      const n = [...prev] as [string, string, string]; n[i] = v; return n
                    })}
                    nextThing={nextThing}
                    onNextChange={setNextThing}
                    prevCommitment={prevCommitment}
                  />
                )}
              </>
            )}
          </div>

          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
            padding: `12px 20px calc(16px + env(safe-area-inset-bottom))`,
            background: 'var(--paper)', borderTop: '1px solid var(--rule)',
            display: 'flex', gap: 10,
          }}>
            {step > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--paper-2)', color: 'var(--ink-2)',
                  border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icons.back size={17} />
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!stats}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: stats ? 'var(--ink)' : 'var(--paper-3)',
                  color: stats ? 'var(--paper)' : 'var(--ink-3)',
                  fontSize: 15, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {step === 0 ? 'Reflect on it' : 'Next'}&nbsp;<Icons.arrow size={16} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!nextThing.trim()}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: nextThing.trim() ? 'var(--ink)' : 'var(--paper-3)',
                  color:      nextThing.trim() ? 'var(--paper)' : 'var(--ink-3)',
                  fontSize: 15, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icons.sparkle size={16} />&nbsp;Complete Review
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
