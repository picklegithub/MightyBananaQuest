/**
 * notifications.ts — thin wrapper around the Web Notifications API.
 *
 * All callers should go through `notify()`, which:
 *   1. Checks Notification.permission is 'granted'
 *   2. Looks up the user's per-channel preference in AppSettings
 *   3. Respects quiet hours (user-configurable, default 10pm–7am) when enabled
 */

import type { AppSettings } from '../types'

// ── Permission ────────────────────────────────────────────────────────────────

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission(): NotificationPermission {
  if (!notificationsSupported()) return 'denied'
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

// ── Core notify() ─────────────────────────────────────────────────────────────

export interface NotifyOptions extends NotificationOptions {
  /** Which settings key gates this notification */
  key: keyof AppSettings['notifications']
  /** Skip the per-channel pref check — always fire when permission is granted */
  alwaysOn?: boolean
}

export function notify(
  title: string,
  opts: NotifyOptions,
  settings: AppSettings,
): void {
  if (!notificationsSupported()) return
  if (Notification.permission !== 'granted') return

  // Per-channel pref check (skipped for always-on channels)
  if (!opts.alwaysOn && !settings.notifications[opts.key]) return

  // Quiet hours — user-configurable window (defaults to 10pm–7am if not set)
  if (settings.notifications.quiet) {
    const h     = new Date().getHours()
    const start = settings.notifications.quietStart ?? 22
    const end   = settings.notifications.quietEnd   ?? 7
    // When start > end the window wraps midnight (e.g. 22–7); otherwise same-day range
    const inQuiet = start > end
      ? (h >= start || h < end)
      : (h >= start && h < end)
    if (inQuiet) return
  }

  const { key: _key, ...rest } = opts
  try {
    new Notification(title, { icon: '/icons/icon-192.png', badge: '/icons/icon-72.png', ...rest })
  } catch (e) {
    // Some environments throw on new Notification() — swallow silently
    console.warn('[notify]', e)
  }
}
