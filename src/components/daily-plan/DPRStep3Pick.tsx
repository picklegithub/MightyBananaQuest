import React, { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useIsDark } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import { db, todayISO } from '../../data/db'
import { EFFORT } from '../../constants'
import { Icons } from '../ui/Icons'
import { isoRe } from './shared'

type TaskKind = 'overdue' | 'due' | 'habit' | 'goal' | 'suggested'

interface Candidate {
  id:     string
  title:  string
  effort: string
  hue:    number
  kind:   TaskKind
  meta:   string
}

function KindTag({ kind }: { kind: TaskKind }) {
  const map: Record<TaskKind, { label: string; color: string }> = {
    overdue:   { label: 'OVERDUE',   color: 'var(--warn)'   },
    due:       { label: 'DUE TODAY', color: 'var(--ink-2)'  },
    habit:     { label: 'HABIT',     color: 'var(--accent)' },
    goal:      { label: 'GOAL',      color: 'var(--accent)' },
    suggested: { label: 'SUGGESTED', color: 'var(--ink-3)'  },
  }
  const { label, color } = map[kind]
  return (
    <span style={{ color, fontWeight: 600, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
      {label}
    </span>
  )
}

interface Props {
  pickedIds:      Set<string>
  onPickedChange: (ids: Set<string>) => void
  mood:           'steady' | 'tired' | 'charged' | null
}

export function DPRStep3Pick({ pickedIds, onPickedChange, mood }: Props) {
  const isDark = useIsDark()
  const today  = todayISO()
  const [showAll, setShowAll] = useState(false)

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  const rawTasks  = useLiveQuery(() => db.tasks.filter(t => !t.done).toArray(), []) ?? []
  const rawHabits = useLiveQuery(() => db.habits.filter(h => !h.done && !h.isArchived).toArray(), []) ?? []
  const goals     = useLiveQuery(() => db.goals.toArray(), []) ?? []

  const goalLinkedIds = useMemo(() =>
    new Set(goals.flatMap(g => g.linked ?? []))
  , [goals])

  const taskGoalMap = useMemo(() => {
    const map = new Map<string, { goalTitle: string; why: string }>()
    for (const g of goals) {
      if (!g.why?.trim()) continue
      for (const id of (g.linked ?? [])) {
        if (!map.has(id)) map.set(id, { goalTitle: g.title, why: g.why })
      }
    }
    return map
  }, [goals])

  const candidates: Candidate[] = useMemo(() => {
    const list: Candidate[] = []
    const seen = new Set<string>()

    function add(c: Candidate) {
      if (!seen.has(c.id)) { seen.add(c.id); list.push(c) }
    }

    rawTasks
      .filter(t => isoRe.test(t.due) && t.due < today)
      .sort((a, b) => a.due < b.due ? -1 : 1)
      .forEach(t => add({ id: t.id, title: t.title, effort: t.effort, hue: catHue(t.cat), kind: 'overdue', meta: `Due ${t.due}` }))

    rawTasks
      .filter(t => t.due === 'Today' || t.due === today)
      .forEach(t => add({
        id: t.id, title: t.title, effort: t.effort, hue: catHue(t.cat),
        kind: goalLinkedIds.has(t.id) ? 'goal' : 'due',
        meta: goalLinkedIds.has(t.id) ? 'Linked to goal' : 'Due today',
      }))

    rawHabits.forEach(h => add({
      id: h.id, title: h.title, effort: 's', hue: catHue(h.cat),
      kind: 'habit', meta: h.streak > 0 ? `${h.streak}-day streak` : h.frequency,
    }))

    // Status-based sort: active → backlog → someday
    const statusOrder: Record<string, number> = { active: 0, backlog: 1, someday: 2 }

    if (showAll) {
      rawTasks
        .filter(t => !seen.has(t.id))
        .sort((a, b) => {
          const sd = (statusOrder[a.status ?? 'backlog'] ?? 1) - (statusOrder[b.status ?? 'backlog'] ?? 1)
          if (sd !== 0) return sd
          return a.title < b.title ? -1 : 1
        })
        .forEach(t => add({
          id: t.id, title: t.title, effort: t.effort, hue: catHue(t.cat),
          kind: goalLinkedIds.has(t.id) ? 'goal' : 'suggested',
          meta: goalLinkedIds.has(t.id) ? 'Linked to goal' : (t.due || (t.status ?? 'backlog')),
        }))
    } else {
      // Suggested mode: surface active tasks + goal-linked tasks, up to 3
      rawTasks
        .filter(t =>
          (t.status === 'active' || goalLinkedIds.has(t.id)) &&
          t.due !== 'Today' && t.due !== today &&
          !(isoRe.test(t.due) && t.due < today) &&
          !seen.has(t.id)
        )
        .sort((a, b) => (statusOrder[a.status ?? 'backlog'] ?? 1) - (statusOrder[b.status ?? 'backlog'] ?? 1))
        .slice(0, 3)
        .forEach(t => add({
          id: t.id, title: t.title, effort: t.effort, hue: catHue(t.cat),
          kind: goalLinkedIds.has(t.id) ? 'goal' : 'suggested',
          meta: goalLinkedIds.has(t.id) ? 'Linked to goal' : (t.due || 'No date'),
        }))
    }

    if (mood === 'tired') {
      const smallEfforts = new Set(['xs', 's'])
      list.sort((a, b) => {
        const aSmall = smallEfforts.has(a.effort ?? '')
        const bSmall = smallEfforts.has(b.effort ?? '')
        if (aSmall && !bSmall) return -1
        if (!aSmall && bSmall) return 1
        return 0
      })
    }

    return list
  }, [rawTasks, rawHabits, goals, goalLinkedIds, categories, today, showAll, mood])

  useEffect(() => {
    if (pickedIds.size === 0 && candidates.length > 0) {
      const autoSelect = new Set(
        candidates.filter(c => c.kind === 'overdue' || c.kind === 'due').map(c => c.id)
      )
      if (autoSelect.size > 0) onPickedChange(autoSelect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.length])

  function toggle(id: string) {
    const next = new Set(pickedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onPickedChange(next)
  }

  const totalMin = useMemo(() => {
    let mins = 0
    for (const id of pickedIds) {
      const c = candidates.find(x => x.id === id)
      if (c) mins += EFFORT[c.effort as keyof typeof EFFORT]?.mins ?? 15
    }
    return mins
  }, [pickedIds, candidates])

  const totalHH = Math.floor(totalMin / 60)
  const totalMM = totalMin % 60

  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>Pick today's work</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
            {mood === 'tired' ? 'Light day — starting with smaller tasks.' : 'Tap tasks to pick them for today.'}
          </div>
        </div>
        <button
          onClick={() => setShowAll(s => !s)}
          style={{
            flexShrink: 0, marginTop: 6,
            padding: '6px 10px', borderRadius: 8,
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
            background: showAll ? 'var(--ink)' : 'var(--paper-2)',
            color: showAll ? 'var(--paper)' : 'var(--ink-3)',
            border: '1px solid', borderColor: showAll ? 'var(--ink)' : 'var(--rule)',
          }}
        >
          {showAll ? 'Suggested' : 'All tasks'}
        </button>
      </div>

      {pickedIds.size > 0 && (
        <div style={{
          position: 'sticky', top: -20, zIndex: 2,
          background: 'var(--paper)', paddingTop: 8, paddingBottom: 8, marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--rule)',
        }}>
          <span className="eyebrow">{pickedIds.size} selected</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
            {totalHH > 0 ? `${totalHH}h ` : ''}{totalMM}m total
          </span>
        </div>
      )}

      {candidates.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '12px 0' }}>
          No tasks found — add some or tap Continue to proceed.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(() => {
          const shownGoalWhys = new Set<string>()
          return candidates.map(c => {
            const on       = pickedIds.has(c.id)
            const effort   = EFFORT[c.effort as keyof typeof EFFORT]
            const goalInfo = taskGoalMap.get(c.id)
            const showWhy  = goalInfo && !shownGoalWhys.has(goalInfo.why)
            if (showWhy) shownGoalWhys.add(goalInfo!.why)
            return (
              <div key={c.id}>
                <button
                  onClick={() => toggle(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    padding: '10px 12px', borderRadius: 10, width: '100%',
                    background: on ? 'var(--paper-2)' : 'transparent',
                    border: `1px solid ${on ? areaColor(c.hue, 'fg', isDark) : 'var(--rule)'}`,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: `1.5px solid ${on ? areaColor(c.hue, 'fg', isDark) : 'var(--rule)'}`,
                    background: on ? areaColor(c.hue, 'fg', isDark) : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    {on && <Icons.check size={11} sw={2.5} stroke="var(--paper)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.3 }}>{c.title}</div>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)',
                      marginTop: 2, letterSpacing: '0.04em',
                      display: 'flex', gap: 6, alignItems: 'center',
                    }}>
                      <KindTag kind={c.kind} />
                      <span>· {c.meta}</span>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
                    {effort?.glyph ?? '●'}{' '}
                    {effort ? (effort.mins >= 60 ? `${Math.round(effort.mins / 60)}h` : `${effort.mins}m`) : ''}
                  </span>
                </button>
                {showWhy && (
                  <div style={{
                    fontFamily: 'var(--font-display)', fontStyle: 'italic',
                    fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5,
                    paddingLeft: 40, marginTop: 3,
                  }}>
                    {goalInfo!.why}
                  </div>
                )}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
