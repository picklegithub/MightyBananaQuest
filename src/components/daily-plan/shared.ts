import { localDateISO } from '../../lib/useCurrentDate'
import { todayISO } from '../../data/db'

/** ISO date regex: YYYY-MM-DD */
export const isoRe = /^\d{4}-\d{2}-\d{2}$/

export function tomorrowISO(): string {
  const d = new Date(todayISO() + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return localDateISO(d)
}
