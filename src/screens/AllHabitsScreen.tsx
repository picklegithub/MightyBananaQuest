import { localDateISO } from '../lib/useCurrentDate'
import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeHabit, deleteHabit, updateHabit } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { SwipeableRow } from '../components/SwipeableRow'
import { HabitHeatmap } from '../components/HabitHeatmap'
import { AddTaskSheet } from '../components/AddTaskSheet'
import type { Screen, Habit } from '../types'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props { navigate: (s: Screen) => void; back: () => void; onAddHabit?: () => void }
interface Burst { id: number; x: number; y: number; xp: number }

// ── Habit cap ─────────────────────────────────────────────────────────────────
const HABIT_CAP = 12

// ── Today's ISO date ───────────────────────────────────────────────────────────
const todayISO = localDateISO()

// ── Time-of-day segments ──────────────────────────────────────────────────────
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime'

const TIME_SEGMENTS: { key: TimeOfDay; label: string; emoji: string; hours: [number, number] }[] = [
  { key: 'morning',   label: 'Morning',   emoji: '🌅', hours: [5,  11] },
  { key: 'afternoon', label: 'Afternoon', emoji: '☀️',  hours: [12, 16] },
  { key: 'evening',   label: 'Evening',   emoji: '🌙', hours: [17, 23] },
  { key: 'anytime',   label: 'Anytime',   emoji: '🔁', hours: [0,  23] },
]

function getCurrentSegment(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 5  && h <= 11) return 'morning'
  if (h >= 12 && h <= 16) return 'afternoon'
  if (h >= 17)            return 'evening'
  return 'anytime'
}

// ── Strength bar ──────────────────────────────────────────────────────────────
function StrengthBar({ strength, hue }: { strength?: number; hue: number }) {
  const pct   = Math.round((strength ?? 0.5) * 100)
  const isDark = useIsDark()
  const color  = areaColor(hue, 'fg', isDark)
  const label = pct >= 80 ? 'Strong' : pct >= 50 ? 'Building' : 'Weak'
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
          STRENGTH · {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'var(--paper-3)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, background: color,
          width: `${pct}%`, transition: 'width .4s ease',
        }} />
      </div>
    </div>
  )
}

// ── Streak badge ──────────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  if (!streak) return null
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10,
      color: 'var(--accent)', letterSpacing: '0.04em',
    }}>
      🔥 {streak}
    </span>
  )
}

// ── Habit card row ────────────────────────────────────────────────────────────
function HabitRow({
  habit, hue, showStrength,
  onCheckin, onDelete, onTap, onArchive, onEdit,
}: {
  habit: Habit
  hue?: number
  showStrength?: boolean
  onCheckin: (e: React.MouseEvent) => void
  onDelete: () => void
  onTap: () => void
  onArchive: () => void
  onEdit: () => void
}) {
  const loggedToday = !!habit.done
  const safeHue = hue ?? 220
  const color    = `hsl(${safeHue}, 55%, 42%)`
  const softBg   = `hsl(${safeHue}, 40%, 93%)`
  const softRule = `hsl(${safeHue}, 35%, 80%)`

  return (
    <SwipeableRow onDelete={onDelete}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '11px 14px',
        background: loggedToday ? softBg : 'var(--paper-2)',
        borderRadius: 12,
        border: `1px solid ${loggedToday ? softRule : 'var(--rule)'}`,
        borderLeft: `3px solid ${color}`,
        transition: 'all .15s',
      }}>
        {/* Check-in button */}
        <button
          onClick={onCheckin}
          style={{
            flexShrink: 0,
            width: 26, height: 26, borderRadius: '50%',
            border: `1.5px solid ${loggedToday ? color : 'var(--rule)'}`,
            background: loggedToday ? color : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginTop: 1,
          }}
        >
          {loggedToday && <Icons.check size={12} sw={2.5} />}
        </button>

        {/* Title + meta */}
        <button onClick={onTap} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{
            fontSize: 14, fontWeight: 500, lineHeight: 1.3,
            color: loggedToday ? `hsl(${safeHue}, 40%, 35%)` : 'var(--ink)',
            marginBottom: 3,
          }}>
            {habit.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StreakBadge streak={habit.streak} />
            {(habit.bestStreak ?? 0) > 0 && (habit.bestStreak ?? 0) !== habit.streak && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--ink-4)', letterSpacing: '0.04em',
              }}>
                Best: {habit.bestStreak}
              </span>
            )}
            {habit.frequency && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                🔁 {habit.frequency}
              </span>
            )}
            {habit.timeOfDay && habit.timeOfDay !== 'anytime' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                {TIME_SEGMENTS.find(s => s.key === habit.timeOfDay)?.emoji} {habit.timeOfDay}
              </span>
            )}
          </div>
          {habit.notes && habit.notes.trim().length > 0 && (
            <div style={{
              marginTop: 4,
              fontSize: 11, color: 'var(--ink-4)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>
              {habit.notes.trim()}
            </div>
          )}
          {showStrength && <StrengthBar strength={habit.strength} hue={safeHue} />}
        </button>

        {/* Right-side controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {loggedToday && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
              color, flexShrink: 0,
            }}>
              DONE
            </span>
          )}
          {/* Edit */}
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            title="Edit habit"
            style={{
              padding: '3px 6px', borderRadius: 6,
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: 'var(--ink-3)', border: '1px solid var(--rule)',
              background: 'transparent',
            }}
          >
            Edit
          </button>
          {/* Archive toggle */}
          <button
            onClick={e => { e.stopPropagation(); onArchive() }}
            title="Archive habit"
            style={{
              padding: '3px 6px', borderRadius: 6,
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
              color: 'var(--ink-4)', border: '1px solid var(--rule)',
              background: 'transparent',
            }}
          >
            Archive
          </button>
        </div>
      </div>
    </SwipeableRow>
  )
}

// ── Archived habit row (compact) ──────────────────────────────────────────────
function ArchivedHabitRow({ habit, hue, onUnarchive, onDelete }: {
  habit: Habit; hue: number; onUnarchive: () => void; onDelete: () => void
}) {
  const isDark = useIsDark()
  const color  = areaColor(hue, 'fg', isDark)
  return (
    <SwipeableRow onDelete={onDelete}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px',
        background: 'var(--paper-2)', borderRadius: 12,
        border: '1px solid var(--rule)', borderLeft: `3px solid ${color}`,
        opacity: 0.6,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
            {habit.title}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {habit.bestStreak > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                Best: {habit.bestStreak}
              </span>
            )}
            {habit.strength !== undefined && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                Strength: {Math.round(habit.strength * 100)}%
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onUnarchive}
          style={{
            padding: '5px 10px', borderRadius: 8,
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
            color: 'var(--ink-2)', border: '1px solid var(--rule)',
            background: 'var(--paper-3)',
          }}
        >
          Restore
        </button>
      </div>
    </SwipeableRow>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AllHabitsScreen = ({ navigate: _navigate, back, onAddHabit }: Props) => {
  const [catFilter,     setCatFilter]     = useState<string>('all')
  const [bursts,        setBursts]        = useState<Burst[]>([])
  const [expandedHeat,  setExpandedHeat]  = useState<Set<string>>(new Set())
  const [showStrength,  setShowStrength]  = useState(false)
  const [showArchived,  setShowArchived]  = useState(false)
  const [capWarning,    setCapWarning]    = useState(false)
  const [editingHabit,  setEditingHabit]  = useState<Habit | null>(null)
  const currentSegment = getCurrentSegment()

  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const cats   = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES

  if (!habits) return null

  const activeHabits   = habits.filter(h => !h.isArchived)
  const archivedHabits = habits.filter(h => !!h.isArchived)

  const filtered = catFilter === 'all' ? activeHabits : activeHabits.filter(h => h.cat === catFilter)
  const pending  = filtered.filter(h => !h.done)
  const logged   = filtered.filter(h => h.done)

  // Group pending habits by time-of-day segment
  function habitsBySegment(list: Habit[]) {
    const groups: { seg: typeof TIME_SEGMENTS[0]; habits: Habit[] }[] = []
    for (const seg of TIME_SEGMENTS) {
      const group = list.filter(h => (h.timeOfDay ?? 'anytime') === seg.key)
      if (group.length > 0) groups.push({ seg, habits: group })
    }
    return groups
  }

  // Are multiple segments represented? If so, show segment headers
  const segKeys = new Set(pending.map(h => h.timeOfDay ?? 'anytime'))
  const useSegmentHeaders = segKeys.size > 1

  async function handleCheckin(e: React.MouseEvent, habit: Habit) {
    e.stopPropagation()
    if (habit.done) return
    const gained = await completeHabit(habit.id)
    if (gained > 0) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const burst: Burst = { id: Date.now(), x: rect.left + rect.width / 2, y: rect.top, xp: gained }
      setBursts(b => [...b, burst])
      setTimeout(() => setBursts(b => b.filter(x => x.id !== burst.id)), 1400)
    }
  }

  async function handleArchive(habit: Habit) {
    await updateHabit(habit.id, { isArchived: true })
    setCapWarning(false)
  }

  async function handleUnarchive(habit: Habit) {
    await updateHabit(habit.id, { isArchived: false })
  }

  function handleAddHabit() {
    if (activeHabits.length >= HABIT_CAP) {
      setCapWarning(true)
      return
    }
    setCapWarning(false)
    onAddHabit?.()
  }

  function renderHabitCard(habit: Habit) {
    const hue = cats.find(c => c.id === habit.cat)?.hue ?? 220
    const heatOpen = expandedHeat.has(habit.id)
    return (
      <div key={habit.id} style={{
        background: 'var(--paper-2)', borderRadius: 12,
        border: '1px solid var(--rule)', overflow: 'hidden',
      }}>
        <HabitRow
          habit={habit} hue={hue} showStrength={showStrength}
          onCheckin={e => handleCheckin(e, habit)}
          onDelete={() => deleteHabit(habit.id)}
          onArchive={() => handleArchive(habit)}
          onEdit={() => setEditingHabit(habit)}
          onTap={() => setExpandedHeat(prev => {
            const next = new Set(prev)
            next.has(habit.id) ? next.delete(habit.id) : next.add(habit.id)
            return next
          })}
        />
        {heatOpen && (
          <div style={{ borderTop: '1px solid var(--rule)' }}>
            <HabitHeatmap habitId={habit.id} hue={hue} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      {editingHabit && (
        <AddTaskSheet
          editHabit={editingHabit}
          onClose={() => setEditingHabit(null)}
        />
      )}
      <ScreenHeader
        title="Habits"
        subtitle={`${pending.length} pending · ${logged.length} logged today · ${activeHabits.length}/${HABIT_CAP}`}
        back={back}
        rightActions={
          <button
            onClick={() => setShowStrength(s => !s)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
              color: showStrength ? 'var(--accent)' : 'var(--ink-3)',
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid', borderColor: showStrength ? 'var(--accent)' : 'var(--rule)',
            }}
          >
            Strength
          </button>
        }
      />

      {/* Category filter chips */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid var(--rule)',
        flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6,
      }}>
        {['all', ...cats.map(c => c.id)].map(id => {
          const label = id === 'all' ? 'All' : cats.find(c => c.id === id)?.name ?? id
          return (
            <button key={id} onClick={() => setCatFilter(id)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 20,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
              background: catFilter === id ? 'var(--ink)' : 'var(--paper-2)',
              color: catFilter === id ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid', borderColor: catFilter === id ? 'var(--ink)' : 'var(--rule)',
            }}>
              {label}
            </button>
          )
        })}
      </div>

      <div className="screen-scroll" style={{ padding: '14px 20px 40px' }}>

        {/* ── Habit cap warning ── */}
        {capWarning && (
          <div style={{
            marginBottom: 16, padding: '12px 14px', borderRadius: 12,
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
              Habit cap reached ({HABIT_CAP} active habits)
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
              Research suggests 12 habits is the upper limit for sustainable tracking.
              Archive a habit you're not actively working on to make room.
            </div>
            <button onClick={() => setCapWarning(false)} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
              color: 'var(--ink-3)', padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--rule)', background: 'var(--paper)',
            }}>
              Dismiss
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔁</div>
            <div className="t-display" style={{ fontSize: 20, marginBottom: 6 }}>No habits yet</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Daily/weekly habits with streak tracking.
            </div>
            <button onClick={handleAddHabit} style={{
              padding: '12px 24px', borderRadius: 12, background: 'var(--ink)', color: 'var(--paper)',
              fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icons.plus size={16} /> Add habit
            </button>
          </div>
        ) : (
          <>
            {/* Pending habits — optionally grouped by time-of-day */}
            {pending.length > 0 && (
              <div style={{ marginBottom: logged.length > 0 ? 24 : 0 }}>
                {useSegmentHeaders ? (
                  <>
                    {habitsBySegment(pending).map(({ seg, habits: group }) => (
                      <div key={seg.key} style={{ marginBottom: 20 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                        }}>
                          <span style={{ fontSize: 14 }}>{seg.emoji}</span>
                          <span className="eyebrow" style={{
                            ...(seg.key === currentSegment ? { color: 'var(--accent)' } : {}),
                          }}>
                            {seg.label}
                            {seg.key === currentSegment && ' · now'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {group.map(renderHabitCard)}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {catFilter === 'all' && (
                      <div className="eyebrow" style={{ marginBottom: 10 }}>To do today</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {pending.map(renderHabitCard)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logged today */}
            {logged.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="eyebrow" style={{ marginBottom: 10, opacity: 0.5 }}>Logged today</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {logged.map(renderHabitCard)}
                </div>
              </div>
            )}

            {/* Add habit button */}
            <button onClick={handleAddHabit} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 14px',
              borderRadius: 12, border: '1px dashed var(--rule)',
              color: activeHabits.length >= HABIT_CAP ? 'var(--ink-4)' : 'var(--ink-3)',
              fontSize: 13, marginBottom: 28,
              opacity: activeHabits.length >= HABIT_CAP ? 0.6 : 1,
            }}>
              <Icons.plus size={14} />
              {activeHabits.length >= HABIT_CAP ? `Habit cap reached (${HABIT_CAP})` : 'Add habit'}
            </button>
          </>
        )}

        {/* ── Archived section ── */}
        {archivedHabits.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
                color: 'var(--ink-3)',
              }}
            >
              <span className="eyebrow" style={{ opacity: 0.5 }}>
                Archived ({archivedHabits.length})
              </span>
              <span style={{
              display: 'inline-block',
              transform: showArchived ? 'rotate(180deg)' : 'none',
              transition: 'transform .2s',
              fontSize: 10,
            }}>▾</span>
            </button>
            {showArchived && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {archivedHabits.map(habit => {
                  const hue = cats.find(c => c.id === habit.cat)?.hue ?? 220
                  return (
                    <ArchivedHabitRow
                      key={habit.id}
                      habit={habit}
                      hue={hue}
                      onUnarchive={() => handleUnarchive(habit)}
                      onDelete={() => deleteHabit(habit.id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
