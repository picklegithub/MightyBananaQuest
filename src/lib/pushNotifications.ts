/**
 * pushNotifications.ts — Push token registration for both Capacitor (native)
 * and Web Push (PWA/browser).
 *
 * Native (Capacitor iOS/Android):
 *   • Requests permission via @capacitor/push-notifications
 *   • Receives FCM/APNs token → upserts into device_tokens (platform: ios|android)
 *
 * Web (PWA):
 *   • Subscribes via PushManager + VAPID
 *   • Stores endpoint + p256dh + auth into device_tokens (platform: web)
 *
 * On logout: removes all device_tokens for the user + unsubscribes SW.
 */

import { supabase } from './supabase'
import { makeId }   from './makeId'

// ── VAPID public key (safe to expose in client) ────────────────────────────────
const VAPID_PUBLIC_KEY = 'BPWolXtvFasu-fSo1zG6CfeUsXy4qaJCUmlWHg-w21Dy5sYkm6uAyigFZ0WnIgRhE3R8Jy2JFm8NtlEmRd2mFFM'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PushPlugin {
  requestPermissions: () => Promise<{ receive: string }>
  register:           () => Promise<void>
  addListener:        (event: string, handler: (data: unknown) => void) => Promise<{ remove: () => void }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

async function getCapacitor(): Promise<{
  Capacitor:         { isNativePlatform: () => boolean }
  PushNotifications: PushPlugin
} | null> {
  try {
    const [core, push] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/push-notifications'),
    ])
    return {
      Capacitor:         core.Capacitor,
      PushNotifications: push.PushNotifications as unknown as PushPlugin,
    }
  } catch {
    return null
  }
}

async function saveNativeToken(token: string, platform: 'ios' | 'android') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('device_tokens').upsert(
    { id: makeId(), user_id: user.id, token, platform },
    { onConflict: 'user_id,token', ignoreDuplicates: true },
  )
  if (error) console.warn('[push] save native token failed', error.message)
  else       console.log('[push] native token registered')
}

async function saveWebSubscription(sub: PushSubscription) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const key  = sub.getKey('p256dh')
  const auth = sub.getKey('auth')
  if (!key || !auth) return

  const p256dh  = btoa(String.fromCharCode(...new Uint8Array(key)))
  const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)))

  const { error } = await supabase.from('device_tokens').upsert(
    {
      id:           makeId(),
      user_id:      user.id,
      token:        sub.endpoint,
      platform:     'web',
      web_endpoint: sub.endpoint,
      web_p256dh:   p256dh,
      web_auth:     authStr,
    },
    { onConflict: 'user_id,token', ignoreDuplicates: false },
  )
  if (error) console.warn('[push] save web subscription failed', error.message)
  else       console.log('[push] web subscription registered')
}

// ── Module-level cleanup ref ───────────────────────────────────────────────────

let _nativeCleanup: (() => void) | null = null

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Call after sign-in. Handles both native (Capacitor) and web (PWA) paths.
 */
export async function registerPushToken(): Promise<void> {
  const cap = await getCapacitor()

  // ── Native path ──────────────────────────────────────────────────────────────
  if (cap?.Capacitor.isNativePlatform()) {
    const { PushNotifications } = cap
    try {
      const { receive } = await PushNotifications.requestPermissions()
      if (receive !== 'granted') { console.log('[push] native permission denied'); return }

      await PushNotifications.register()

      const platform: 'ios' | 'android' =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'android'

      const [regHandle, errHandle, fgHandle] = await Promise.all([
        PushNotifications.addListener('registration', (data: unknown) => {
          const { value } = data as { value: string }
          if (value) saveNativeToken(value, platform).catch(console.warn)
        }),
        PushNotifications.addListener('registrationError', (err: unknown) =>
          console.warn('[push] registration error', err),
        ),
        PushNotifications.addListener('pushNotificationReceived', (n: unknown) => {
          console.log('[push] foreground notification:', (n as { title?: string }).title)
        }),
      ])

      _nativeCleanup = () => {
        regHandle.remove(); errHandle.remove(); fgHandle.remove()
      }
    } catch (err) {
      console.warn('[push] native setup failed', err)
    }
    return
  }

  // ── Web path (PWA) ───────────────────────────────────────────────────────────
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { console.log('[push] web permission denied'); return }

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await saveWebSubscription(sub)
  } catch (err) {
    console.warn('[push] web setup failed', err)
  }
}

/**
 * Remove Capacitor event listeners (no-op on web).
 */
export function unregisterPushListeners(): void {
  _nativeCleanup?.()
  _nativeCleanup = null
}

/**
 * Call on logout — removes all server-side tokens + unsubscribes web SW.
 */
export async function deregisterCurrentToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Remove all tokens from DB
  await supabase.from('device_tokens').delete().eq('user_id', user.id)
  console.log('[push] tokens removed on logout')

  // Unsubscribe web push subscription
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    } catch { /* ignore */ }
  }
}
