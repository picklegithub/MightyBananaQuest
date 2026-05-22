import React, { useState } from 'react'
import { deleteJournalEntry } from '../../data/db'
import { Icons } from '../ui/Icons'
import type { JournalEntry } from '../../types'
import { isoToDisplay } from './shared'

function HistoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
      {children}
    </div>
  )
}

function HistoryItem({ children, index, mono }: { children: React.ReactNode; index: number; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, lineHeight: 1.5 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', paddingTop: 2, flexShrink: 0 }}>{index}</span>
      <span style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)', fontStyle: mono ? 'normal' : 'italic' }}>
        {children}
      </span>
    </div>
  )
}

interface Props { entries: JournalEntry[] }

export function HistoryView({ entries }: Props) {
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function handleDelete(entryId: string) {
    if (confirmDelete === entryId) {
      await deleteJournalEntry(entryId)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(entryId)
      setTimeout(() => setConfirmDelete(c => c === entryId ? null : c), 3000)
    }
  }

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Icons.journal size={36} style={{ color: 'var(--ink-4)', display: 'block', margin: '0 auto 16px' }} />
        <div className="t-display" style={{ fontSize: 20, marginBottom: 6 }}>Nothing yet</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>
          Your reflections will appear here<br />after your first entry.
        </div>
      </div>
    )
  }

  const byDate = entries.reduce<Record<string, JournalEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e); return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort().reverse()

  function toggle(date: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sortedDates.map(date => {
        const morning = byDate[date].find(e => e.kind === 'morning')
        const evening = byDate[date].find(e => e.kind === 'evening')
        const isOpen  = expanded.has(date)

        return (
          <div key={date} style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, overflow: 'hidden' }}>
            <button onClick={() => toggle(date)}
              style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isOpen ? '1px solid var(--rule)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span className="t-display" style={{ fontSize: 15, flexShrink: 0 }}>
                  {/^\d{4}-\d{2}-\d{2}$/.test(date) ? isoToDisplay(date) : date}
                </span>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {morning && <span style={{ padding: '2px 7px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', background: 'oklch(0.96 0.04 85)', color: 'oklch(0.52 0.12 75)' }}>☀️ AM</span>}
                  {evening && <span style={{ padding: '2px 7px', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', background: 'oklch(0.95 0.02 270)', color: 'oklch(0.45 0.09 270)' }}>🌙 PM</span>}
                </div>
                {!isOpen && (morning?.intention || evening?.win) && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--font-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {morning?.intention || evening?.win}
                  </span>
                )}
              </div>
              <Icons.arrow size={14} style={{ color: 'var(--ink-4)', flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {isOpen && (
              <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {morning && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'oklch(0.52 0.12 75)' }}>☀️ MORNING</div>
                      <button onClick={() => handleDelete(morning.id)}
                        style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, border: `1px solid ${confirmDelete === morning.id ? 'var(--danger, #e53)' : 'var(--rule)'}`, background: confirmDelete === morning.id ? 'oklch(0.97 0.03 25)' : 'transparent', color: confirmDelete === morning.id ? 'var(--danger, #e53)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)', transition: 'all .15s' }}>
                        {confirmDelete === morning.id ? 'Tap again to delete' : '⌫'}
                      </button>
                    </div>
                    {morning.intention && <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.5, marginBottom: 12 }}>"{morning.intention}"</div>}
                    {(morning.gratitude?.filter(Boolean).length ?? 0) > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <HistoryLabel>Grateful for</HistoryLabel>
                        {morning.gratitude!.filter(Boolean).map((g, i) => <HistoryItem key={i} index={i + 1}>{g}</HistoryItem>)}
                      </div>
                    )}
                    {(morning.priorities?.filter(Boolean).length ?? 0) > 0 && (
                      <div>
                        <HistoryLabel>Priorities</HistoryLabel>
                        {morning.priorities!.filter(Boolean).map((p, i) => <HistoryItem key={i} index={i + 1} mono>{p}</HistoryItem>)}
                      </div>
                    )}
                    {morning.notes && <div style={{ marginTop: 10 }}><HistoryLabel>Notes</HistoryLabel><div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{morning.notes}</div></div>}
                  </div>
                )}

                {morning && evening && <div style={{ height: 1, background: 'var(--rule)' }} />}

                {evening && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'oklch(0.45 0.09 270)' }}>🌙 EVENING</div>
                      <button onClick={() => handleDelete(evening.id)}
                        style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, border: `1px solid ${confirmDelete === evening.id ? 'var(--danger, #e53)' : 'var(--rule)'}`, background: confirmDelete === evening.id ? 'oklch(0.97 0.03 25)' : 'transparent', color: confirmDelete === evening.id ? 'var(--danger, #e53)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)', transition: 'all .15s' }}>
                        {confirmDelete === evening.id ? 'Tap again to delete' : '⌫'}
                      </button>
                    </div>
                    {(evening.energy || evening.impact) && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        {evening.energy && <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--paper-3)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{['', '😴 Low', '😐 Okay', '⚡ Strong'][evening.energy]} energy</span>}
                        {evening.impact && <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--paper-3)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{['', '💤 Minimal', '🔹 Some', '🔷 Solid', '🌟 High'][evening.impact]} impact</span>}
                      </div>
                    )}
                    {[
                      { label: 'Win',                  value: evening.win },
                      { label: 'Would do differently', value: evening.diff },
                      { label: 'Lesson',               value: evening.lesson },
                      { label: 'Tomorrow',             value: evening.tomorrow },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} style={{ marginBottom: 10 }}>
                        <HistoryLabel>{f.label}</HistoryLabel>
                        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>{f.value}</div>
                      </div>
                    ))}
                    {evening.notes && <div style={{ marginTop: 2 }}><HistoryLabel>Notes</HistoryLabel><div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{evening.notes}</div></div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
