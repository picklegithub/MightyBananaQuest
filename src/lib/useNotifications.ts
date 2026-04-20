/**
 * useNotifications — schedules and fires all in-app browser notifications.
 *
 * Wires up:
 *   • pom:done event  → timer-complete notification (pom channel)
 *   • App start       → overdue task alert (overdue channel)
 *   • App start       → due-today summary (due channel), only when no overdue
 *   • Daily timers    → morning journal prompt at 8am, evening at 8pm (journal channel)
 *   • Daily timer     → streak nudge at 9pm when streak > 0 (streak channel)
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
          key:  'pom',
          body: 'Time to take a short break.',
          tag:  'pom-done',
        }, settings)
      } else {
        notify('Break over! 💪', {
          key:  'pom',
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
        // Only show due-today if nothing is overdue (avoids notification pile-up)
        const preview = dueToday.slice(0, 3).map(t => t.title).join(', ')
        notify(
          `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`,
          {
            key:  'due',
            body: dueToday.length > 3 ? `${preview} + ${dueToday.length - 3} more` : preview,
            tag:  'due-today',
          },
          settings,
        )
      }
    }

    check().catch(e => console.warn('[notifications] start check failed', e))
  }, [settings, authed])

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
    // Only schedule what hasn't passed yet today
    if (h < 8)  scheduleAt(8,  'Good morning! 🌅', 'Start your day with 5 minutes of reflection.', 'journal-morning')
    if (h < 20) scheduleAt(20, 'Evening reflection 🌙', "How did today go? Take a moment to close the day.", 'journal-evening')

    return () => timers.forEach(clearTimeout)
  // Re-evaluate if the journal or quiet-hours pref changes
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
