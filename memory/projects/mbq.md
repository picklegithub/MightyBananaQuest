# MightyBananaQuest (MBQ)

## What it is
A mobile-first productivity app with a "Slow Productivity" model. Gamified task completion (XP system). Android/iOS via Capacitor, PWA as fallback.

## Stack
- React 18 + TypeScript + Vite
- Capacitor (Android/iOS)
- Dexie IndexedDB v11 schema (`MightyBananaQuestDB`)
- Supabase outbox sync

## Active sprint
Mobile screens only. Concept reference: MBQ.html in the design project.

## Key constraints
- DesktopLayout.tsx is **frozen** — do not touch
- Never use raw `hsl()` for themed area colours — use `areaColor()` + `useIsDark()`
- EisenhowerMatrix removed from all screens — do not re-add
- Active task cap: 3 tasks max (enforced in TaskDetailScreen)
- Git: work locally, push to GitHub ~weekly, no mid-session PRs

## Key files
- `src/App.tsx` — router + auth shell
- `src/constants.ts` — EFFORT tiers, categories, DEFAULT_SETTINGS
- `src/data/db.ts` — Dexie schema (source of truth for data shapes)
- `src/screens/` — one file per screen
- `src/components/layout/` — BottomNav, DesktopLayout (frozen), ScreenHeader
- `src/styles/tokens.css` — design tokens (dark mode via `data-theme="dark"`, palette via `data-variant`)

## Navigation
- Progress: dashboard header tap → `navigate({ name: 'progress' })`
- Weekly Review: `navigate({ name: 'review' })`, surfaces in Journal on Sundays
- Both also in Settings → Reflect section

## Undo
Toast-based undo (4s window) on DashboardScreen. `uncompleteTask()` in db.ts reverses XP, resets done flag, removes habit log. TaskDetailScreen also has an inline undo button.
