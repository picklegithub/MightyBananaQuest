import React from 'react'
import { Icons } from '../ui/Icons'
import { areaColor } from '../../lib/areaColor'
import type { Task, Category, Screen } from '../../types'

interface Props {
  tasks: Task[]
  cats: Category[]
  navigate: (s: Screen) => void
  isColorful: boolean
  isDark: boolean
  onAddArea: () => void
}

export function AreaGrid({ tasks, cats, navigate, isColorful, isDark, onAddArea }: Props) {
  return (
    <div style={{ padding: '14px 20px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--rule)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
          Areas
        </span>
        <button
          onClick={() => navigate({ name: 'category', catId: cats[0]?.id ?? '' })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          SEE ALL <Icons.arrow size={11} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {cats.map((cat: Category) => {
          const catTasks       = tasks.filter(t => t.cat === cat.id)
          const catDone        = catTasks.filter(t => t.done).length
          const catOpen        = catTasks.filter(t => !t.done).length
          const catTotal       = catTasks.length
          const recurringCount = catTasks.filter(t => !!t.recurring).length
          const progress       = catTotal > 0 ? catDone / catTotal : 0
          const I   = Icons[cat.icon] ?? Icons.home
          const hue = cat.hue
          const R   = 11, C = 2 * Math.PI * R

          return (
            <div key={cat.id} style={{ position: 'relative' }}>
              <button
                onClick={() => navigate({ name: 'category', catId: cat.id })}
                style={{
                  width: '100%', padding: '11px 10px 10px', borderRadius: 12, textAlign: 'left',
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  display: 'flex', flexDirection: 'column', gap: 7,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: isColorful ? areaColor(hue, 'bg', isDark) : 'var(--paper-2)',
                    color: isColorful ? areaColor(hue, 'fg', isDark) : 'var(--ink-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <I size={14} />
                  </div>
                  {catTotal > 0 && (
                    <svg width={26} height={26} style={{ flexShrink: 0 }}>
                      <circle cx={13} cy={13} r={R} fill="none" stroke="var(--rule)" strokeWidth={2.5} />
                      <circle cx={13} cy={13} r={R} fill="none"
                        stroke={isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)'} strokeWidth={2.5}
                        strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                        strokeLinecap="round" transform="rotate(-90 13 13)" />
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{cat.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {catOpen > 0 ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                      {catOpen} open
                    </span>
                  ) : catTotal > 0 ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isColorful ? areaColor(hue, 'fg', isDark) : 'var(--accent)', letterSpacing: '0.04em' }}>
                      ✓ all done
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                      empty
                    </span>
                  )}
                  {recurringCount > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Icons.repeat size={8} />{recurringCount}
                    </span>
                  )}
                </div>
              </button>
            </div>
          )
        })}
        <button onClick={onAddArea} style={{
          padding: '12px 10px', borderRadius: 12, textAlign: 'left',
          background: 'transparent', border: '1px dashed var(--rule)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 72,
        }}>
          <Icons.plus size={18} style={{ color: 'var(--ink-4)' }} />
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>ADD AREA</span>
        </button>
      </div>
    </div>
  )
}
