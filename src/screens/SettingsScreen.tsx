import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, resetAllData } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import { Toggle, Seg } from '../components/ui'
import { supabase } from '../lib/supabase'
import { notificationsSupported, requestPermission } from '../lib/notifications'
import { pullAll, pushAllLocal } from '../lib/sync'
import type { Screen, AppSettings } from '../types'

interface Props { navigate: (s: Screen) => void; back: () => void }

export const SettingsScreen = ({ navigate, back }: Props) => {
  const settings = useLiveQuery(() => db.settings.get(1), [])

  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    notificationsSupported() ? Notification.permission : 'denied'
  )
  const [syncing, setSyncing] = useState(false)

  if (!settings) return null

  async function update(patch: Partial<AppSettings>) {
    await db.settings.update(1, patch)
  }

  async function updateNotif(key: keyof AppSettings['notifications'], val: boolean) {
    await db.settings.update(1, {
      notifications: { ...settings!.notifications, [key]: val },
    })
  }

  async function handleRequestPermission() {
    const perm = await requestPermission()
    setNotifPerm(perm)
  }

  const pomMins = settings.defaultPomodoroMins

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center' }}>
          <Icons.back size={20} />
        </button>
        <h1 className="t-display" style={{ fontSize: 22 }}>Settings</h1>
      </div>

      <div className="screen-scroll" style={{ padding: '0 0 40px' }}>
        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme" sub="Tap to cycle · also in Today header">
            <ThemeToggle variant="pill" />
          </Row>
          <Row label="Style">
            <Seg value={settings.variant} setValue={v => update({ variant: v as AppSettings['variant'] })}
              options={[{ v: 'warm', l: 'Linen' }, { v: 'strict', l: 'Mono' }]} />
          </Row>
          <Row label="Gamification">
            <Seg value={settings.intensity} setValue={v => update({ intensity: v as AppSettings['intensity'] })}
              options={[
                { v: 'subtle',   l: 'Subtle' },
                { v: 'balanced', l: 'Balanced' },
                { v: 'loud',     l: 'Loud' },
              ]} />
          </Row>
        </Section>

        {/* Focus timer */}
        <Section title="Focus Timer">
          <Row label="Default Pomodoro" sub={`${pomMins} minutes`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => update({ defaultPomodoroMins: Math.max(5, pomMins - 5) })}
                style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
                <Icons.back size={14} />
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, minWidth: 36, textAlign: 'center' }}>
                {pomMins}
              </span>
              <button
                onClick={() => update({ defaultPomodoroMins: Math.min(90, pomMins + 5) })}
                style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
                <Icons.arrow size={14} />
              </button>
            </div>
          </Row>
          <div style={{ padding: '8px 20px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[15, 20, 25, 30, 45, 60].map(m => (
                <button key={m} onClick={() => update({ defaultPomodoroMins: m })} style={{
                  padding: '6px 12px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: pomMins === m ? 'var(--ink)' : 'var(--paper-2)',
                  color: pomMins === m ? 'var(--paper)' : 'var(--ink-2)',
                  border: '1px solid', borderColor: pomMins === m ? 'var(--ink)' : 'var(--rule)',
                }}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          {/* Permission banner */}
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
            ['overdue', 'Overdue alerts',   'Notify when tasks are overdue'],
            ['journal', 'Journal reminders','Morning & evening prompts'],
            ['streak',  'Streak alerts',    'Warn before breaking a streak'],
            ['weekly',  'Weekly review',    'Sunday wrap-up prompt'],
          ] as const).map(([key, label, sub]) => (
            <Row key={key} label={label} sub={sub}>
              <Toggle
                on={settings.notifications[key]}
                onChange={v => updateNotif(key, v)}
              />
            </Row>
          ))}
          <Row label="Quiet hours" sub="No notifications 10pm–7am">
            <Toggle on={settings.notifications.quiet} onChange={v => updateNotif('quiet', v)} />
          </Row>
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

        {/* Data */}
        <Section title="Data">
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)' }}>
            <button
              onClick={async () => {
                setSyncing(true)
                try { await Promise.all([pullAll(), pushAllLocal()]) } finally { setSyncing(false) }
              }}
              disabled={syncing}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, fontSize: 13,
                border: '1px solid var(--rule)', color: syncing ? 'var(--ink-4)' : 'var(--ink)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                background: 'var(--paper-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Icons.reset size={14} style={{ opacity: syncing ? 0.4 : 1 }} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
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
          <div style={{ padding: '12px 20px' }}>
            <button
              onClick={async () => {
                if (confirm('Wipe everything? Tasks, goals, journal and XP will all be reset to the demo data. This cannot be undone.')) {
                  await resetAllData()
                  window.location.reload()
                }
              }}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, fontSize: 13,
                border: '1px solid var(--warn-soft)', color: 'var(--warn)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                background: 'var(--warn-soft)',
              }}>
              Reset all data
            </button>
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <div style={{ padding: '12px 20px' }}>
            <button
              onClick={async () => {
                if (confirm('Sign out of MightyBananaQuest?')) {
                  await supabase.auth.signOut()
                }
              }}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, fontSize: 13,
                border: '1px solid var(--rule)', color: 'var(--ink-2)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                background: 'var(--paper-3)',
              }}>
              Sign out
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div style={{ padding: '6px 20px 14px' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              <span className="t-display" style={{ fontSize: 15 }}>MightyBananaQuest</span>
              <br />
              Your personal life admin companion. Data is stored on-device and synced securely across your devices.
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ padding: '0 20px 8px' }}>
        <div className="eyebrow">{title}</div>
      </div>
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
      padding: '13px 20px', borderBottom: '1px solid var(--rule)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 12 }}>{children}</div>
    </div>
  )
}
