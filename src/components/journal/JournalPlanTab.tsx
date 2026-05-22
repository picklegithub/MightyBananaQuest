import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO, saveDailyPlan } from '../../data/db'
import { Icons } from '../ui/Icons'
import { DPRStep3Pick } from '../daily-plan/DPRStep3Pick'
import { DPRStep4Top3 } from '../daily-plan/DPRStep4Top3'
import type { Screen } from '../../types'

interface Props {
  navigate: (s: Screen) => void
}

export function JournalPlanTab({ navigate }: Props) {
  const today     = todayISO()
  const todayPlan = useLiveQuery(() => db.dailyPlans.get(today), [])
  const allTasks  = useLiveQuery(() => db.tasks.toArray(), []) ?? []

  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())
  const [top3Ids,   setTop3Ids]   = useState<string[]>([])
  const [saving,    setSaving]    = useState(false)
  const [hydrated,  setHydrated]  = useState(false)

  // Restore in-progress plan state on first load
  useEffect(() => {
    if (!todayPlan || hydrated) return
    if (todayPlan.pickedIds?.length) setPickedIds(new Set(todayPlan.pickedIds))
    if (todayPlan.top3Ids?.length)   setTop3Ids(todayPlan.top3Ids)
    setHydrated(true)
  }, [todayPlan, hydrated])

  async function handlePickedChange(ids: Set<string>) {
    setPickedIds(ids)
    await saveDailyPlan({ pickedIds: [...ids], top3Ids, completedAt: null })
  }

  async function handleTop3Change(ids: string[]) {
    setTop3Ids(ids)
    await saveDailyPlan({ pickedIds: [...pickedIds], top3Ids: ids, completedAt: null })
  }

  async function handleCommit() {
    setSaving(true)
    try {
      const existing = await db.dailyPlans.get(today)
      await saveDailyPlan({ pickedIds: [...pickedIds], top3Ids, completedAt: Date.now() })
      if (!existing?.completedAt) {
        const settings = await db.settings.get(1)
        if (settings) await db.settings.update(1, { xp: (settings.xp ?? 0) + 3 })
      }
    } finally {
      setSaving(false)
    }
  }

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.'

  // ── Done state ─────────────────────────────────────────────────────────────
  if (todayPlan?.completedAt) {
    return (
      <div style={{ padding: '32px 22px 44px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div className="t-display t-italic" style={{ fontSize: 22, marginBottom: 6 }}>Day planned.</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Your top 3 are locked in. Head to Today to stay on track.
          </div>
        </div>

        {(todayPlan.top3Ids ?? []).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 10 }}>
              Top 3
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayPlan.top3Ids.map((id, i) => {
                const t = allTasks.find(x => x.id === id)
                if (!t) return null
                return (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{
                      fontSize: 14, flex: 1,
                      color: t.done ? 'var(--ink-3)' : 'var(--ink)',
                      textDecoration: t.done ? 'line-through' : 'none',
                    }}>{t.title}</span>
                    {t.done && <Icons.check size={13} stroke="var(--accent)" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate({ name: 'today' })}
            style={{
              flex: 1, padding: '12px', borderRadius: 12,
              background: 'var(--ink)', color: 'var(--paper)',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Go to Today
          </button>
          <button
            onClick={() => saveDailyPlan({ completedAt: null })}
            style={{
              padding: '12px 16px', borderRadius: 12,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)',
              letterSpacing: '0.04em', flexShrink: 0,
            }}
          >
            Re-plan
          </button>
        </div>
      </div>
    )
  }

  // ── Plan form ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 22px 44px', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Greeting */}
      <div>
        <div className="t-display t-italic" style={{ fontSize: 22, lineHeight: 1.2 }}>{greeting}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.06em' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        </div>
      </div>

      {/* Pick */}
      <div>
        <DPRStep3Pick pickedIds={pickedIds} onPickedChange={handlePickedChange} mood={null} />
      </div>

      {/* Top 3 — only once something is picked */}
      {pickedIds.size > 0 && (
        <div>
          <DPRStep4Top3 pickedIds={pickedIds} top3Ids={top3Ids} onTop3Change={handleTop3Change} />
        </div>
      )}

      {/* Commit */}
      <button
        onClick={handleCommit}
        disabled={saving || pickedIds.size === 0}
        style={{
          padding: '14px', borderRadius: 12,
          background: pickedIds.size > 0 ? 'var(--ink)' : 'var(--paper-3)',
          color: pickedIds.size > 0 ? 'var(--paper)' : 'var(--ink-4)',
          fontSize: 14, fontWeight: 600,
          opacity: saving ? 0.6 : 1,
          transition: 'all .15s',
        }}
      >
        {saving ? 'Saving…' : 'Commit to today →'}
      </button>
    </div>
  )
}
