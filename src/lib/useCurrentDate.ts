import { useState, useEffect } from 'react'

/**
 * Returns the local calendar date as 'YYYY-MM-DD'.
 * Use this instead of `new Date().toISOString().slice(0, 10)` which returns
 * the UTC date and breaks for timezones ahead of or behind UTC at night.
 */
export function localDateISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function buildParts() {
  const d    = new Date()
  const day  = DAYS[d.getDay()]
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  return { day, date, dateStr: `${day} · ${date}` }
}

function msUntilMidnight(): number {
  const now = new Date()
  return (
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    - now.getTime()
    + 500   // small buffer so the tick fires just after midnight
  )
}

/**
 * Returns { day, date, dateStr } and re-evaluates automatically at midnight.
 * Replaces all module-level SCREEN_DATE / DAY / DATE constants that were
 * stale when the app was left open across midnight.
 */
export function useCurrentDate() {
  const [parts, setParts] = useState(buildParts)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    function schedule() {
      t = setTimeout(() => { setParts(buildParts()); schedule() }, msUntilMidnight())
    }
    schedule()
    return () => clearTimeout(t)
  }, [])

  return parts
}
