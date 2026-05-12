# MightyBananaQuest — Claude Code context

## Architecture
- Mobile-first. DesktopLayout.tsx is frozen. Do not edit it.
- Capacitor for Android/iOS. PWA as fallback.
- Dexie IndexedDB (v11 schema). Supabase outbox sync.
- React 18 + TypeScript + Vite.

## Active sprint focus
Mobile screens only. The concept reference is Life Admin.html in the design project.

## Key files
- src/App.tsx — router and auth shell
- src/constants.ts — EFFORT tiers, categories, DEFAULT_SETTINGS
- src/data/db.ts — Dexie schema (source of truth for data shapes)
- src/screens/ — one file per screen
- src/components/layout/ — BottomNav, DesktopLayout (frozen), ScreenHeader

## Known issues
- DB is named LifeAdminDB (should be MightyBananaQuestDB — requires migration)
- DesktopLayout.tsx has visual inconsistencies — frozen, do not touch

## Design tokens
See src/styles/tokens.css. Dark mode = data-theme="dark", palette = data-variant.
Describe what you want to create...

## Slow Productivity model (NOT Eisenhower)
Task status: backlog | active | someday
Active cap: 3 tasks max (enforced in TaskDetailScreen — capWarning state)
EisenhowerMatrix has been removed from all screens. Do not re-add it.
QuadKey type still exists in types.ts for legacy DB data — keep it, just don't show it in UI.

## Undo
uncompleteTask() in db.ts reverses XP, resets done flag, removes habit log.
Toast-based undo (4s window) is the primary UX — see DashboardScreen.
TaskDetailScreen also has an inline undo button.

## Navigation to Progress + Review
Progress: dashboard header tap, or navigate({ name: 'progress' })
Weekly Review: navigate({ name: 'review' }), surfaces in Journal on Sundays
Both are also in Settings → Reflect section.
