/**
 * constants.ts — all static data for the mood tracker:
 * mood scale, energy options, influence tags, emotion groups.
 */

import type { MoodScore, MoodEnergy } from '../../types'

// ── 5-point mood scale ────────────────────────────────────────────────────────

export interface MoodScaleDef {
  score:    MoodScore
  glyph:    string
  label:    string
  sublabel: string
  color:    string   // CSS color expression (var(--…) or color-mix)
}

export const MOOD_SCALE: MoodScaleDef[] = [
  { score: 1, glyph: '·',  label: 'Rough', sublabel: 'Hard day, need some care',     color: 'var(--warn)' },
  { score: 2, glyph: '◌',  label: 'Low',   sublabel: 'Struggling a little',          color: 'color-mix(in oklch, var(--warn) 60%, var(--ink-2))' },
  { score: 3, glyph: '○',  label: 'Okay',  sublabel: 'Neither here nor there',        color: 'var(--ink-2)' },
  { score: 4, glyph: '◎',  label: 'Good',  sublabel: 'Solid, things feel manageable', color: 'color-mix(in oklch, var(--accent) 70%, var(--ink-2))' },
  { score: 5, glyph: '◉',  label: 'Great', sublabel: 'Energised, on top of things',  color: 'var(--accent)' },
]

export const MOOD_BY_SCORE: Record<MoodScore, MoodScaleDef> = Object.fromEntries(
  MOOD_SCALE.map(m => [m.score, m])
) as Record<MoodScore, MoodScaleDef>

/** Map 5-point score → legacy 3-state for DailyPlan / JournalEntry backward compat. */
export function moodScoreToState(score: MoodScore): 'tired' | 'steady' | 'charged' {
  if (score <= 2) return 'tired'
  if (score === 3) return 'steady'
  return 'charged'
}

/** Map legacy 3-state → approximate 5-point score. */
export function moodStateToScore(state: 'tired' | 'steady' | 'charged'): MoodScore {
  if (state === 'tired')   return 2
  if (state === 'steady')  return 3
  return 4
}

// ── Energy ────────────────────────────────────────────────────────────────────

export interface EnergyDef {
  value:  MoodEnergy
  glyph:  string
  label:  string
  color:  string
}

export const ENERGY_OPTIONS: EnergyDef[] = [
  { value: 'tired',   glyph: '○',  label: 'Tired',   color: 'var(--warn)' },
  { value: 'steady',  glyph: '✦',  label: 'Steady',  color: 'var(--ink-2)' },
  { value: 'charged', glyph: '⚡', label: 'Charged', color: 'var(--accent)' },
]

export const ENERGY_BY_VALUE: Record<MoodEnergy, EnergyDef> = Object.fromEntries(
  ENERGY_OPTIONS.map(e => [e.value, e])
) as Record<MoodEnergy, EnergyDef>

/** Map energy string → legacy numeric (1|2|3) for JournalEntry.energy backward compat. */
export function energyToLegacyNum(e: MoodEnergy): 1 | 2 | 3 {
  if (e === 'tired')   return 1
  if (e === 'steady')  return 2
  return 3
}

// ── Influence tags ────────────────────────────────────────────────────────────

export interface InfluenceTag {
  id:    string
  label: string
  emoji: string
}

export interface InfluenceGroup {
  group: string
  tags:  InfluenceTag[]
}

export const INFLUENCE_GROUPS: InfluenceGroup[] = [
  {
    group: 'Sleep',
    tags: [
      { id: 'slept-well',       label: 'Slept well',     emoji: '😴' },
      { id: 'poor-sleep',       label: 'Poor sleep',     emoji: '🌙' },
      { id: 'no-sleep',         label: 'No sleep',       emoji: '☁️' },
    ],
  },
  {
    group: 'Body',
    tags: [
      { id: 'exercise',         label: 'Exercise',       emoji: '🏃' },
      { id: 'healthy-eating',   label: 'Healthy eating', emoji: '🥗' },
      { id: 'junk-food',        label: 'Junk food',      emoji: '🍕' },
      { id: 'desserts',         label: 'Desserts',       emoji: '🍩' },
      { id: 'sick',             label: 'Feeling sick',   emoji: '🤒' },
    ],
  },
  {
    group: 'Stimulants',
    tags: [
      { id: 'caffeine',         label: 'Caffeine',       emoji: '☕' },
      { id: 'alcohol',          label: 'Alcohol',        emoji: '🍷' },
      { id: 'alcohol-free',     label: 'Alcohol free',   emoji: '🚫' },
    ],
  },
  {
    group: 'Work',
    tags: [
      { id: 'productive',       label: 'Productive',     emoji: '✅' },
      { id: 'work-stress',      label: 'Work stress',    emoji: '💼' },
      { id: 'big-win',          label: 'Big win',        emoji: '🎯' },
      { id: 'deadline',         label: 'Deadline',       emoji: '⏰' },
    ],
  },
  {
    group: 'Social',
    tags: [
      { id: 'social-time',      label: 'Social time',    emoji: '👥' },
      { id: 'alone-time',       label: 'Alone time',     emoji: '🌿' },
      { id: 'quality-time',     label: 'Quality time',   emoji: '❤️' },
      { id: 'conflict',         label: 'Conflict',       emoji: '⚡' },
    ],
  },
  {
    group: 'Mind',
    tags: [
      { id: 'journaled',        label: 'Journaled',      emoji: '📓' },
      { id: 'meditated',        label: 'Meditated',      emoji: '🧘' },
      { id: 'outside',          label: 'Outside time',   emoji: '🌳' },
      { id: 'screen-heavy',     label: 'Screen-heavy',   emoji: '📱' },
    ],
  },
]

/** All tags flattened — for O(1) label lookup. */
export const INFLUENCE_BY_ID: Record<string, InfluenceTag> = Object.fromEntries(
  INFLUENCE_GROUPS.flatMap(g => g.tags).map(t => [t.id, t])
)

// ── Emotion groups (feelings wheel — simplified) ──────────────────────────────

export interface EmotionGroup {
  tone:     'positive' | 'neutral' | 'difficult'
  label:    string
  color:    string
  emotions: string[]
}

export const EMOTION_GROUPS: EmotionGroup[] = [
  {
    tone:     'positive',
    label:    'Positive',
    color:    'var(--accent)',
    emotions: ['Joyful', 'Grateful', 'Calm', 'Hopeful', 'Proud', 'Excited', 'Loved', 'Content'],
  },
  {
    tone:     'neutral',
    label:    'Neutral',
    color:    'var(--ink-2)',
    emotions: ['Curious', 'Reflective', 'Focused', 'Nostalgic', 'Ambivalent'],
  },
  {
    tone:     'difficult',
    label:    'Difficult',
    color:    'var(--warn)',
    emotions: ['Anxious', 'Sad', 'Frustrated', 'Tired', 'Overwhelmed', 'Irritable', 'Lonely', 'Numb'],
  },
]

/** Lowercase id → display label */
export const EMOTION_LABEL: Record<string, string> = Object.fromEntries(
  EMOTION_GROUPS.flatMap(g => g.emotions).map(e => [e.toLowerCase(), e])
)

/** Lowercase id → group color */
export const EMOTION_COLOR: Record<string, string> = Object.fromEntries(
  EMOTION_GROUPS.flatMap(g => g.emotions.map(e => [e.toLowerCase(), g.color]))
)
