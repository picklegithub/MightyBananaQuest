/**
 * HabitHeatmap — 12-week rolling calendar grid showing habit completion history.
 *
 * Renders a 7 × 12 grid (cols = days of week, rows = weeks, most-recent at right).
 * Each cell is coloured by whether the habitLog has an entry for that day.
 */
import React, { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { useIsDark } from '../lib/colorMode'
import { areaColor } from '../lib/areaColor'

interface Props {
  habitId: string
  hue: number       // area hue for the "completed" cell colour
}

const WEEKS = 12
const DAYS  = 7

function isoDate(d: Date): string {
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dd}`
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function HabitHeatmap({ habitId, hue }: Props) {
  const isDark = useIsDark()
  // Build the 84-day date grid (Mon-anchored, most-recent week at right)
  const cells = useMemo(() => {
    const today   = new Date(); today.setHours(0, 0, 0, 0)
    // Snap to the most recent Sunday so the grid ends at a complete week
    const endDate = new Date(today)
    // Advance to the end of this week (Sunday)
    const dow = today.getDay() // 0=Sun…6=Sat
    endDate.setDate(today.getDate() + (dow === 0 ? 0 : 7 - dow))

    const grid: string[][] = []  // [week][day] ISO strings; week 0 = oldest
    for (let w = WEEKS - 1; w >= 0; w--) {
      const week: string[] = []
      for (let d = 0; d < DAYS; d++) {
        const cell = new Date(endDate)
        cell.setDate(endDate.getDate() - w * 7 - (DAYS - 1 - d))
        week.push(isoDate(cell))
      }
      grid.push(week)
    }
    return grid  // [WEEKS][DAYS]
  }, [])

  const logs = useLiveQuery(
    () => db.habitLog.where('taskId').equals(habitId).toArray(),
    [habitId]
  )

  const loggedSet = useMemo(() => {
    const s = new Set<string>()
    logs?.forEach(l => s.add(l.date))
    return s
  }, [logs])

  const todayISO = isoDate(new Date())

  const completedColor  = areaColor(hue, 'fg', isDark)
  const completedBg     = areaColor(hue, 'bg', isDark)
  const todayBorder     = areaColor(hue, 'fg', isDark)

  // Month labels: show month name at the first cell of each month
  const monthLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    cells.forEach(week => {
      week.forEach(iso => {
        const d = new Date(iso + 'T00:00:00')
        if (d.getDate() <= 7) {
          const key = `${iso.slice(0,7)}`  // YYYY-MM
          if (!labels[iso]) {
            labels[iso] = d.toLocaleDateString('en-AU', { month: 'short' })
          }
        }
      })
    })
    return labels
  }, [cells])

  if (!logs) return null

  return (
    <div style={{ padding: '10px 14px 14px', overflow: 'hidden' }}>
      {/* Grid: cols = weeks, rows = day-of-week */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>

        {/* Day-of-week labels (left axis) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 14, flexShrink: 0 }}>
          {DAY_LABELS.map((l, i) => (
            <div key={i} style={{
              width: 10, height: 10,
              fontFamily: 'var(--font-mono)', fontSize: 7,
              color: 'var(--ink-4)', letterSpacing: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: i % 2 === 0 ? 1 : 0,  // only show alternate labels to avoid crowding
            }}>
              {l}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', flex: 1 }}>
          {cells.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              {/* Month label row */}
              <div style={{
                height: 10,
                fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--ink-4)',
                letterSpacing: 0,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                {/* Show month label if first day of week has a new month */}
                {monthLabels[week[0]] ?? ''}
              </div>

              {/* Day cells */}
              {week.map((iso, di) => {
                const completed = loggedSet.has(iso)
                const isToday   = iso === todayISO
                const isFuture  = iso > todayISO
                return (
                  <div
                    key={di}
                    title={iso + (completed ? ' ✓' : '')}
                    style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: isFuture
                        ? 'transparent'
                        : completed
                          ? completedBg
                          : 'var(--paper-2)',
                      border: isToday
                        ? `1.5px solid ${todayBorder}`
                        : completed
                          ? `1px solid ${completedColor}33`
                          : '1px solid var(--rule)',
                      opacity: isFuture ? 0.2 : 1,
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)',
        letterSpacing: '0.04em',
      }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--paper-2)', border: '1px solid var(--rule)' }} />
        Missed
        <div style={{ width: 10, height: 10, borderRadius: 2, background: completedBg, border: `1px solid ${completedColor}33`, marginLeft: 4 }} />
        Done
        <span style={{ marginLeft: 'auto' }}>
          {loggedSet.size} check-in{loggedSet.size !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
