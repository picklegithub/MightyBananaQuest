import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { EFFORT } from '../constants'
import type { Screen } from '../types'

interface Props {
  taskId: string
  navigate: (s: Screen) => void
  back: () => void
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const RECURRENCE_OPTIONS = [
  { v: null,            l: 'One-off' },
  { v: 'Daily',         l: 'Daily' },
  { v: 'Weekdays',      l: 'Weekdays' },
  { v: 'Weekly',        l: 'Weekly' },
  { v: 'Every 2 weeks', l: 'Bi-weekly' },
  { v: 'Monthly',       l: 'Monthly' },
  { v: 'Quarterly',     l: 'Quarterly' },
  { v: 'Yearly',        l: 'Yearly' },
  { v: '3x/week',       l: '3× / week' },
  { v: 'custom',        l: 'Custom…' },
]

function buildQuickDays(): string[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()
  const chips: string[] = ['Today', 'Tomorrow']
  for (let i = 2; i <= 6; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    chips.push(names[d.getDay()])
  }
  chips.push('Next week', 'Someday')
  return chips
}

export const ScheduleScreen = ({ taskId, back }: Props) => {
  const task     = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const settings = useLiveQuery(() => db.settings.get(1), [])

  const [due,       setDue]       = useState(task?.due ?? 'Today')
  const [time,      setTime]      = useState<string>(task?.time ?? '')
  const [recurring, setRecurring] = useState<string | null>(task?.recurring ?? null)
  const [pomMins,   setPomMins]   = useState(task?.pomodoroMins ?? settings?.defaultPomodoroMins ?? 25)
  const [saved,     setSaved]     = useState(false)

  // Sync state when task first loads from Dexie (useLiveQuery is async)
  const didInit = useRef(false)
  useEffect(() => {
    if (task && !didInit.current) {
      didInit.current = true
      setDue(task.due ?? 'Today')
      setTime(task.time ?? '')
      setRecurring(task.recurring ?? null)
      setPomMins(task.pomodoroMins ?? settings?.defaultPomodoroMins ?? 25)
    }
  }, [task, settings])

  // Calendar state
  const now = useMemo(() => new Date(), [])
  const [calYear,  setCalYear]  = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calDay,   setCalDay]   = useState<number | null>(null)

  // Custom recurrence
  const [isCustom,  setIsCustom]  = useState(false)
  const [custEvery, setCustEvery] = useState(2)
  const [custUnit,  setCustUnit]  = useState<'days' | 'weeks' | 'months' | 'years'>('weeks')
  const [custDays,  setCustDays]  = useState<number[]>([0, 2]) // Mon, Wed
  const [custEnds,  setCustEnds]  = useState<'never' | 'after' | 'date'>('never')

  const quickDays = useMemo(buildQuickDays, [])

  const calCells = useMemo(() => {
    const firstDay   = new Date(calYear, calMonth, 1).getDay()
    const offset     = (firstDay + 6) % 7 // Mon=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    return Array.from({ length: 42 }, (_, i) => {
      const d = i - offset + 1
      return d >= 1 && d <= daysInMonth ? d : null
    })
  }, [calYear, calMonth])

  const todayDay = now.getFullYear() === calYear && now.getMonth() === calMonth ? now.getDate() : -1

  function selectCalDay(d: number) {
    setCalDay(d)
    const date  = new Date(calYear, calMonth, d)
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diff  = Math.round((date.getTime() - today0.getTime()) / 86400000)
    if (diff === 0) { setDue('Today'); return }
    if (diff === 1) { setDue('Tomorrow'); return }
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    setDue(diff <= 6 ? dayNames[date.getDay()] : `${months[date.getMonth()]} ${d}`)
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  function handleRecurrence(v: string | null) {
    if (v === 'custom') { setIsCustom(true); setRecurring(null) }
    else { setIsCustom(false); setRecurring(v) }
  }

  function toggleCustDay(i: number) {
    setCustDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort())
  }

  async function handleSave() {
    const finalRec = isCustom ? `Every ${custEvery} ${custUnit}` : recurring
    await db.tasks.update(taskId, {
      due,
      time: time || undefined,
      recurring: finalRec,
      pomodoroMins: pomMins,
    })
    setSaved(true)
    setTimeout(back, 800)
  }

  if (!task) return null
  const e = EFFORT[task.effort]

  return (
    <div className="screen">
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', flexShrink: 0,
      }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', fontSize: 13 }}>Cancel</button>
        <div className="eyebrow" style={{ letterSpacing: '0.14em' }}>SCHEDULE</div>
        <button
          onClick={handleSave}
          style={{ fontSize: 13, fontWeight: 600, color: saved ? 'var(--ink-3)' : 'var(--accent)' }}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="screen-scroll" style={{ padding: '0 22px 48px' }}>

        {/* ── Title ── */}
        <div className="eyebrow" style={{ marginBottom: 6 }}>Schedule</div>
        <div className="t-display" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 24 }}>
          When will{' '}
          <em>"{task.title.length > 28 ? task.title.slice(0, 28) + '…' : task.title}"</em>{' '}
          happen?
        </div>

        {/* ── Mini calendar ── */}
        <div style={{
          padding: 16, borderRadius: 14,
          background: 'var(--paper-2)', border: '1px solid var(--rule)',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="t-display" style={{ fontSize: 16 }}>
              {MONTH_NAMES[calMonth]} {calYear}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={prevMonth} style={{ color: 'var(--ink-3)', padding: 4 }}>
                <Icons.back size={14} />
              </button>
              <button onClick={nextMonth} style={{ color: 'var(--ink-3)', padding: 4 }}>
                <Icons.arrow size={14} />
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
            marginBottom: 4, textAlign: 'center',
          }}>
            {DAY_LABELS.map((d, i) => <div key={i} style={{ padding: '4px 0' }}>{d}</div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {calCells.map((d, i) => {
              const isToday = d === todayDay
              const isSel   = d !== null && calDay === d
              return (
                <button
                  key={i} disabled={!d}
                  onClick={() => d && selectCalDay(d)}
                  style={{
                    aspectRatio: '1 / 1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, fontSize: 12,
                    color:      !d ? 'transparent' : isSel ? 'var(--paper)' : isToday ? 'var(--accent)' : 'var(--ink)',
                    background: isSel ? 'var(--ink)' : 'transparent',
                    fontWeight: isToday || isSel ? 600 : 400,
                    border:     isToday && !isSel ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor:     d ? 'pointer' : 'default',
                  }}
                >
                  {d ?? ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Quick-pick chips ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Quick pick</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {quickDays.map(d => {
              const on = due === d
              return (
                <button key={d} onClick={() => { setDue(d); setCalDay(null) }} style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 12,
                  background: on ? 'var(--ink)' : 'var(--paper-2)',
                  color:      on ? 'var(--paper)' : 'var(--ink-2)',
                  border:     '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Time chips ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Time (optional)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Morning', 'Noon', 'Afternoon', 'Evening', '7:00', '9:30', '12:00', '14:00', '17:00', '20:00'].map(t => {
              const on = time === t
              return (
                <button key={t} onClick={() => setTime(time === t ? '' : t)} style={{
                  padding: '8px 12px', borderRadius: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: on ? 'var(--ink)' : 'transparent',
                  color:      on ? 'var(--paper)' : 'var(--ink-2)',
                  border:     '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                }}>
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Recurrence ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icons.repeat size={11} /> Recurrence
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RECURRENCE_OPTIONS.map(r => {
              const on = r.v === 'custom' ? isCustom : (!isCustom && recurring === r.v)
              return (
                <button key={r.l} onClick={() => handleRecurrence(r.v)} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  background: on ? 'var(--accent-soft)' : 'transparent',
                  color:      on ? 'var(--ink)' : 'var(--ink-2)',
                  border:     '1px solid', borderColor: on ? 'var(--accent)' : 'var(--rule)',
                  fontWeight: on ? 600 : 400,
                }}>
                  {r.l}
                </button>
              )
            })}
          </div>

          {isCustom && (
            <div style={{
              marginTop: 12, padding: 16, borderRadius: 12,
              background: 'var(--paper-2)', border: '1px solid var(--rule)',
            }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Every</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" min={1} value={custEvery}
                  onChange={ev => setCustEvery(Math.max(1, Number(ev.target.value)))}
                  style={{
                    width: 60, padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--rule)', background: 'var(--paper)',
                    fontSize: 14, outline: 'none', color: 'var(--ink)',
                  }}
                />
                <select
                  value={custUnit}
                  onChange={ev => setCustUnit(ev.target.value as typeof custUnit)}
                  style={{
                    padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--rule)', background: 'var(--paper)',
                    fontSize: 14, outline: 'none', fontFamily: 'inherit', color: 'var(--ink)',
                  }}
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>

              {custUnit === 'weeks' && (
                <>
                  <div className="eyebrow" style={{ marginTop: 12, marginBottom: 6 }}>On</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {DAY_LABELS.map((d, i) => {
                      const on = custDays.includes(i)
                      return (
                        <button key={i} onClick={() => toggleCustDay(i)} style={{
                          width: 32, height: 32, borderRadius: '50%', fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: on ? 'var(--ink)' : 'transparent',
                          color:      on ? 'var(--paper)' : 'var(--ink-3)',
                          border:     '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                        }}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>Ends</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['never', 'after', 'date'] as const).map(opt => (
                  <button key={opt} onClick={() => setCustEnds(opt)} style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 11,
                    background: custEnds === opt ? 'var(--paper-3)' : 'transparent',
                    border: '1px solid var(--rule)', color: 'var(--ink-2)',
                    fontWeight: custEnds === opt ? 600 : 400,
                  }}>
                    {opt === 'never' ? 'Never' : opt === 'after' ? 'After 10' : 'On date'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Pomodoro ── */}
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Focus timer</div>
          <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>Session length</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setPomMins(m => Math.max(5, m - 5))} style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
                }}>
                  <Icons.back size={13} />
                </button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, minWidth: 44, textAlign: 'center' }}>
                  {pomMins}m
                </span>
                <button onClick={() => setPomMins(m => Math.min(120, m + 5))} style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--rule)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
                }}>
                  <Icons.arrow size={13} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[15, 20, 25, 30, 45, 60, 90].map(m => (
                <button key={m} onClick={() => setPomMins(m)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  background: pomMins === m ? 'var(--ink)' : 'var(--paper-3)',
                  color:      pomMins === m ? 'var(--paper)' : 'var(--ink-3)',
                  border: '1px solid', borderColor: pomMins === m ? 'var(--ink)' : 'transparent',
                }}>
                  {m}m
                </button>
              ))}
            </div>
            {e && (
              <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                ~{Math.ceil(e.mins / pomMins)} pomodoro{Math.ceil(e.mins / pomMins) !== 1 ? 's' : ''} at {pomMins} min · {e.label} effort
              </div>
            )}
          </div>
        </div>

        {/* ── Save ── */}
        <button onClick={handleSave} style={{
          width: '100%', padding: '16px', borderRadius: 14,
          background: saved ? 'var(--accent-soft)' : 'var(--ink)',
          color:  saved ? 'var(--ink)' : 'var(--paper)',
          fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all .2s',
        }}>
          {saved ? <><Icons.check size={18} sw={2.5} /> Saved!</> : 'Save schedule'}
        </button>

      </div>
    </div>
  )
}
