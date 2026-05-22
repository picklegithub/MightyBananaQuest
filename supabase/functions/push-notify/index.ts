import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const VAPID_PUBLIC_KEY  = 'BPWolXtvFasu-fSo1zG6CfeUsXy4qaJCUmlWHg-w21Dy5sYkm6uAyigFZ0WnIgRhE3R8Jy2JFm8NtlEmRd2mFFM'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const FCM_SERVER_KEY    = Deno.env.get('FCM_SERVER_KEY')    ?? ''
const APNS_KEY_ID       = Deno.env.get('APNS_KEY_ID')       ?? ''
const MAILTO            = 'mailto:Anthropic@kemo.au'

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// ── senders ────────────────────────────────────────────────────────────────────

async function sendFcm(token: string, title: string, body: string, taskId?: string): Promise<boolean> {
  if (!FCM_SERVER_KEY) return false
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { 'Authorization': `key=${FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data: { taskId: taskId ?? '' },
      priority: 'high',
    }),
  })
  return res.ok
}

async function sendApns(token: string, title: string, body: string): Promise<boolean> {
  if (!APNS_KEY_ID) return false
  // Stub: full APNs JWT signing requires native key. Wire up when targeting iOS.
  console.log(`[push-notify] APNs stub token=${token.slice(0, 8)}… title="${title}" body="${body}"`)
  return false
}

async function sendWebPush(
  endpoint: string,
  p256dh:   string,
  auth:     string,
  title:    string,
  body:     string,
  taskId?:  string,
): Promise<boolean> {
  if (!VAPID_PRIVATE_KEY) return false
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title, body, taskId }),
    )
    return true
  } catch (err) {
    console.warn('[push-notify] web push failed', err)
    return false
  }
}

// ── main ───────────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  try {
    const now         = new Date()
    const windowEnd   = new Date(now.getTime() + 5 * 60 * 1000)
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000)

    const { data: dueTasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('id, title, user_id, due')
      .eq('done', false)
      .is('deleted_at', null)
      .gte('due', windowStart.toISOString())
      .lte('due', windowEnd.toISOString())

    if (tasksErr) throw tasksErr
    if (!dueTasks || dueTasks.length === 0)
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })

    const userIds = [...new Set(dueTasks.map((t: { user_id: string }) => t.user_id))]

    const { data: tokens, error: tokErr } = await supabase
      .from('device_tokens')
      .select('user_id, token, platform, web_endpoint, web_p256dh, web_auth')
      .in('user_id', userIds)

    if (tokErr) throw tokErr
    if (!tokens || tokens.length === 0)
      return new Response(JSON.stringify({ sent: 0, reason: 'no_tokens' }), { status: 200 })

    type TokenRow = {
      user_id: string; token: string; platform: string
      web_endpoint?: string; web_p256dh?: string; web_auth?: string
    }

    const tokenMap = new Map<string, TokenRow[]>()
    for (const t of tokens as TokenRow[]) {
      const arr = tokenMap.get(t.user_id) ?? []
      arr.push(t)
      tokenMap.set(t.user_id, arr)
    }

    let sent = 0
    for (const task of dueTasks as Array<{ id: string; title: string; user_id: string }>) {
      const userTokens = tokenMap.get(task.user_id) ?? []
      const title = 'Task due now'
      const body  = task.title

      for (const t of userTokens) {
        let ok = false
        if      (t.platform === 'android') ok = await sendFcm(t.token, title, body, task.id)
        else if (t.platform === 'ios')     ok = await sendApns(t.token, title, body)
        else if (t.platform === 'web' && t.web_endpoint && t.web_p256dh && t.web_auth)
          ok = await sendWebPush(t.web_endpoint, t.web_p256dh, t.web_auth, title, body, task.id)
        if (ok) sent++
      }
    }

    return new Response(JSON.stringify({ sent }), { status: 200 })
  } catch (err) {
    console.error('[push-notify]', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
