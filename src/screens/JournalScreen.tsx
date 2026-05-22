import { makeId } from '../lib/makeId'
import React, { useState, useEffect } from 'react'
import { localDateISO } from '../lib/useCurrentDate'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry, todayISO } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import type { Screen, JournalEntry } from '../types'
import { useNav } from '../lib/navContext'
import {
  JournalPlanTab,
  MorningForm, EveningForm, HistoryView,
  JournalStreakStrip, computeJournalStreak,
} from '../components/journal'

type Tab = 'morning' | 'plan' | 'evening' | 'history'

interface Props {
  navigate?: (s: Screen) => void
  back?: () => void
  phase?: Tab
}

function isoToday(): string { return localDateISO() }

export const JournalScreen = ({ navigate: navProp, back: backProp, phase: initPhase }: Props) => {
  const { navigate: ctxNavigate, back: ctxBack } = useNav()
  const navigate = navProp ?? ctxNavigate
  const back     = backProp ?? ctxBack
  const hour   = new Date().getHours()
  const [tab, setTab] = useState<Tab>(initPhase ?? (hour < 13 ? 'morning' : 'evening'))


  // Refresh at midnight so yesterday's entries don't bleed into today's forms
  const [today, setToday] = useState(isoToday)
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const id = setTimeout(() => setToday(isoToday()), midnight.getTime() - now.getTime())
    return () => clearTimeout(id)
  }, [today])

  const entries   = useLiveQuery(() => db.journal.toArray(), [])
  const todayPlan = useLiveQuery(() => db.dailyPlans.get(todayISO()), [])
  if (!entries) return null

  const streak       = computeJournalStreak(entries)
  const todayMorning = entries.find(e => e.date === today && e.kind === 'morning')
  const todayEvening = entries.find(e => e.date === today && e.kind === 'evening')
  const morningDone  = !!(todayMorning?.intention || (todayMorning?.gratitude?.filter(Boolean).length ?? 0) > 0)
  const eveningDone  = !!(todayEvening?.win || todayEvening?.lesson)
  const planDone     = !!todayPlan?.completedAt

  async function saveMorning(patch: Partial<JournalEntry>) {
    const id = todayMorning?.id ?? makeId()
    await saveJournalEntry({ id, date: today, kind: 'morning', ...todayMorning, ...patch })
  }

  async function saveEvening(patch: Partial<JournalEntry>) {
    const id = todayEvening?.id ?? makeId()
    await saveJournalEntry({ id, date: today, kind: 'evening', ...todayEvening, ...patch })
  }

  const TABS = [
    { v: 'morning' as const, Icon: Icons.sun,     label: 'Morning', done: morningDone },
    { v: 'plan'    as const, Icon: Icons.check,   label: 'Plan',    done: planDone },
    { v: 'evening' as const, Icon: Icons.moon,    label: 'Evening', done: eveningDone },
    { v: 'history' as const, Icon: Icons.journal, label: 'History', done: false },
  ]

  return (
    <div className="screen">
      <ScreenHeader
        title="Journal"
        back={back}
        icon={<Icons.journal size={22} />}
        footer={
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em' }}>
              <span>MORNING + EVENING</span>
              <span>{(morningDone ? 1 : 0) + (eveningDone ? 1 : 0)}/2 done</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--paper-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${((morningDone ? 1 : 0) + (eveningDone ? 1 : 0)) * 50}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        }
      />

      {/* ── Tab switcher ── */}
      <div style={{ flexShrink: 0, padding: '10px 16px 0' }}>
        <div style={{ display: 'flex', background: 'var(--paper-2)', borderRadius: 10, padding: 3, gap: 2 }}>
          {TABS.map(t => (
            <button key={t.v} onClick={() => setTab(t.v)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8,
              fontSize: 11, fontWeight: tab === t.v ? 600 : 400,
              background: tab === t.v ? 'var(--paper)' : 'transparent',
              color: tab === t.v ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: tab === t.v ? 'var(--shadow-1)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              transition: 'all .15s',
            }}>
              <t.Icon size={12} />
              {t.label}
              {t.done && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Plan tab ── */}
      {tab === 'plan' ? (
        <div className="screen-scroll">
          <JournalPlanTab navigate={navigate} />
        </div>
      ) : (
        <div className="screen-scroll" style={{ padding: '24px 22px 44px' }}>
          {/* Editorial intro — morning/evening only */}
          {(tab === 'morning' || tab === 'evening') && (
            <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--rule)' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Journal · five minutes</div>
              <div className="t-display t-italic" style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 6 }}>
                {tab === 'morning' ? 'A quiet beginning.' : 'Today, reviewed.'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                {tab === 'morning'
                  ? 'Two short rituals — morning sets direction, evening locks in learning.'
                  : 'Reflection closes the loop. What happened, what mattered, what\'s next.'}
              </div>
            </div>
          )}

          {tab === 'morning' && <MorningForm existing={todayMorning} onSave={saveMorning} />}
          {tab === 'evening' && <EveningForm existing={todayEvening} onSave={saveEvening} />}
          {tab === 'history' && <HistoryView entries={entries} />}

          <JournalStreakStrip streak={streak} entries={entries} />
        </div>
      )}
    </div>
  )
}
