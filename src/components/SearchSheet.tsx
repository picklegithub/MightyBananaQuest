/**
 * SearchSheet — slide-up universal search across tasks, habits, and journal.
 *
 * Triggered from a search icon in the dashboard header or bottom nav.
 * Renders as a bottom-sheet overlay over the current screen.
 */
import React, { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from './ui/Icons'
import { DEFAULT_CATEGORIES } from '../constants'
import type { Screen, Task, Habit, JournalEntry } from '../types'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props {
  onClose: () => void
  navigate: (s: Screen) => void
}

// ── Result types ──────────────────────────────────────────────────────────────
interface SearchResults {
  tasks:   Task[]
  habits:  Habit[]
  journal: JournalEntry[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function journalPreview(e: JournalEntry): string {
  return (
    e.intention   ||
    e.win         ||
    e.gratitude?.find(Boolean) ||
    e.priorities?.find(Boolean) ||
    e.notes       ||
    ''
  )
}

function isoToShort(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

// ── Search sheet ──────────────────────────────────────────────────────────────
export function SearchSheet({ onClose, navigate }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES

  const results = useLiveQuery<SearchResults>(async () => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return { tasks: [], habits: [], journal: [] }

    const [tasks, habits, journal] = await Promise.all([
      db.tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q)
      ).limit(8).toArray(),
      db.habits.filter(h =>
        h.title.toLowerCase().includes(q) ||
        (h.notes ?? '').toLowerCase().includes(q)
      ).limit(6).toArray(),
      db.journal.filter(e =>
        JSON.stringify(e).toLowerCase().includes(q)
      ).reverse().limit(6).toArray(),
    ])
    return { tasks, habits, journal }
  }, [query]) ?? { tasks: [], habits: [], journal: [] }

  const total = results.tasks.length + results.habits.length + results.journal.length
  const hasResults = total > 0
  const hasQuery   = query.trim().length >= 2

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function catHue(catId: string | undefined): number {
    return cats.find(c => c.id === catId)?.hue ?? 220
  }

  function handleTaskTap(task: Task) {
    onClose()
    navigate({ name: 'task', taskId: task.id })
  }

  function handleHabitTap() {
    onClose()
    navigate({ name: 'all-habits' })
  }

  function handleJournalTap() {
    onClose()
    navigate({ name: 'journal', phase: 'history' })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 300,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--paper)',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        zIndex: 301,
        display: 'flex', flexDirection: 'column',
        maxHeight: '85dvh',
        overflow: 'hidden',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--rule)', margin: '12px auto 0',
          flexShrink: 0,
        }} />

        {/* Search input */}
        <div style={{
          padding: '12px 16px 10px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--rule)',
          flexShrink: 0,
        }}>
          <Icons.search size={18} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, habits, journal…"
            style={{
              flex: 1, fontSize: 16, background: 'transparent',
              color: 'var(--ink)', border: 'none', outline: 'none',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--ink-4)', padding: 4 }}>
              <Icons.close size={16} />
            </button>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 env(safe-area-inset-bottom)' }}>
          {!hasQuery && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-4)' }}>
              <Icons.search size={32} style={{ display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                Type to search across everything
              </div>
            </div>
          )}

          {hasQuery && !hasResults && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-4)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                No results for "{query.trim()}"
              </div>
            </div>
          )}

          {/* Tasks */}
          {results.tasks.length > 0 && (
            <ResultGroup label="Tasks" count={results.tasks.length}>
              {results.tasks.map(task => {
                const hue = catHue(task.cat)
                return (
                  <ResultRow
                    key={task.id}
                    icon={<Icons.check size={13} sw={2} />}
                    hue={hue}
                    title={task.title}
                    sub={task.notes?.slice(0, 60) || task.due || ''}
                    done={task.done}
                    badge="Task"
                    onTap={() => handleTaskTap(task)}
                  />
                )
              })}
            </ResultGroup>
          )}

          {/* Habits */}
          {results.habits.length > 0 && (
            <ResultGroup label="Habits" count={results.habits.length}>
              {results.habits.map(habit => {
                const hue = catHue(habit.cat)
                return (
                  <ResultRow
                    key={habit.id}
                    icon={<Icons.flame size={13} />}
                    hue={hue}
                    title={habit.title}
                    sub={habit.frequency}
                    badge="Habit"
                    onTap={handleHabitTap}
                  />
                )
              })}
            </ResultGroup>
          )}

          {/* Journal */}
          {results.journal.length > 0 && (
            <ResultGroup label="Journal" count={results.journal.length}>
              {results.journal.map(entry => (
                <ResultRow
                  key={entry.id}
                  icon={<Icons.journal size={13} />}
                  hue={260}
                  title={isoToShort(entry.date)}
                  sub={journalPreview(entry).slice(0, 60)}
                  badge={entry.kind === 'morning' ? '☀️ AM' : '🌙 PM'}
                  onTap={handleJournalTap}
                />
              ))}
            </ResultGroup>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ResultGroup({
  label, count, children
}: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        padding: '8px 18px 4px',
        fontFamily: 'var(--font-mono)', fontSize: 9,
        letterSpacing: '0.1em', color: 'var(--ink-4)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {label.toUpperCase()}
        <span style={{
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          borderRadius: 10, padding: '1px 6px', fontSize: 9,
        }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

function ResultRow({
  icon, hue, title, sub, badge, done, onTap
}: {
  icon: React.ReactNode
  hue: number
  title: string
  sub?: string
  badge: string
  done?: boolean
  onTap: () => void
}) {
  const isDark = useIsDark()
  const color = areaColor(hue, 'fg', isDark)
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%', padding: '10px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        textAlign: 'left',
        borderBottom: '1px solid var(--rule)',
        opacity: done ? 0.5 : 1,
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: areaColor(hue, 'bg', isDark),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        {sub && (
          <div style={{
            fontSize: 11, color: 'var(--ink-4)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {sub}
          </div>
        )}
      </div>

      {/* Badge */}
      <span style={{
        flexShrink: 0, padding: '2px 7px', borderRadius: 10,
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.05em',
        background: areaColor(hue, 'bg', isDark), color,
      }}>
        {badge}
      </span>

      <Icons.arrow size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
    </button>
  )
}
