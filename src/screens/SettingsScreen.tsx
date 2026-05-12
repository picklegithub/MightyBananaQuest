import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, wipeStreaks, wipeTasks, wipeGoals, wipeAllData, resetLocalForResync } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { Toggle, Seg } from '../components/ui'
import { supabase } from '../lib/supabase'
import { notificationsSupported, requestPermission } from '../lib/notifications'
import { drainOutbox, incrementalPull } from '../lib/sync'
import { useSyncState, setSyncState } from '../lib/syncState'
import { triggerSync, cancelSync } from '../components/SyncStatusBar'
import type { Screen, AppSettings } from '../types'

type SyncOp        = 'push' | 'pull' | 'both' | 'resync' | null
type ConfirmAction = 'streaks' | 'tasks' | 'goals' | 'all' | 'resync' | null

interface Props {
  navigate: (s: Screen) => void
  back: () => void
  onLogout: () => void
}

// ── Palette Section ───────────────────────────────────────────────────────────
function PaletteSection({
  settings, update,
}: {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
}) {
  const palette    = settings.palette ?? 'warm'
  const isCustom   = palette === 'custom'
  const [localHue, setLocalHue] = React.useState(settings.customPaletteHue ?? 215)

  // Keep localHue in sync when settings change externally
  React.useEffect(() => {
    setLocalHue(settings.customPaletteHue ?? 215)
  }, [settings.customPaletteHue])

  // Live-preview: set the CSS variable directly without writing to db on every tick
  function handleHueDrag(hue: number) {
    setLocalHue(hue)
    document.documentElement.style.setProperty('--custom-hue', String(hue))
  }

  // Persist when drag ends
  function handleHueCommit(hue: number) {
    update({ palette: 'custom', customPaletteHue: hue })
  }

  const FIXED = [
    { id: 'warm' as const, label: 'Warm',   swatch: 'oklch(0.55 0.08 80)'  },
    { id: 'mono' as const, label: 'Mono',   swatch: 'oklch(0.20 0 0)'       },
    { id: 'custom' as const, label: 'Custom', swatch: null },
  ]

  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{
        fontSize: 11, color: 'var(--ink-3)', marginBottom: 14,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        Colour palette
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {FIXED.map(p => {
          const on = palette === p.id
          const swatch = p.swatch ?? `oklch(0.44 0.12 ${localHue})`
          return (
            <button
              key={p.id}
              onClick={() => {
                if (p.id === 'custom') {
                  update({ palette: 'custom', customPaletteHue: localHue })
                } else {
                  update({ palette: p.id })
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: swatch,
                boxShadow: on
                  ? '0 0 0 2px var(--paper), 0 0 0 4px var(--ink)'
                  : '0 0 0 2px transparent',
                transition: 'box-shadow 0.2s',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: on ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: on ? 600 : 400,
              }}>
                {p.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Hue slider — visible when custom is selected */}
      {isCustom && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              HUE
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)', fontWeight: 600 }}>
              {localHue}°
            </span>
          </div>
          {/* Hue gradient track */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{
              height: 10, borderRadius: 5,
              background: 'linear-gradient(to right, hsl(0,60%,55%), hsl(60,60%,55%), hsl(120,60%,45%), hsl(180,60%,45%), hsl(240,60%,55%), hsl(300,60%,55%), hsl(360,60%,55%))',
              marginBottom: 6,
            }} />
            <input
              type="range" min={0} max={359} value={localHue}
              onChange={e => handleHueDrag(Number(e.target.value))}
              onMouseUp={e => handleHueCommit(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={e => handleHueCommit(Number((e.target as HTMLInputElement).value))}
              style={{ width: '100%', accentColor: `oklch(0.44 0.12 ${localHue})` }}
            />
          </div>
          {/* Live preview swatch */}
          <div style={{
            height: 28, borderRadius: 8, marginTop: 2,
            background: `oklch(0.44 0.12 ${localHue})`,
            transition: 'background 0.05s',
          }} />
        </div>
      )}
    </div>
  )
}

function relativeTime(ts: number): string {
  if (!ts) return 'never'
  const diffMs  = Date.now() - ts
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)  return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export const SettingsScreen = ({ navigate, back, onLogout }: Props) => {
  const settings     = useLiveQuery(() => db.settings.get(1), [])
  const syncState    = useSyncState()
  const outboxCount  = useLiveQuery(() => db.outbox.count(), []) ?? 0
  const outboxError  = useLiveQuery(
    () => db.outbox.orderBy('queuedAt').reverse().first().then(e => e?.lastError ?? null),
    []
  ) ?? null

  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    notificationsSupported() ? Notification.permission : 'denied'
  )
  const [syncOp,        setSyncOp]        = useState<SyncOp>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [wiping,        setWiping]        = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut,    setLoggingOut]    = useState(false)

  if (!settings) return null

  async function update(patch: Partial<AppSettings>) {
    await db.settings.update(1, patch)
  }

  async function updateNotif(key: keyof AppSettings['notifications'], val: boolean | number) {
    await db.settings.update(1, {
      notifications: { ...settings!.notifications, [key]: val },
    })
  }

  async function handleRequestPermission() {
    const perm = await requestPermission()
    setNotifPerm(perm)
  }

  // ── Sync handlers ─────────────────────────────────────────────────────────
  async function handlePush() {
    if (syncOp) return
    setSyncOp('push')
    setSyncState({ phase: 'pushing', pushProgress: 0, errorMsg: null })
    try {
      const failures = await drainOutbox()
      setSyncState({ phase: 'done', pushProgress: 100, lastSyncAt: Date.now(),
        errorMsg: failures > 0 ? `${failures} item${failures !== 1 ? 's' : ''} failed — will retry` : null })
      setTimeout(() => setSyncState({ phase: 'idle' }), 3000)
    } catch (e) {
      setSyncState({ phase: 'error', errorMsg: e instanceof Error ? e.message : 'Push failed' })
    } finally { setSyncOp(null) }
  }

  async function handlePull() {
    if (syncOp) return
    setSyncOp('pull')
    setSyncState({ phase: 'pulling', pullProgress: 0, errorMsg: null })
    try {
      await incrementalPull()
      setSyncState({ phase: 'done', pullProgress: 100, lastSyncAt: Date.now(), errorMsg: null })
      setTimeout(() => setSyncState({ phase: 'idle' }), 3000)
    } catch (e) {
      setSyncState({ phase: 'error', errorMsg: e instanceof Error ? e.message : 'Pull failed' })
    } finally { setSyncOp(null) }
  }

  async function handlePushPull() {
    if (syncOp) return
    setSyncOp('both')
    try { await triggerSync() } finally { setSyncOp(null) }
  }

  function handleCancel() {
    cancelSync()
    setSyncOp(null)
  }

  async function handleResync() {
    if (syncOp) return
    setSyncOp('resync')
    setConfirmAction(null)
    try {
      await resetLocalForResync()
      setSyncState({ phase: 'pulling', pullProgress: 0, errorMsg: null })
      await incrementalPull()
      setSyncState({ phase: 'done', pullProgress: 100, lastSyncAt: Date.now(), errorMsg: null })
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      setSyncState({ phase: 'error', errorMsg: e instanceof Error ? e.message : 'Resync failed' })
      setSyncOp(null)
    }
  }

  // ── Wipe handlers ─────────────────────────────────────────────────────────
  async function handleWipe(action: 'streaks' | 'tasks' | 'goals' | 'all') {
    setWiping(true)
    try {
      if (action === 'streaks') { await wipeStreaks() }
      else if (action === 'tasks')  { await wipeTasks()   }
      else if (action === 'goals')  { await wipeGoals()   }
      else if (action === 'all')    { await wipeAllData(); window.location.reload() }
    } finally {
      setWiping(false)
      setConfirmAction(null)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('[auth] signOut error', e)
    }
    // Directly transition to unauthed state — no reload needed
    onLogout()
  }

  return (
    <div className="screen">
      <ScreenHeader title="Settings" back={back} />

      <div className="screen-scroll" style={{ padding: '0 0 40px' }}>
        {/* Appearance */}
        <Section title="Appearance">
          {/* Theme picker — icon cards */}
          <div style={{ padding: '14px 20px 16px', borderBottom: '1px solid var(--rule)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>Theme</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { id: 'light',  label: 'Light',  icon: 'sun'      },
                { id: 'dark',   label: 'Dark',   icon: 'moon'     },
                { id: 'auto',   label: 'System', icon: 'settings' },
              ] as { id: AppSettings['theme']; label: string; icon: keyof typeof Icons }[]).map(o => {
                const I  = Icons[o.icon]
                const on = settings.theme === o.id
                return (
                  <button
                    key={o.id}
                    onClick={() => update({ theme: o.id })}
                    style={{
                      flex: 1, padding: '14px 10px', borderRadius: 12,
                      background: on ? 'var(--ink)' : 'var(--paper-2)',
                      color:      on ? 'var(--paper)' : 'var(--ink)',
                      border: '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    }}
                  >
                    <I size={18} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{o.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <PaletteSection settings={settings} update={update} />
          <Row label="Gamification">
            <Seg value={settings.intensity} setValue={v => update({ intensity: v as AppSettings['intensity'] })}
              options={[
                { v: 'subtle',   l: 'Subtle' },
                { v: 'balanced', l: 'Balanced' },
                { v: 'loud',     l: 'Loud' },
              ]} />
          </Row>
          <Row label="Default focus length" sub="Pomodoro timer default">
            <Seg
              value={String(settings.defaultPomodoroMins)}
              setValue={v => update({ defaultPomodoroMins: Number(v) })}
              options={[
                { v: '15', l: '15m' },
                { v: '25', l: '25m' },
                { v: '50', l: '50m' },
              ]}
            />
          </Row>
        </Section>

        {/* Today */}
        <Section title="Today">
          <Row label="Plan Your Day" sub="Morning planning ritual on the Today screen">
            <Toggle
              on={settings.showPlanYourDay ?? true}
              onChange={v => update({ showPlanYourDay: v })}
            />
          </Row>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          {notificationsSupported() && notifPerm === 'default' && (
            <div style={{
              margin: '0 0 0 0', padding: '12px 20px',
              borderBottom: '1px solid var(--rule)',
              background: 'var(--accent-soft)',
            }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.5 }}>
                Allow browser notifications to receive due reminders, Pomodoro alerts, and journal prompts.
              </div>
              <button onClick={handleRequestPermission} style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: 'var(--accent)', color: 'white', border: 'none',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              }}>
                Allow notifications
              </button>
            </div>
          )}
          {notificationsSupported() && notifPerm === 'denied' && (
            <div style={{
              padding: '10px 20px', borderBottom: '1px solid var(--rule)',
              background: 'var(--paper-2)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                Notifications are blocked by your browser. To enable them, update the permission in your browser or OS settings.
              </div>
            </div>
          )}

          {([
            ['due',     'Tasks due today',            '7:30am daily summary'],
            ['overdue', 'Overdue nudge',              'One alert per task, once'],
            ['pom',     'End of Pomodoro',            'Light chime when session ends'],
            ['journal', 'Journal reminders',          'Morning & evening prompts'],
            ['streak',  'Streak at risk',             '8pm alert if streak not locked'],
            ['weekly',  'Weekly review',              'Sunday 6pm wrap-up prompt'],
          ] as const).map(([key, label, sub]) => (
            <Row key={key} label={label} sub={sub}>
              <Toggle
                on={settings.notifications[key]}
                onChange={v => updateNotif(key, v)}
              />
            </Row>
          ))}
          {/* Quiet hours — toggle + configurable start/end time */}
          <div style={{ borderBottom: '1px solid var(--rule)' }}>
            <Row label="Quiet hours" sub={
              settings.notifications.quiet
                ? `${String(settings.notifications.quietStart ?? 22).padStart(2,'0')}:00 – ${String(settings.notifications.quietEnd ?? 7).padStart(2,'0')}:00`
                : 'Silence notifications during sleep'
            }>
              <Toggle
                on={settings.notifications.quiet}
                onChange={v => updateNotif('quiet', v)}
              />
            </Row>
            {settings.notifications.quiet && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px 14px',
                background: 'var(--paper-2)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', minWidth: 32 }}>From</span>
                <select
                  value={settings.notifications.quietStart ?? 22}
                  onChange={e => updateNotif('quietStart', Number(e.target.value))}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 13,
                    border: '1px solid var(--rule)', background: 'var(--paper)',
                    color: 'var(--ink)', fontFamily: 'var(--font-mono)',
                  }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', minWidth: 16 }}>to</span>
                <select
                  value={settings.notifications.quietEnd ?? 7}
                  onChange={e => updateNotif('quietEnd', Number(e.target.value))}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 13,
                    border: '1px solid var(--rule)', background: 'var(--paper)',
                    color: 'var(--ink)', fontFamily: 'var(--font-mono)',
                  }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Section>

        {/* Reflect */}
        <Section title="Reflect">
          <button
            onClick={() => navigate({ name: 'review' })}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 20px', width: '100%',
              borderBottom: '1px solid var(--rule)',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Weekly Review</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                Wins · Goals pulse · Covey quadrant audit
              </div>
            </div>
            <Icons.arrow size={16} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
          </button>
        </Section>

        {/* Stats */}
        <Section title="Stats">
          <Row label="XP earned">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600 }}>
              {settings.xp.toLocaleString()}
            </span>
          </Row>
          <Row label="Current streak">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icons.flame size={14} /> {settings.streak} days
            </span>
          </Row>
        </Section>

        {/* Sync */}
        <Section title="Sync">
          {/* Status card */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: outboxError
                ? 'oklch(0.97 0.03 25)'
                : outboxCount > 0 ? 'oklch(0.97 0.04 75)'
                : 'oklch(0.97 0.03 145)',
              border: `1px solid ${outboxError ? 'oklch(0.88 0.08 25)' : outboxCount > 0 ? 'oklch(0.88 0.08 75)' : 'oklch(0.88 0.06 145)'}`,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
                  color: outboxError ? 'oklch(0.50 0.15 25)' : outboxCount > 0 ? 'oklch(0.50 0.12 75)' : 'oklch(0.40 0.10 145)',
                }}>
                  {outboxError ? '⚠ SYNC ERROR' : syncOp ? `● ${syncOp === 'push' ? 'PUSHING' : syncOp === 'pull' ? 'PULLING' : syncOp === 'resync' ? 'RESYNCING' : 'SYNCING'}…` : outboxCount > 0 ? '⏳ PENDING' : '✓ SYNCED'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                  {outboxCount > 0 ? `${outboxCount} item${outboxCount !== 1 ? 's' : ''} queued` : 'up to date'}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                Last sync: {relativeTime(syncState.lastSyncAt)}
              </div>
              {outboxError && (
                <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'oklch(0.50 0.15 25)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                  {outboxError === '[object Object]' ? 'Network or server error — will retry' : outboxError}
                </div>
              )}
            </div>
          </div>

          {/* Push / Pull row */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', gap: 8 }}>
            <SyncBtn onClick={handlePush} disabled={!!syncOp} loading={syncOp === 'push'} icon="↑">Push</SyncBtn>
            <SyncBtn onClick={handlePull} disabled={!!syncOp} loading={syncOp === 'pull'} icon="↓">Pull</SyncBtn>
          </div>

          {/* Push & Pull */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
            <SyncBtn full primary onClick={handlePushPull} disabled={!!syncOp} loading={syncOp === 'both'} icon="↑↓">
              Push &amp; Pull
            </SyncBtn>
          </div>

          {/* Cancel */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
            <SyncBtn full onClick={handleCancel} disabled={!syncOp}>
              Cancel sync
            </SyncBtn>
            {!syncOp && (
              <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                No sync in progress. Local data is intact.
              </div>
            )}
          </div>

          {/* Reset local cache & resync */}
          <div style={{ padding: '12px 20px' }}>
            {confirmAction === 'resync' ? (
              <InlineConfirm
                message="Clears all local data and pull watermarks, then rebuilds everything from the server. Any unsynced local changes will be lost."
                confirmLabel={syncOp === 'resync' ? 'Resyncing…' : 'Yes, reset & resync'}
                loading={syncOp === 'resync'}
                danger
                onCancel={() => setConfirmAction(null)}
                onConfirm={handleResync}
              />
            ) : (
              <SyncBtn full danger onClick={() => setConfirmAction('resync')} disabled={!!syncOp}>
                Reset local cache &amp; resync everything
              </SyncBtn>
            )}
            <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
              Use if local state is stuck or out of date. Fetches fresh data from server.
            </div>
          </div>
        </Section>

        {/* Wipe */}
        <Section title="Wipe">
          {/* Streaks + Tasks row */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
            {confirmAction === 'streaks' ? (
              <InlineConfirm
                message="Resets all habit streaks and clears log history. Habits are not deleted."
                confirmLabel={wiping ? 'Wiping…' : 'Yes, wipe streaks'}
                loading={wiping}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => handleWipe('streaks')}
              />
            ) : confirmAction === 'tasks' ? (
              <InlineConfirm
                message="Deletes all tasks and daily plan data. Goals and journal are not affected."
                confirmLabel={wiping ? 'Wiping…' : 'Yes, wipe tasks'}
                loading={wiping}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => handleWipe('tasks')}
              />
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <WipeBtn onClick={() => setConfirmAction('streaks')} disabled={wiping}>Wipe Streaks</WipeBtn>
                <WipeBtn onClick={() => setConfirmAction('tasks')}   disabled={wiping}>Wipe Tasks</WipeBtn>
              </div>
            )}
          </div>

          {/* Goals */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
            {confirmAction === 'goals' ? (
              <InlineConfirm
                message="Deletes all goals. Tasks linked to those goals are not deleted."
                confirmLabel={wiping ? 'Wiping…' : 'Yes, wipe goals'}
                loading={wiping}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => handleWipe('goals')}
              />
            ) : (
              <WipeBtn full onClick={() => setConfirmAction('goals')} disabled={wiping}>Wipe Goals</WipeBtn>
            )}
          </div>

          {/* Wipe all — most destructive */}
          <div style={{ padding: '12px 20px' }}>
            {confirmAction === 'all' ? (
              <InlineConfirm
                message="DANGER — permanently deletes all tasks, goals, journal, habits, categories, XP, and streaks. There is no undo."
                confirmLabel={wiping ? 'Wiping…' : 'Yes, delete everything'}
                loading={wiping}
                danger
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => handleWipe('all')}
              />
            ) : (
              <>
                <WipeBtn full destructive onClick={() => setConfirmAction('all')} disabled={wiping}>
                  Wipe all
                </WipeBtn>
                <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warn)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
                  Most destructive. Deletes everything including XP and streaks.
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <div style={{ padding: '12px 20px' }}>
            {!confirmLogout ? (
              <button
                onClick={() => setConfirmLogout(true)}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12, fontSize: 13,
                  border: '1px solid var(--rule)', color: 'var(--ink-2)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  background: 'var(--paper-3)',
                }}>
                Sign out
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--warn-soft)',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: 'var(--warn)', textAlign: 'center', letterSpacing: '0.02em',
                }}>
                  Sign out of MightyBananaQuest?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmLogout(false)}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 10, fontSize: 13,
                      border: '1px solid var(--rule)', color: 'var(--ink-2)',
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--paper-2)',
                    }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 10, fontSize: 13,
                      border: 'none',
                      fontFamily: 'var(--font-mono)', fontWeight: 600,
                      background: loggingOut ? 'var(--ink-3)' : 'var(--ink)',
                      color: 'var(--paper)',
                    }}>
                    {loggingOut ? 'Signing out…' : 'Yes, sign out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div style={{ padding: '6px 20px 14px' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              <span className="t-display" style={{ fontSize: 15 }}>MightyBananaQuest</span>
              <br />
              Your gamified life OS. Data is stored on-device and synced securely across your devices.
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── SyncBtn ────────────────────────────────────────────────────────────────────
function SyncBtn({
  children, onClick, disabled, loading, icon, full, primary, danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  icon?: string
  full?: boolean
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: full ? undefined : 1, width: full ? '100%' : undefined,
        padding: '12px', borderRadius: 12, fontSize: 13,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        opacity: disabled ? 0.4 : 1,
        background: primary ? 'var(--ink)' : danger ? 'var(--warn-soft)' : 'var(--paper-3)',
        color: primary ? 'var(--paper)' : danger ? 'var(--warn)' : 'var(--ink-2)',
        border: `1px solid ${primary ? 'var(--ink)' : danger ? 'var(--warn)' : 'var(--rule)'}`,
      }}
    >
      {icon && <span style={{ opacity: loading ? 0.5 : 1 }}>{icon}</span>}
      {loading ? 'Working…' : children}
    </button>
  )
}

// ── WipeBtn ────────────────────────────────────────────────────────────────────
function WipeBtn({
  children, onClick, disabled, full, destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  full?: boolean
  destructive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: full ? undefined : 1, width: full ? '100%' : undefined,
        padding: '12px', borderRadius: 12, fontSize: 13,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        opacity: disabled ? 0.4 : 1,
        background: destructive ? 'oklch(0.97 0.03 25)' : 'var(--paper-3)',
        color: destructive ? 'oklch(0.45 0.18 25)' : 'var(--ink-2)',
        border: `1px solid ${destructive ? 'oklch(0.85 0.08 25)' : 'var(--rule)'}`,
      }}
    >
      {children}
    </button>
  )
}

// ── InlineConfirm ──────────────────────────────────────────────────────────────
function InlineConfirm({
  message, confirmLabel, loading, danger, onCancel, onConfirm,
}: {
  message: string
  confirmLabel: string
  loading?: boolean
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        padding: '10px 14px', borderRadius: 10, lineHeight: 1.55,
        background: danger ? 'oklch(0.97 0.03 25)' : 'var(--accent-soft)',
        border: `1px solid ${danger ? 'oklch(0.88 0.08 25)' : 'var(--rule)'}`,
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.03em',
        color: danger ? 'oklch(0.45 0.18 25)' : 'var(--ink-2)',
      }}>
        {message}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1, padding: '11px', borderRadius: 10, fontSize: 13,
            border: '1px solid var(--rule)', color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)', background: 'var(--paper-2)',
            opacity: loading ? 0.4 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: 'none',
            fontFamily: 'var(--font-mono)',
            background: danger ? 'oklch(0.45 0.18 25)' : 'var(--ink)',
            color: 'var(--paper)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ padding: '0 20px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
        <div className="eyebrow">{title}</div>
      </div>
      {sub && (
        <div style={{ padding: '0 20px 10px', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)' }}>
        {children}
      </div>
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────────
function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '15px 20px', borderBottom: '1px solid var(--rule)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 12 }}>{children}</div>
    </div>
  )
}
