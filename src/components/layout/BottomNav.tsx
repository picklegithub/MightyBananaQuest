import { Icons } from '../ui/Icons'
import type { Screen } from '../../types'

type TabId = 'dashboard' | 'journal' | 'add' | 'goals' | 'calendar'

interface BottomNavProps {
  active: string
  navigate: (s: Screen) => void
}

export const BottomNav = ({ active, navigate }: BottomNavProps) => {
  const items: { id: TabId; label: string; icon: string; big?: boolean }[] = [
    { id: 'dashboard', label: 'Today',   icon: 'home' },
    { id: 'journal',   label: 'Journal', icon: 'journal' },
    { id: 'add',       label: '',        icon: 'plus', big: true },
    { id: 'goals',     label: 'Goals',   icon: 'target' },
    { id: 'calendar',  label: 'Calendar',icon: 'calendar' },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
      borderTop: '1px solid var(--rule)', background: 'var(--paper)',
      flexShrink: 0,
    }}>
      {items.map(it => {
        const I = Icons[it.icon]
        if (it.big) {
          return (
            <button key={it.id} onClick={() => navigate({ name: 'add' })} style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'var(--ink)', color: 'var(--paper)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-2)', marginTop: -22,
            }}>
              <I size={22} />
            </button>
          )
        }
        const isActive = active === it.id
        return (
          <button key={it.id}
            onClick={() => navigate({ name: it.id as Screen['name'] } as Screen)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: isActive ? 'var(--ink)' : 'var(--ink-3)', width: 56, padding: '4px 0',
            }}>
            <I size={20} />
            <span style={{ fontSize: 10, letterSpacing: '0.04em', fontWeight: isActive ? 600 : 400 }}>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
