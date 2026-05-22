import React, { useState } from 'react'
import { completeHabit } from '../../data/db'
import { Icons } from '../ui/Icons'
import { useIsDark, useIsColorful } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import type { Habit, Category, Screen } from '../../types'

const TIME_ORDER = ['morning', 'afternoon', 'evening', 'anytime'] as const
const TIME_LABELS: Record<string, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', anytime: 'Anytime',
}
const TIME_ICONS: Record<string, keyof typeof import('../ui/Icons').Icons> = {
  morning: 'sun', afternoon: 'bolt', evening: 'moon', anytime: 'repeat',
}

interface Props {
  habits: Habit[]
  cats: Category[]
  navigate: (s: Screen) => void
}

function HabitRow({ habit, cats, navigate }: { habit: Habit; cats: Category[]; navigate: (s: Screen) => void }) {
  const isDark     = useIsDark()
  const isColorful = useIsColorful()
  const cat        = cats.find(c => c.id === habit.cat)
  const hue        = isColorful && cat?.hue !== undefined ? cat.hue : undefined
  const accentCol  = hue !== undefined ? areaColor(hue, 'fg', isDark) : 'var(--accent)'
  const [popping, setPopping] = useState(false)

  async function handleLog(e: React.MouseEvent) {
    e.stopPropagation()
    if (habit.done || habit.isArchived) return
    setPopping(true)
    setTimeout(() => setPopping(false), 350)
    await completeHabit(habit.id)
  }

  return (
    <button
      onClick={() => navigate({ name: 'all-habits' })}
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
        borderLeft: `3px solid ${habit.done ? 'var(--rule)' : accentCol}`,
        opacity: habit.isArchived ? 0.45 : 1,
      }}
    >
      {/* Log circle */}
      <button
        onClick={handleLog}
        aria-label={habit.done ? 'Logged' : 'Log habit'}
        style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          border: `1.5px solid ${habit.done ? accentCol : 'var(--rule)'}`,
          background: habit.done ? accentCol : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: habit.done ? 'var(--paper)' : 'transparent',
          transition: 'background .15s, border-color .15s',
          animation: popping ? 'habit-pop 0.35s ease-out' : undefined,
        }}
      >
        {habit.done && <Icons.check size={10} sw={2.5} />}
      </button>

      {/* Title */}
      <span style={{
        flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.3,
        color: habit.done ? 'var(--ink-3)' : 'var(--ink)',
        textDecoration: habit.done ? 'line-through' : 'none',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {habit.title}
      </span>

      {/* Streak */}
      {habit.streak > 0 && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: habit.done ? accentCol : 'var(--ink-4)',
          letterSpacing: '0.04em',
        }}>
          <Icons.flame size={9} />
          {habit.streak}
        </span>
      )}
    </button>
  )
}

export function TodayHabitsColumn({ habits, cats, navigate }: Props) {
  const active = habits.filter(h => !h.isArchived)
  const doneCount = active.filter(h => h.done).length

  const grouped = TIME_ORDER.reduce<Partial<Record<string, Habit[]>>>((acc, tod) => {
    const group = active.filter(h => (h.timeOfDay ?? 'anytime') === tod)
    if (group.length) acc[tod] = group
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        paddingBottom: 8, borderBottom: '1px solid var(--rule)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: 'var(--ink-4)', flex: 1,
        }}>
          Today's habits
        </span>
        {active.length > 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: doneCount === active.length && active.length > 0 ? 'var(--accent)' : 'var(--ink-3)',
          }}>
            {doneCount}/{active.length}
          </span>
        )}
        <button
          onClick={() => navigate({ name: 'all-habits' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--ink-3)', letterSpacing: '0.06em',
          }}
        >
          ALL <Icons.arrow size={11} />
        </button>
      </div>

      {active.length === 0 ? (
        <button
          onClick={() => navigate({ name: 'all-habits' })}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: '1px dashed var(--rule)', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
          }}
        >
          <Icons.plus size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--ink-4)', letterSpacing: '0.04em',
          }}>
            Build a daily habit
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {TIME_ORDER.map(tod => {
            const group = grouped[tod]
            if (!group || group.length === 0) return null
            const IconComp = Icons[TIME_ICONS[tod]]
            return (
              <div key={tod}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  <IconComp size={10} />
                  {TIME_LABELS[tod]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.map(h => (
                    <HabitRow key={h.id} habit={h} cats={cats} navigate={navigate} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
