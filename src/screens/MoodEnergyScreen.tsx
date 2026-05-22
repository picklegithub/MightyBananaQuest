/**
 * MoodEnergyScreen — Phase 4 (merged)
 *
 * Unified longitudinal view combining mood tracking and energy scoring.
 * Shows a split hero, a combined 30-day timeline (mood + energy per day),
 * distribution bars for both dimensions, habit × mood correlation,
 * energy × output correlation, and a sustainability score breakdown.
 */

import React, { useEffect, useState } from 'react'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Icons } from '../components/ui/Icons'
import { useNav } from '../lib/navContext'
import { MOOD_SCALE, ENERGY_OPTIONS } from '../components/mood/constants'
import { MoodEntrySheet } from '../components/mood/MoodEntrySheet'
import {
  getMoodEnergyHistory,
  getMoodDistribution5,
  getEnergyStats,
  getProductivityByEnergy,
  getSustainabilityScore,
  getHabitCompletionByMood,
  type DayMoodEnergy,
  type MoodDistribution5,
  type EnergyStats,
  type ProductivityByEnergy,
  type HabitByMood,
  type MoodEnergy,
  type MoodState,
} from '../lib/analyticsQueries'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Look up a MOOD_SCALE entry by score. */
function moodScaleEntry(score: number) {
  return MOOD_SCALE.find(m => m.score === score)
}

/** Resolve the best mood score for a day — prefers new moodScore, falls back to legacy 3-state. */
function resolveScore(d: DayMoodEnergy): number | null {
  if (d.moodScore) return d.moodScore
  const legacy = d.planMood ?? d.morningMood
  if (legacy === 'charged') return 4
  if (legacy === 'steady')  return 3
  if (legacy === 'tired')   return 2
  return null
}

/** Resolve the best energy for a day — prefers new energyLevel, falls back to legacy numeric. */
function resolveEnergy(d: DayMoodEnergy): MoodEnergy | null {
  if (d.energyLevel) return d.energyLevel
  if (d.energy === 3) return 'charged'
  if (d.energy === 2) return 'steady'
  if (d.energy === 1) return 'tired'
  return null
}

// Energy look-up maps (string keys)
const ENERGY_COLORS: Record<MoodEnergy, string> = {
  tired:   'var(--warn)',
  steady:  'var(--ink-2)',
  charged: 'var(--accent)',
}
const ENERGY_LABELS: Record<MoodEnergy, string> = {
  tired:   'Tired',
  steady:  'Steady',
  charged: 'Strong',
}
const ENERGY_EMOJI: Record<MoodEnergy, string> = {
  tired:   '○',
  steady:  '◑',
  charged: '●',
}

// Defined display order: best → worst
const ENERGY_ORDER: MoodEnergy[] = ['charged', 'steady', 'tired']

function dayOfMonth(iso: string): string {
  return String(new Date(iso + 'T12:00:00').getDate())
}

function trendArrow(trend: EnergyStats['trend']): string {
  if (trend === 'up')     return '↑'
  if (trend === 'down')   return '↓'
  if (trend === 'stable') return '→'
  return '—'
}
function trendColor(trend: EnergyStats['trend']): string {
  if (trend === 'up')   return 'var(--accent)'
  if (trend === 'down') return 'var(--warn)'
  return 'var(--ink-3)'
}
function avgEnergyLabel(avg: number): string {
  if (isNaN(avg)) return 'No data'
  if (avg >= 2.5) return 'Strong'
  if (avg >= 1.5) return 'Steady'
  return 'Low'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
        color: 'var(--ink-4)', textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/** Sustainability score ring — 0–100 arc */
function ScoreRing({ score }: { score: number }) {
  const valid = !isNaN(score)
  const pct   = valid ? Math.min(Math.max(score, 0), 100) : 0
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  const color = pct >= 70 ? 'var(--accent)' : pct >= 40 ? 'var(--ink-2)' : 'var(--warn)'

  return (
    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
      <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={6} />
        <circle
          cx={45} cy={45} r={r}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic',
          color: valid ? color : 'var(--ink-4)', lineHeight: 1,
        }}>
          {valid ? Math.round(score) : '—'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.08em', marginTop: 1 }}>
          /100
        </div>
      </div>
    </div>
  )
}

/**
 * Combined 30-day timeline — two dots per day: mood (top) + energy (bottom).
 * Mood dot uses 5-point scale colors; energy dot uses string-keyed colours.
 */
function CombinedStrip({ history }: { history: DayMoodEnergy[] }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {history.map(d => {
          const score  = resolveScore(d)
          const energy = resolveEnergy(d)
          const entry  = score ? moodScaleEntry(score) : null
          const dotColor = entry?.color ?? 'var(--paper-3)'
          const eCl    = energy ? ENERGY_COLORS[energy] : 'var(--paper-3)'

          return (
            <div
              key={d.date}
              title={`${d.date} · mood: ${entry?.label ?? '—'} · energy: ${energy ? ENERGY_LABELS[energy] : '—'}`}
              style={{
                width: 28, flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              {/* Mood dot */}
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: dotColor,
                opacity: score ? 1 : 0.15,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8,
              }}>
                {entry?.glyph ?? ''}
              </div>
              {/* Energy dot */}
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: eCl,
                opacity: energy ? 1 : 0.15,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8,
              }}>
                {energy ? ENERGY_EMOJI[energy] : ''}
              </div>
              {/* Date */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-4)', lineHeight: 1, marginTop: 1 }}>
                {dayOfMonth(d.date)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Row labels */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Mood legend — 5-point */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', width: 44, flexShrink: 0 }}>Mood</span>
          {MOOD_SCALE.map(m => (
            <div key={m.score} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>
                {m.glyph} {m.label}
              </span>
            </div>
          ))}
        </div>
        {/* Energy legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', width: 44, flexShrink: 0 }}>Energy</span>
          {ENERGY_ORDER.map(e => (
            <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ENERGY_COLORS[e] }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                {ENERGY_EMOJI[e]} {ENERGY_LABELS[e]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mood distribution bars — 5-point scale */
function MoodDistributionBars({ dist }: { dist: MoodDistribution5 }) {
  const daysWithData = dist[1] + dist[2] + dist[3] + dist[4] + dist[5]
  if (daysWithData === 0) return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', padding: '8px 0' }}>
      Log mood in Daily Plan or Morning Journal to see distribution.
    </div>
  )

  const bars = [...MOOD_SCALE].reverse().map(m => ({
    score: m.score, glyph: m.glyph, label: m.label,
    color: m.color, count: dist[m.score as 1|2|3|4|5],
  }))
  const max = Math.max(...bars.map(b => b.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bars.map(bar => (
        <div key={bar.score} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', flexShrink: 0 }}>
            {bar.glyph} {bar.label}
          </div>
          <div style={{ flex: 1, height: 10, background: 'var(--paper-3)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              width: `${(bar.count / max) * 100}%`, height: '100%',
              background: bar.color, borderRadius: 5,
              transition: 'width .5s ease',
              minWidth: bar.count > 0 ? 5 : 0,
            }} />
          </div>
          <div style={{ width: 28, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, textAlign: 'right' }}>
            {bar.count}d
          </div>
          <div style={{ width: 32, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', flexShrink: 0, textAlign: 'right' }}>
            {`${Math.round((bar.count / daysWithData) * 100)}%`}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Energy distribution bars — string keys */
function EnergyDistributionBars({ stats }: { stats: EnergyStats }) {
  if (stats.daysWithData === 0) return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', padding: '8px 0' }}>
      Rate energy in Evening Journal to see distribution.
    </div>
  )

  const bars: { key: MoodEnergy; count: number; color: string }[] = [
    { key: 'charged', count: stats.distribution.charged, color: ENERGY_COLORS.charged },
    { key: 'steady',  count: stats.distribution.steady,  color: ENERGY_COLORS.steady  },
    { key: 'tired',   count: stats.distribution.tired,   color: ENERGY_COLORS.tired   },
  ]
  const max = Math.max(...bars.map(b => b.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bars.map(bar => (
        <div key={bar.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', flexShrink: 0 }}>
            {ENERGY_EMOJI[bar.key]} {ENERGY_LABELS[bar.key]}
          </div>
          <div style={{ flex: 1, height: 10, background: 'var(--paper-3)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              width: `${(bar.count / max) * 100}%`, height: '100%',
              background: bar.color, borderRadius: 5,
              transition: 'width .5s ease',
              minWidth: bar.count > 0 ? 5 : 0,
            }} />
          </div>
          <div style={{ width: 28, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, textAlign: 'right' }}>
            {bar.count}d
          </div>
          <div style={{ width: 32, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', flexShrink: 0, textAlign: 'right' }}>
            {`${Math.round((bar.count / stats.daysWithData) * 100)}%`}
          </div>
        </div>
      ))}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em', marginTop: 2 }}>
        {stats.daysWithData} entr{stats.daysWithData === 1 ? 'y' : 'ies'} in last 30 days
      </div>
    </div>
  )
}

/** Habit × Mood correlation cards */
function HabitMoodCorrelation({ data }: { data: HabitByMood[] }) {
  // Legacy 3-state display maps
  const MOOD_COLORS: Record<MoodState, string> = { charged: 'var(--accent)', steady: 'var(--ink-2)', tired: 'var(--warn)' }
  const MOOD_LABELS: Record<MoodState, string> = { charged: 'Charged', steady: 'Steady', tired: 'Tired' }
  const MOOD_EMOJI:  Record<MoodState, string> = { charged: '⚡', steady: '✦', tired: '○' }

  if (data.length === 0 || data.every(d => d.sampleDays === 0)) return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', padding: '8px 0' }}>
      Complete habits on a few more days to see correlations.
    </div>
  )

  const sorted = [...data].sort((a, b) => b.avgRate - a.avgRate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((row, i) => (
        <div key={row.mood} style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          borderLeft: `3px solid ${MOOD_COLORS[row.mood]}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 20, flexShrink: 0 }}>{MOOD_EMOJI[row.mood]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
              {MOOD_LABELS[row.mood]} days
            </div>
            <div style={{ height: 5, background: 'var(--paper-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round(row.avgRate * 100)}%`, height: '100%',
                background: MOOD_COLORS[row.mood], borderRadius: 3,
                transition: 'width .5s ease',
              }} />
            </div>
            <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              {row.sampleDays > 0
                ? `${Math.round(row.avgRate * 100)}% habit completion · ${row.sampleDays} day${row.sampleDays !== 1 ? 's' : ''}`
                : 'No data yet'}
            </div>
          </div>
          {i === 0 && row.sampleDays > 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
              color: MOOD_COLORS[row.mood], padding: '2px 7px',
              border: `1px solid ${MOOD_COLORS[row.mood]}`,
              borderRadius: 10, flexShrink: 0,
            }}>
              BEST
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Energy × Output productivity cards */
function ProductivityCorrelation({ data }: { data: ProductivityByEnergy[] }) {
  const hasData = data.some(d => d.sampleDays > 0)
  if (!hasData) return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', padding: '8px 0' }}>
      Complete tasks and rate energy on the same day to see correlations.
    </div>
  )

  // Sort by defined order: charged first (peak), then steady, tired
  const sorted = [...data].sort(
    (a, b) => ENERGY_ORDER.indexOf(a.energy) - ENERGY_ORDER.indexOf(b.energy)
  )
  const maxTasks = Math.max(...data.map(d => d.avgTasks), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((row, i) => (
        <div key={row.energy} style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          borderLeft: `3px solid ${ENERGY_COLORS[row.energy]}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>{ENERGY_EMOJI[row.energy]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {ENERGY_LABELS[row.energy]} energy days
                </div>
                {i === 0 && row.sampleDays > 0 && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                    color: ENERGY_COLORS[row.energy], padding: '2px 7px',
                    border: `1px solid ${ENERGY_COLORS[row.energy]}`,
                    borderRadius: 10, flexShrink: 0,
                  }}>
                    PEAK
                  </div>
                )}
              </div>
              <div style={{ height: 5, background: 'var(--paper-3)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  width: `${Math.min((row.avgTasks / maxTasks) * 100, 100)}%`, height: '100%',
                  background: ENERGY_COLORS[row.energy], borderRadius: 3,
                  transition: 'width .5s ease',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {row.sampleDays > 0 ? (
                  <>
                    {row.avgTasks.toFixed(1)} tasks/day
                    {!isNaN(row.avgImpact) && <> · {row.avgImpact.toFixed(1)} avg impact</>}
                    {' '}· {row.sampleDays} day{row.sampleDays !== 1 ? 's' : ''}
                  </>
                ) : 'No data yet'}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function MoodEnergyScreen() {
  const { back } = useNav()

  const [history,        setHistory]        = useState<DayMoodEnergy[]>([])
  const [moodDist,       setMoodDist]       = useState<MoodDistribution5 | null>(null)
  const [energyStats,    setEnergyStats]    = useState<EnergyStats | null>(null)
  const [productivity,   setProductivity]   = useState<ProductivityByEnergy[]>([])
  const [habitByMood,    setHabitByMood]    = useState<HabitByMood[]>([])
  const [sustainability, setSustainability] = useState<number>(NaN)
  const [loading,        setLoading]        = useState(true)
  const [sheetOpen,      setSheetOpen]      = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [h, md, es, prod, hbm, sus] = await Promise.all([
        getMoodEnergyHistory(30),
        getMoodDistribution5(30),
        getEnergyStats(30),
        getProductivityByEnergy(90),
        getHabitCompletionByMood(90),
        getSustainabilityScore(30),
      ])
      if (cancelled) return
      setHistory(h)
      setMoodDist(md)
      setEnergyStats(es)
      setProductivity(prod)
      setHabitByMood(hbm)
      setSustainability(sus)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Reload after a new entry is saved from the sheet
  function handleSheetSaved() {
    setSheetOpen(false)
    ;(async () => {
      const [h, md, es, prod, hbm, sus] = await Promise.all([
        getMoodEnergyHistory(30),
        getMoodDistribution5(30),
        getEnergyStats(30),
        getProductivityByEnergy(90),
        getHabitCompletionByMood(90),
        getSustainabilityScore(30),
      ])
      setHistory(h); setMoodDist(md); setEnergyStats(es)
      setProductivity(prod); setHabitByMood(hbm); setSustainability(sus)
    })()
  }

  // Current mood — last logged value (new 5-point preferred)
  const currentEntry = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const score = resolveScore(history[i])
      if (score) return { score, entry: moodScaleEntry(score) }
    }
    return null
  })()

  // Streak of same mood bucket (3-state bucketing for streak)
  const currentStreak = (() => {
    if (!currentEntry) return 0
    const bucket = currentEntry.score >= 4 ? 'charged' : currentEntry.score === 3 ? 'steady' : 'tired'
    let streak = 0
    for (let i = history.length - 1; i >= 0; i--) {
      const score = resolveScore(history[i])
      if (!score) continue
      const b = score >= 4 ? 'charged' : score === 3 ? 'steady' : 'tired'
      if (b === bucket) streak++
      else break
    }
    return streak
  })()

  const avgLabel  = energyStats ? avgEnergyLabel(energyStats.avg) : null
  const trendMark = energyStats ? trendArrow(energyStats.trend)   : '—'
  const trendClr  = energyStats ? trendColor(energyStats.trend)   : 'var(--ink-4)'

  return (
    <div className="screen">
      <ScreenHeader
        title="Mood & Energy"
        back={back}
        icon={<Icons.drop size={22} />}
        rightActions={
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'var(--ink-2)', cursor: 'pointer',
            }}
            aria-label="Log mood"
          >
            +
          </button>
        }
      />

      <div className="screen-scroll" style={{ padding: '0 0 48px' }}>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--rule)', borderTopColor: 'var(--ink-3)', animation: 'spin 0.6s linear infinite' }} />
          </div>
        ) : (
          <>

            {/* ── Split hero ── */}
            <div style={{ padding: '20px 22px 0', display: 'flex', gap: 16, alignItems: 'center' }}>

              {/* Left — mood state */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Mood
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontStyle: 'italic', color: currentEntry?.entry?.color ?? 'var(--ink)', lineHeight: 1.1 }}>
                  {currentEntry?.entry
                    ? <>{currentEntry.entry.glyph} <em>{currentEntry.entry.label}</em></>
                    : <em style={{ color: 'var(--ink-4)' }}>No data</em>
                  }
                </div>
                {currentEntry && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
                    {currentStreak > 1 ? `${currentStreak} days running` : 'today'}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 70, background: 'var(--rule)', flexShrink: 0 }} />

              {/* Right — sustainability ring + avg energy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <ScoreRing score={sustainability} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Energy
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.1 }}>
                    {avgLabel
                      ? <em>{avgLabel}</em>
                      : <em style={{ color: 'var(--ink-4)' }}>No data</em>
                    }
                  </div>
                  {energyStats && !isNaN(energyStats.avg) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                        {energyStats.avg.toFixed(1)}/3
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: trendClr }}>
                        {trendMark}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Combined 30-day timeline ── */}
            <div style={{ padding: '28px 22px 0' }}>
              <SectionLabel title="Last 30 days" sub="Mood (top row) · Energy (bottom row)" />
              <CombinedStrip history={history} />
            </div>

            {/* ── Distribution — side by side on wider screens, stacked on narrow ── */}
            <div style={{ padding: '28px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <SectionLabel title="Mood distribution" />
                {moodDist && <MoodDistributionBars dist={moodDist} />}
              </div>
              <div>
                <SectionLabel title="Energy distribution" />
                {energyStats && <EnergyDistributionBars stats={energyStats} />}
              </div>
            </div>

            {/* ── Habit × Mood ── */}
            <div style={{ padding: '28px 22px 0' }}>
              <SectionLabel title="Mood × Habits" sub="Habit completion rate by mood state · last 90 days" />
              <HabitMoodCorrelation data={habitByMood} />
            </div>

            {/* ── Energy × Output ── */}
            <div style={{ padding: '28px 22px 0' }}>
              <SectionLabel title="Energy × Output" sub="Task completion rate by energy level · last 90 days" />
              <ProductivityCorrelation data={productivity} />
            </div>

            {/* ── Score breakdown ── */}
            {!isNaN(sustainability) && energyStats && (
              <div style={{ padding: '28px 22px 0' }}>
                <SectionLabel title="Sustainability score" sub="What drives your score" />
                <div style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {([
                    { label: 'Evening energy',      weight: '50%', value: `avg ${isNaN(energyStats.avg) ? '—' : energyStats.avg.toFixed(1)}/3.0` },
                    { label: 'Journal consistency', weight: '30%', value: `${history.filter(d => d.hadEveningJournal).length}/${history.length} days` },
                    { label: 'Mood resilience',     weight: '20%', value: 'low-mood days' },
                  ] as const).map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                        {row.label}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                        {row.value}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                        color: 'var(--ink-4)', padding: '1px 5px',
                        border: '1px solid var(--rule)', borderRadius: 6, flexShrink: 0,
                      }}>
                        {row.weight}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Capture reminder ── */}
            <div style={{ padding: '24px 22px 0' }}>
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--paper-2)', border: '1px solid var(--rule)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <Icons.journal size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--ink-3)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
                    Build richer data
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.55, letterSpacing: '0.02em' }}>
                    Tap <strong>+</strong> above to log mood any time.{' '}
                    Morning & evening journals capture full context.{' '}
                    30 days of data unlocks trend analysis and full sustainability scoring.
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      {/* Standalone mood entry sheet */}
      {sheetOpen && (
        <MoodEntrySheet
          onClose={() => setSheetOpen(false)}
          onSaved={handleSheetSaved}
        />
      )}
    </div>
  )
}
