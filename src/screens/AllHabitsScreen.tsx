import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, completeHabit, deleteHabit } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
import { ConfettiBurst } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { SwipeableRow } from '../components/SwipeableRow'
import type { Screen, Habit } from '../types'

interface Props { navigate: (s: Screen) => void; back: () => void; onAddHabit?: () => void }
interface Burst { id: number; x: number; y: number; xp: number }

// ── Today's ISO date ───────────────────────────────────────────────────────────
const todayISO = new Date().toISOString().slice(0, 10)

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
  habit, hue,
  onCheckin, onDelete, onTap,
}: {
  habit: Habit
  hue?: number
  onCheckin: (e: React.MouseEvent) => void
  onDelete: () => void
  onTap: () => void
}) {
  const loggedToday = !!habit.done
  const safeHue = hue ?? 220
  const color    = `hsl(${safeHue}, 55%, 42%)`
  const softBg   = `hsl(${safeHue}, 40%, 93%)`
  const softRule = `hsl(${safeHue}, 35%, 80%)`

  return (
    <SwipeableRow onDelete={onDelete}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
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
            color: 'white',
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
            {habit.frequency && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                🔁 {habit.frequency}
              </span>
            )}
          </div>
          {/* Notes preview */}
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
        </button>

        {/* Done label */}
        {loggedToday && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
            color: color, flexShrink: 0,
          }}>
            DONE
          </span>
        )}
      </div>
    </SwipeableRow>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const AllHabitsScreen = ({ navigate, back, onAddHabit }: Props) => {
  const [catFilter, setCatFilter] = useState<string>('all')
  const [bursts, setBursts]       = useState<Burst[]>([])

  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const cats   = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES

  if (!habits) return null

  const filtered = catFilter === 'all' ? habits : habits.filter(h => h.cat === catFilter)
  const pending  = filtered.filter(h => !h.done)
  const logged   = filtered.filter(h => h.done)

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

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center' }}>
          <Icons.back size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="t-display" style={{ fontSize: 22 }}>All Habits</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 1 }}>
            {pending.length} pending · {logged.length} logged today
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />
          <button onClick={() => navigate({ name: 'settings' })} style={{ color: 'var(--ink-2)' }}>
            <Icons.settings size={20} />
          </button>
        </div>
      </div>

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
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔁</div>
            <div className="t-display" style={{ fontSize: 20, marginBottom: 6 }}>No habits yet</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Daily/weekly habits with streak tracking.
            </div>
            <button onClick={() => onAddHabit?.()} style={{
              padding: '12px 24px', borderRadius: 12, background: 'var(--ink)', color: 'var(--paper)',
              fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icons.plus size={16} /> Add habit
            </button>
          </div>
        ) : (
          <>
            {/* Pending habits */}
            {pending.length > 0 && (
              <div style={{ marginBottom: logged.length > 0 ? 24 : 0 }}>
                {catFilter === 'all' && (
                  <div className="eyebrow" style={{ marginBottom: 10 }}>To do today</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {pending.map(habit => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      hue={cats.find(c => c.id === habit.cat)?.hue}
                      onCheckin={e => handleCheckin(e, habit)}
                      onDelete={() => deleteHabit(habit.id)}
                      onTap={() => navigate({ name: 'all-habits' })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Logged today */}
            {logged.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 10, opacity: 0.5 }}>Logged today</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {logged.map(habit => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      hue={cats.find(c => c.id === habit.cat)?.hue}
                      onCheckin={e => handleCheckin(e, habit)}
                      onDelete={() => deleteHabit(habit.id)}
                      onTap={() => navigate({ name: 'all-habits' })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {bursts.map(b => <ConfettiBurst key={b.id} x={b.x} y={b.y} xp={b.xp} />)}
    </div>
  )
}
