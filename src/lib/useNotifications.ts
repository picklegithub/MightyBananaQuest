/**
 * useNotifications — schedules and fires all in-app browser notifications.
 *
 * Wires up:
 *   • pom:done event  → timer-complete notification (pom channel)
 *   • App start       → overdue task alert (overdue channel)
 *   • App start       → due-today summary (due channel), only when no overdue
 *   • Daily timers    → morning journal prompt at 8am, evening at 8pm (journal channel)
 *   • Daily timer     → streak nudge at 9pm when streak > 0 (streak channel)
 *   • Per-task timers → fire at the task's specific due time for today's tasks (overdue channel)
 *
 * Called once from App.tsx with live settings + authed flag.
 */

import { useEffect, useRef } from 'react'
import { db } from '../data/db'
import type { AppSettings } from '../types'
import { notify, getPermission } from './notifications'

export function useNotifications(
  settings: AppSettings | undefined,
  authed: boolean,
) {
  const startCheckedRef = useRef(false)

  // ── Pomodoro done ─────────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: Event) {
      if (!settings) return
      const { phase } = (e as CustomEvent<{ phase: string }>).detail
      if (phase === 'work') {
        notify('Focus session complete! 🎉', {
          key: 'pom', alwaysOn: true,
          body: 'Time to take a short break.',
          tag:  'pom-done',
        }, settings)
      } else {
        notify('Break over! 💪', {
          key: 'pom', alwaysOn: true,
          body: 'Ready for another focus session?',
          tag:  'pom-done',
        }, settings)
      }
    }
    window.addEventListener('pom:done', handler)
    return () => window.removeEventListener('pom:done', handler)
  }, [settings])

  // ── On-start: overdue + due-today ─────────────────────────────────────────
  useEffect(() => {
    if (!settings || !authed || startCheckedRef.current) return
    if (getPermission() !== 'granted') return
    startCheckedRef.current = true

    async function check() {
      if (!settings) return
      const todayISO = new Date().toISOString().slice(0, 10)
      const isoRe   = /^\d{4}-\d{2}-\d{2}$/

      const openTasks = await db.tasks.filter(t => !t.done).toArray()

      const overdue   = openTasks.filter(t => isoRe.test(t.due) && t.due < todayISO)
      const dueToday  = openTasks.filter(t => t.due === 'Today')

      if (overdue.length > 0) {
        const preview = overdue.slice(0, 3).map(t => t.title).join(', ')
        notify(
          `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
          {
            key:  'overdue',
            body: overdue.length > 3 ? `${preview} + ${overdue.length - 3} more` : preview,
            tag:  'overdue',
          },
          settings,
        )
      } else if (dueToday.length > 0) {
        const preview = dueToday.slice(0, 3).map(t => t.title).join(', ')
        notify(
          `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`,
          {
            key: 'due', alwaysOn: true,
            body: dueToday.length > 3 ? `${preview} + ${dueToday.length - 3} more` : preview,
            tag:  'due-today',
          },
          settings,
        )
      }
    }

    check().catch(e => console.warn('[notifications] start check failed', e))
  }, [settings, authed])

  // ── Due-time reminders: schedule notifications at each task's specific time ─
  useEffect(() => {
    if (!settings || !authed) return
    if (getPermission() !== 'granted') return

    const timers: ReturnType<typeof setTimeout>[] = []

    async function scheduleDueTimeNotifs() {
      if (!settings) return
      const todayISO = new Date().toISOString().slice(0, 10)
      const now = Date.now()

      // Grab all incomplete tasks due today (either "Today" string or ISO today) with a time set
      const tasks = await db.tasks
        .filter(t => !t.done && !!t.time && (t.due === 'Today' || t.due === todayISO))
        .toArray()

      for (const task of tasks) {
        if (!task.time) continue
        const [hh, mm] = task.time.split(':').map(Number)
        const fire = new Date()
        fire.setHours(hh, mm, 0, 0)
        const ms = fire.getTime() - now

        // Only schedule if the time is in the future and within today
        if (ms > 0 && ms < 24 * 60 * 60 * 1000) {
          timers.push(
            setTimeout(() => {
              if (!settings) return
              notify(
                `⏰ Due now: ${task.title}`,
                {
                  key:  'overdue',
                  body: task.notes
                    ? task.notes.slice(0, 100)
                    : 'This task is due right now.',
                  tag:  `due-time-${task.id}`,
                },
                settings,
              )
            }, ms),
          )
        }
      }

      if (tasks.length > 0) {
        console.log(`[notifications] scheduled ${timers.length} due-time reminder(s)`)
      }
    }

    scheduleDueTimeNotifs().catch(e => console.warn('[notifications] due-time schedule failed', e))

    return () => timers.forEach(clearTimeout)
  // Re-run whenever authed status changes so we reschedule on login
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, settings?.notifications.overdue, settings?.notifications.quiet])

  // ── Journal reminders: 8am morning, 8pm evening ───────────────────────────
  useEffect(() => {
    if (!settings?.notifications.journal) return
    if (getPermission() !== 'granted') return

    const timers: ReturnType<typeof setTimeout>[] = []

    function scheduleAt(
      hour: number,
      title: string,
      body: string,
      tag: string,
    ) {
      const now   = new Date()
      const fire  = new Date(now)
      fire.setHours(hour, 0, 0, 0)
      const ms = fire.getTime() - now.getTime()
      if (ms > 0) {
        timers.push(setTimeout(() => {
          if (!settings) return
          notify(title, { key: 'journal', body, tag }, settings)
        }, ms))
      }
    }

    const h = new Date().getHours()
    if (h < 8)  scheduleAt(8,  'Good morning! 🌅', 'Start your day with 5 minutes of reflection.', 'journal-morning')
    if (h < 20) scheduleAt(20, 'Evening reflection 🌙', "How did today go? Take a moment to close the day.", 'journal-evening')

    return () => timers.forEach(clearTimeout)
  }, [settings?.notifications.journal, settings?.notifications.quiet])

  // ── Streak nudge: 9pm when streak > 0 ────────────────────────────────────
  useEffect(() => {
    if (!settings?.notifications.streak) return
    if (!authed || !settings.streak) return
    if (getPermission() !== 'granted') return

    const now  = new Date()
    const fire = new Date(now)
    fire.setHours(21, 0, 0, 0)
    const ms = fire.getTime() - now.getTime()
    if (ms <= 0) return

    const t = setTimeout(() => {
      if (!settings) return
      notify(
        `Don't break your ${settings.streak}-day streak! 🔥`,
        {
          key:  'streak',
          body: 'Complete a task before midnight to keep it alive.',
          tag:  'streak-warn',
        },
        settings,
      )
    }, ms)

    return () => clearTimeout(t)
  }, [settings?.notifications.streak, settings?.streak, authed])
}
