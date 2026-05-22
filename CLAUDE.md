# MightyBananaQuest — Claude Code context

## Me
Solo developer building MBQ (MightyBananaQuest).

## Terms
| Term | Meaning |
|------|---------|
| MBQ | MightyBananaQuest — the app |

## People
_(none yet — add as they come up)_

## Memory files
- `memory/glossary.md` — full term/acronym decoder
- `memory/projects/mbq.md` — project deep-dive

---

## Architecture
- Desktop-first. Mobile (responsive drawer) secondary.
- Capacitor for Android/iOS. PWA as fallback.
- Dexie IndexedDB (v21 schema). Supabase outbox sync.
- React 18 + TypeScript + Vite.

## Layout shell
- AppLayout.tsx is the ONE layout for all screen sizes (replaces MobileLayout + DesktopLayout).
- Desktop (≥1024px): persistent left sidebar (240px) + top header bar.
- Mobile (<1024px): hamburger top bar + slide-in drawer overlay.
- DesktopLayout.tsx, MobileLayout.tsx, BottomNav.tsx — files exist but are RETIRED. Do not use or edit them.
- Navigation lives in AppLayout's SidebarNav.

## Active sprint focus
Feature-complete on: AppLayout shell, Dashboard (HeroCard, AreaGrid, Top3, UpNext, Upcoming),
Daily Plan Ritual (4-step DPR), Inbox (capture → triage → promote).
Current work: bug-fix rounds (P0–P3 priority labels in commits).
New phase screens (Positive Psychology, Neuroplasticity, Mindfulness, Mood Tracking,
Energy Score, Pomodoro standalone, Flashcards, Resources) remain stubs → ComingSoonScreen.tsx.

## Key files
- src/App.tsx — auth gate and shell selector (renders AppLayout)
- src/components/layout/AppLayout.tsx — unified layout shell (sidebar + screens + sheets)
- src/components/layout/ScreenHeader.tsx — shared screen header (date, icon, title, subtitle)
- src/constants.ts — EFFORT tiers, categories, DEFAULT_SETTINGS
- src/data/db.ts — Dexie schema (source of truth for data shapes)
- src/screens/ — one file per screen
- src/screens/ComingSoonScreen.tsx — placeholder for phases 4–8 screens
- src/components/dashboard/ — dashboard sub-components (HeroCard, AreaGrid, Top3PinnedSection, UpNextSection, UpcomingSection, ListsRow, TodayContextSheet, JournalPrioritiesSection, PlanRitualCard)
- src/components/daily-plan/ — DPR 4-step flow (DPRStep1Reckoning, DPRStep2Calendar, DPRStep3Pick, DPRStep4Top3)
- src/components/layout/CalendarPanel.tsx — slide-in calendar panel
- src/components/layout/HeroBar.tsx — top hero bar in AppLayout

## Nav structure (AppLayout SidebarNav)
PRIMARY: Inbox, Today, Tasks, Habits
GROW: Goals, CBT Toolkit, Positive Psychology, Neuroplasticity, Mindfulness, Journal, Mood Tracking, Energy Score
REVIEW: Weekly Review, Progress
SUPPORT: Pomodoro, Flashcards, Resources
SYSTEM: Settings, Calendar

## Known issues
- DB is named MightyBananaQuestDB

## Design tokens
See src/styles/tokens.css. Dark mode = data-theme="dark", palette = data-variant.
Semantic status tokens (both light + dark defined):
  `--destructive-bg/fg/border` — red destructive actions
  `--positive-bg/fg`           — green success/trend-up
  `--negative-bg/fg`           — red failure/trend-down
Never hardcode oklch/hsl for these — use the tokens.

## Color system
Area colors use OKLCH via `areaColor()` from `src/lib/areaColor.ts`.
Never use raw `hsl()` or `oklch()` literals for themed area colours. Use:
  `areaColor(hue, 'bg' | 'fg', isDark)` from `src/lib/areaColor.ts`
  `useIsDark()` from `src/lib/colorMode.tsx` to get `isDark`.
Raw color literals only acceptable for UI swatches (e.g. a hue picker).

## Design system components
- `<Btn variant="primary|secondary|ghost" size="sm|md" danger?>` — src/components/ui/index.tsx
- `<SectionLabel action?>` — mono eyebrow with optional right-side action
- `<Chip>`, `<Toggle>`, `<EffortPip>`, `<Seg>` — all in src/components/ui/index.tsx

## Card border standard
Every interactive card uses a 3px solid left border:
  - Category hue present → `areaColor(hue, 'fg', isDark)`
  - Active task (no hue) → `var(--accent)`
  - Someday task         → `3px dashed var(--rule)`
  - Done / neutral       → `var(--rule)`
InboxCard: always `var(--accent)` (not source-dependent).

## Animations
`habit-pop` keyframe defined in global.css — apply via `animation: 'habit-pop 0.35s ease-out'` on log circle tap.

## Git workflow
Work locally. Push to GitHub roughly once a week — do NOT create PRs or push mid-session unless the user explicitly asks.

## Supabase
Project: MightyBananaQuest (id: bjufnywuxnvxtrzutdvi, region: ap-southeast-1).
Direct access via MCP — apply migrations with the Supabase MCP tool, don't ask the user to do it manually.
Whenever a new Dexie table is added or a schema change is made, check whether a matching Supabase migration is needed and apply it in the same session.
Migration files live in supabase/migrations/. Use timestamp-prefixed names (YYYYMMDDHHMMSS_name.sql).
Every new synced table needs: the table + RLS policies, server_seq column + stamp trigger, deleted_at column, and an incremental_sync_events trigger. See mood_entries_sync migration as the reference pattern.

## Daily Plan Ritual (DPR)
4-step modal flow: Step 1 Reckoning → Step 2 Calendar → Step 3 Pick → Step 4 Top3.
Triggered from PlanRitualCard on the dashboard.
Shared types/helpers in src/components/daily-plan/shared.ts.

## Inbox
Active inbox: items captured via QuickCaptureSheet land in inboxItems (Dexie table) when captureToInbox setting is on.
InboxScreen handles triage (promote to task / discard). Badge count shown in SidebarNav.
Toggle: Settings → captureToInbox.

## Slow Productivity model 
Task status: backlog | active | someday
Active cap: 3 tasks max (enforced in TaskDetailScreen — capWarning state)
EisenhowerMatrix has been removed from all screens. Do not re-add it.

## Undo
uncompleteTask() in db.ts reverses XP, resets done flag, removes habit log.
Toast-based undo (4s window) is the primary UX — see DashboardScreen.
TaskDetailScreen also has an inline undo button.

## Navigation to Progress + Review
Progress: dashboard header tap, or navigate({ name: 'progress' })
Weekly Review: navigate({ name: 'review' }), surfaces in Journal on Sundays
Both are also in Settings → Reflect section.
