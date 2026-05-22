/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
// @ts-ignore — injected by VitePWA at build time
precacheAndRoute(self.__WB_MANIFEST)

// ── Push notification received (server-triggered) ─────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let payload: { title: string; body: string; taskId?: string }
  try {
    payload = event.data.json() as { title: string; body: string; taskId?: string }
  } catch {
    payload = { title: 'MightyBananaQuest', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:  payload.body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   payload.taskId ? `task-${payload.taskId}` : 'mbq-push',
      data:  { taskId: payload.taskId },
    }),
  )
})

// ── Notification click → deep-link ─────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const taskId = (event.notification.data as { taskId?: string })?.taskId

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // If app is already open, post a message so it can navigate
        for (const client of clients) {
          if ('focus' in client) {
            void (client as WindowClient).focus()
            client.postMessage({ type: 'PUSH_CLICK', taskId })
            return
          }
        }
        // App not open — open it with a hash route
        const url = taskId ? `/#/?openTask=${taskId}` : '/'
        return self.clients.openWindow(url)
      }),
  )
})
