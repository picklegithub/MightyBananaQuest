import React, { useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useIsDark } from '../../lib/colorMode'
import { areaColor } from '../../lib/areaColor'
import { db, todayISO } from '../../data/db'
import { Icons } from '../ui/Icons'

interface CalBlock {
  startH: number
  endH:   number
  title:  string
  hue:    number
}

function parseTimeH(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m ?? 0) / 60
}

function fmtH(h: number): string {
  const intH = Math.floor(h)
  const mins  = Math.round((h - intH) * 60)
  const ap    = intH < 12 ? 'a' : 'p'
  const disp  = intH <= 12 ? intH : intH - 12
  return mins ? `${disp}:${String(mins).padStart(2, '0')}${ap}` : `${disp}${ap}`
}

interface Props {
  onBudgetChange: (min: number) => void
}

export function DPRStep2Calendar({ onBudgetChange }: Props) {
  const isDark = useIsDark()
  const today  = todayISO()

  const timedTasks = useLiveQuery(async () => {
    return db.tasks.filter(t =>
      !!t.time && !t.done &&
      (t.due === 'Today' || t.due === today)
    ).toArray()
  }, [today]) ?? []

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catHue = (catId: string | undefined) => categories?.find(c => c.id === catId)?.hue ?? 200

  const blocks: CalBlock[] = useMemo(() => {
    return timedTasks
      .filter(t => t.time && /^\d{2}:\d{2}$/.test(t.time))
      .map(t => {
        const startH = parseTimeH(t.time!)
        const durMap: Record<string, number> = { xs: 0.25, s: 0.25, m: 1, l: 2, xl: 4, xxl: 8 }
        const dur = durMap[t.effort] ?? 1
        return { startH, endH: startH + dur, title: t.title, hue: catHue(t.cat) }
      })
      .sort((a, b) => a.startH - b.startH)
  }, [timedTasks, categories])

  const DAY_START = 8
  const DAY_END   = 19
  const TOTAL_MIN = (DAY_END - DAY_START) * 60

  const gaps = useMemo(() => {
    const result: Array<{ startH: number; endH: number }> = []
    let cursor = DAY_START
    for (const b of blocks) {
      const bs = Math.max(DAY_START, b.startH)
      if (bs > cursor + 0.25) result.push({ startH: cursor, endH: bs })
      cursor = Math.max(cursor, b.endH)
    }
    if (cursor < DAY_END) result.push({ startH: cursor, endH: DAY_END })
    return result
  }, [blocks])

  const busyMin = useMemo(() =>
    blocks.reduce((s, b) => s + Math.max(0, b.endH - b.startH) * 60, 0)
  , [blocks])

  const freeMin = Math.max(0, TOTAL_MIN - busyMin)
  const freeHH  = Math.floor(freeMin / 60)
  const freeMM  = freeMin % 60

  useEffect(() => { onBudgetChange(freeMin) }, [freeMin, onBudgetChange])

  const pct = (h: number) => ((h - DAY_START) / (DAY_END - DAY_START)) * 100
  const TIMELINE_H = 260

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div className="t-display" style={{ fontSize: 30, lineHeight: 1.1 }}>Today's runway</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
          {blocks.length > 0
            ? `${blocks.length} block${blocks.length === 1 ? '' : 's'} taking up your day.`
            : 'No time-blocked tasks found — showing your full day as free.'}
        </div>
      </div>

      <div style={{
        margin: '0 0 16px', padding: '14px 16px', borderRadius: 14,
        background: 'var(--paper-2)', border: '1px solid var(--rule)',
      }}>
        <div className="eyebrow">FREE TIME TODAY</div>
        <div className="t-display" style={{ fontSize: 42, marginTop: 4, color: 'var(--accent)' }}>
          {freeHH}h{freeMM > 0 ? ` ${freeMM}m` : ''}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginTop: 2 }}>
          across {gaps.length} gap{gaps.length === 1 ? '' : 's'} · {DAY_START}am–{DAY_END - 12}pm window
        </div>
      </div>

      <div style={{ position: 'relative', height: TIMELINE_H, paddingLeft: 36, marginBottom: 16 }}>
        {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
          const h   = DAY_START + i
          const top = (i / (DAY_END - DAY_START)) * TIMELINE_H
          return (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0, top,
              borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
              pointerEvents: 'none',
            }}>
              <span style={{
                position: 'absolute', left: -30, top: -7,
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--ink-3)', letterSpacing: '0.04em',
              }}>
                {h <= 12 ? h : h - 12}{h < 12 ? 'a' : 'p'}
              </span>
            </div>
          )
        })}

        {gaps.map((g, i) => (
          <div key={`g${i}`} style={{
            position: 'absolute', left: 0, right: 8,
            top:    `${pct(g.startH)}%`,
            height: `${pct(g.endH) - pct(g.startH)}%`,
            background: 'var(--accent-soft)', opacity: 0.45,
            borderLeft: '2px solid var(--accent)',
          }}>
            {(g.endH - g.startH) >= 0.5 && (
              <span style={{
                position: 'absolute', left: 6, top: 4,
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--accent)', letterSpacing: '0.04em', fontWeight: 600,
              }}>
                {Math.floor(g.endH - g.startH)}h
                {((g.endH - g.startH) % 1) ? `${Math.round(((g.endH - g.startH) % 1) * 60)}m` : ''}
                {' '}free
              </span>
            )}
          </div>
        ))}

        {blocks.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: 6, right: 8,
            top:    `${pct(b.startH)}%`,
            height: `${Math.max(pct(b.endH) - pct(b.startH), 2)}%`,
            background: areaColor(b.hue, 'bg', isDark),
            borderLeft: `3px solid ${areaColor(b.hue, 'fg', isDark)}`,
            borderRadius: '3px 8px 8px 3px', padding: '3px 7px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: areaColor(b.hue, 'fg', isDark), lineHeight: 1.2 }}>
              {b.title.length > 28 ? b.title.slice(0, 28) + '…' : b.title}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: areaColor(b.hue, 'fg', isDark), marginTop: 1 }}>
              {fmtH(b.startH)} – {fmtH(b.endH)}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '11px 14px', borderRadius: 10,
        background: 'var(--paper-2)', border: '1px dashed var(--rule)',
        fontSize: 11, color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
      }}>
        <Icons.calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        Set a time on any task to block it here · Google Calendar coming soon
      </div>
    </div>
  )
}
