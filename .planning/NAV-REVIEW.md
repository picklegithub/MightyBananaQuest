# MBQ Navigation Architecture Review

**Audited:** 2026-05-22  
**Baseline:** Abstract 6-pillar standards + benchmark app patterns  
**Screenshots:** Not captured (code-only audit)

---

## TL;DR

MBQ's sidebar nav has sound bones — the token usage is clean, the section structure is logical — but it has three compounding problems: (1) the section labels CORE / GROW / PROGRESS are internal product language that means nothing to a new user; (2) the 3-level nesting (GROW > Exercises > CBT/Mindfulness/...) adds cognitive overhead for 4 items that could sit flat; (3) three live destinations (Flashcards, Resources, Insights) show "Coming in Phase X" which trains users that MBQ ships empty screens — ghost nav erodes trust.

---

## Current Structure Map

```
Sidebar (240px, desktop ≥1024px)
├── [logo: MightyBanana 🍌]
│
├── CORE  ← section label (not collapsible)
│   ├── Inbox           [badge: count]
│   ├── Today           [badge: due+habits]
│   ├── Tasks           [badge: active count]
│   ├── Habits          [badge: remaining]
│   ├── Journal
│   ├── Mood & Energy
│   └── Goals
│
├── ─── divider ───
│
├── GROW  ← collapsible section
│   ├── Exercises ▾  ← collapsible sub-group
│   │   ├── CBT
│   │   ├── Mindfulness
│   │   ├── Positive Psychology
│   │   └── Neuroplasticity
│   ├── Pomodoro
│   ├── Flashcards       ← ComingSoonScreen
│   └── Resources        ← ComingSoonScreen
│
├── ─── divider ───
│
├── PROGRESS  ← collapsible section
│   ├── Weekly Review
│   └── Insights         ← ComingSoonScreen
│
└── ─── footer ───
    └── Settings  (full label + icon, NOT icon-only)

Top header (52px, all breakpoints)
├── [mobile] hamburger + logo
├── Search bar [⌘K]
├── [spacer]
├── Focus (Pomodoro launcher dropdown)
├── + (Quick capture)
└── ⚙ Settings (icon-only, navigates to settings screen)
```

---

## 6-Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Section labels CORE/GROW/PROGRESS are internal jargon; "Exercises" is a gym metaphor for psychological practices |
| 2. Visuals | 3/4 | Hierarchy is legible but CORE has no visual anchor; Settings appears in both sidebar footer and top header (duplication) |
| 3. Color | 3/4 | Token usage is clean; active state correctly uses `var(--accent)` + `var(--accent-soft)`; no hardcoded colors in nav code |
| 4. Typography | 3/4 | Section labels at 9px mono 0.14em tracking are appropriately subtle; nav item font sizes (13px/12px) are reasonable but hover state has no explicit style |
| 5. Spacing | 2/4 | Sub-items use `padding-left: 28px` hardcoded (not token-based); depth-0 items at 7px top/bottom padding is between --s-1 (4) and --s-2 (8) — off-scale |
| 6. Experience Design | 2/4 | 3 ghost destinations (Flashcards, Resources, Insights) visible in nav; double-Settings entry confuses location; Exercises nesting is 3 levels deep for 4 items |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Ghost nav items (Flashcards, Resources, Insights)** — Users click nav items expecting a screen, get "Coming in Phase X" — erodes trust in the whole nav. Hide these from the sidebar until the screens ship. Use a feature flag or simply omit them from the nav data arrays.

2. **Settings duplication** — Settings appears in the sidebar footer as a full labeled row AND as an icon in the top header. On desktop, this is confusing (two paths, different affordances). Remove the icon from the top header on desktop; keep only the sidebar row. On mobile, the top header icon is the only settings access path, so keep it there.

3. **Replace CORE / GROW / PROGRESS with user-meaning labels** — "Daily" / "Practice" / "Review" (or remove labels entirely from CORE which needs no label). GROW is the worst offender — a new user cannot parse it without trial-and-click.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**WARNING: Section label jargon**

- `CORE` — All-caps mono label. Means nothing to a user. The items below it (Inbox, Today, Tasks, Habits, Journal, Mood & Energy, Goals) are the primary daily-use items, but "CORE" is a developer's taxonomy, not a user's. Compare: Things 3 has no section label above its primary items — they're just there. Linear's primary nav (My Issues, All Issues, Views) has no section label.
- `GROW` — Worst offender. Users will parse this as "growth" conceptually, but will not immediately know whether Goals belongs here or under CORE. The word is vague enough to mean everything and nothing. Apps like Day One, Bear, and Craft don't name sections after abstract concepts — they name them after content types.
- `PROGRESS` — Acceptable, but redundant with the items it contains (Weekly Review, Insights). The items name themselves.
- `Exercises` — Sub-group label inside GROW. "Exercises" reads as fitness. The content (CBT, Mindfulness, Positive Psychology, Neuroplasticity) is psychological practice. "Practices" is more accurate and less clinical-gym.
- `CBT` — Three-letter acronym with no expansion. A new user who doesn't know "Cognitive Behavioural Therapy" will see a mystery box. Compare with how Reflectly and Woebot surface CBT: always as "Thought Log" or "Reframe your thinking" — action-oriented, not clinical-acronym.
- `Mood & Energy` — This is actually good copy. Compound but clear, user-language.
- `Focus` (PomodoroLauncher button) — Excellent. "Focus" is more meaningful than "Pomodoro" to a non-expert user. This is the right call.

**AppLayout.tsx line references:**
- Line 110: `label: 'GROW'`
- Line 114: `label: 'Exercises'`
- Line 116: `label: 'CBT'`
- Line 131: `label: 'PROGRESS'`
- Line 339–344: `CORE` section label rendered inline

---

### Pillar 2: Visuals (3/4)

**WARNING: Settings duplication**

- Settings appears at AppLayout.tsx line 138 (sidebar footer, full label + icon) AND at line 573–585 (top header, icon-only). On desktop, both are visible simultaneously. This creates a "which one is real?" moment and burns precious top-header real estate on a function already in the sidebar.
- The CORE section has no visual distinction from the collapsible sections except the absence of a collapse toggle. This is fine at a glance but means CORE's permanence is communicated only by behaviour (clicking the label does nothing), not by visual affordance.
- Active state: `background: var(--accent-soft)` + `color: var(--accent)` + `fontWeight: 600` at line 212–216. This is a solid three-signal active indicator. No finding here.
- Depth-1 sub-items render at `color: var(--ink-3)` when inactive vs depth-0 at `var(--ink-2)`. Correct subdued treatment.
- The `▾` chevron for expand/collapse is a raw Unicode character at 9px (line 281, 325). It works but is less precise than an SVG icon, especially at non-integer DPR. Minor finding.
- No hover state defined in the nav item styles (line 202–238). On desktop, hovering a nav item produces no visual response until it's active. This is a missing interaction state. Things 3, Linear, Notion all have distinct hover backgrounds.

---

### Pillar 3: Color (3/4)

**No hardcoded hex/rgb values in AppLayout.tsx nav code.** All colors are token-referenced. This is correct.

- Active: `var(--accent)` + `var(--accent-soft)` — correct
- Inactive depth-0: `var(--ink-2)` — correct
- Inactive depth-1: `var(--ink-3)` — correct subduing
- Section labels: `var(--ink-4)` — correct chrome-level muting
- Badge active: `var(--accent)` background, `var(--paper)` text — correct
- Badge inactive: `var(--ink-4)` background — correct

**Minor: `var(--accent-soft, var(--paper-3))`** at lines 211 and 269 uses a CSS fallback chain. `--accent-soft` is defined in tokens.css so the fallback should never trigger, but the defensive pattern implies uncertainty. Not a color bug, but suggests a prior instability.

One color concern outside the nav: the `rgba(0,0,0,0.45)` overlay at AppLayout.tsx line 799 uses a raw rgba value. `tokens.css` defines `--overlay: rgba(0, 0, 0, 0.45)` for exactly this purpose. Should use `var(--overlay)` instead.

---

### Pillar 4: Typography (3/4)

Section labels: 9px, `var(--font-mono)`, 0.14em tracking — appropriate for nav chrome.

Nav item labels:
- Depth-0: 13px, weight 400 inactive / 600 active
- Depth-1: 12px, weight 400 inactive (no explicit active weight change at depth-1 — line 219)

**Minor finding:** At depth-1 (sub-items under Exercises), the active `fontWeight: 600` is set by `active ? 600 : 400` in NavItemRow (line 215). But the font size stays at 12px at depth-1 (line 219). This means active sub-items use 12px bold, which is slightly heavy for that size. Not a blocker but looks dense.

The sidebar logo at line 748: `fontFamily: var(--font-display)`, `fontSize: 16`, `fontStyle: italic`. Correct use of display font. No finding.

The PomodoroLauncher "Focus" button uses `var(--font-mono)` at 12px (line 409) — correct for a utility/status element.

---

### Pillar 5: Spacing (2/4)

**WARNING: Off-scale padding values**

The token spacing scale is: `--s-1: 4px, --s-2: 8px, --s-3: 12px, --s-4: 16px, --s-5: 20px`.

NavItemRow inline styles (line 209):
- Depth-0: `padding: '7px 12px'` — 7px is between --s-1 (4) and --s-2 (8), not on scale
- Depth-1: `padding: '6px 12px 6px 28px'` — 6px off-scale; 28px left indent is arbitrary (not 24px/--s-6 or 32px/--s-7)

Section label padding (line 318): `padding: '4px 12px 4px'` — 4px is --s-1, 12px is --s-3, so this one is on-scale.

SidebarContent outer padding (line 336): `padding: '8px 10px 12px'` — 10px is off-scale. Should be 8px (--s-2) or 12px (--s-3).

Gap in NavItemRow (line 208): `gap: 9` — off-scale. Should be 8px (--s-2) or 10px (not in scale either — scale jumps from 8 to 12).

The spacing irregularities aren't catastrophic individually, but the consistent use of 7px, 9px, 6px, 10px, 28px throughout the nav suggests the nav was built against a feel rather than the declared token scale. This creates a slightly cramped, uneven density that is hard to pinpoint visually but accumulates.

---

### Pillar 6: Experience Design (2/4)

This is the core of the audit. Multiple structural issues.

**BLOCKER: Ghost nav items**

Three nav items resolve to ComingSoonScreen:
- GROW > Flashcards (`FlashcardsScreen.tsx`)
- GROW > Resources (`ResourcesScreen.tsx`)
- PROGRESS > Insights (`InsightsScreen.tsx`)

A nav item is an implicit contract: "clicking this takes you somewhere useful." When it leads to a construction notice, the user experiences the nav as broken. This is especially damaging for Insights in the PROGRESS section — a user doing a Weekly Review will look for insights and hit a wall. The fix is to hide these items from `GROW_SECTION` and `PROGRESS_SECTION` nav arrays until the screens ship. They can be re-added with a single line when ready.

**WARNING: 3-level nesting for 4 items**

GROW > Exercises > {CBT, Mindfulness, Positive Psychology, Neuroplasticity} is 3 levels of nav depth (sidebar > section > sub-group > item). All four practice screens are now real implementations. There is no reason to nest them behind an Exercises parent. Flattening saves a click, removes the expand/collapse interaction, and makes the practices first-class nav citizens. The only argument for the Exercises grouping is future scalability (adding more practice types) — but that argument holds only if you plan >5 more practices. At 4 items, flat wins.

**WARNING: Settings duplication (settings in sidebar + icon in top header on desktop)**

AppLayout renders Settings in two places simultaneously on desktop:
1. Sidebar footer: `NavItemRow` with label "Settings" (line 372–377)
2. Top header: icon button navigating to settings (line 573–585)

Both are always visible on ≥1024px. The user has no way to know they're the same destination. This is a standard "two paths to the same place" UX antipattern. On desktop, remove the top-header settings icon. On mobile (<1024px), since the sidebar is behind a drawer, keep the top-header icon as the quick-access path.

**WARNING: Badge semantics on "Today" conflate two different urgencies**

Line 664: `today: todayDueCount + habitsRemaining` — the Today badge is the sum of due tasks AND uncompleted habits. These are different types of urgency. A user with 3 tasks due but 8 habits remaining will see "11" on Today, which misrepresents the nature of their workload. The badge should show only task-urgency (due today), or use two separate badges, or show the higher-priority signal only. This is a nav UX decision with downstream anxiety effects.

**WARNING: No visual differentiation between implemented and stub-but-shown items**

Currently the nav gives no signal that Flashcards/Resources/Insights are stub screens before clicking. At minimum, these should be removed; at most, if you want to surface roadmap items, use a visual treatment (muted text + lock icon, or tooltip "Coming Phase 7") rather than a full nav row.

**OBSERVATION: Pomodoro appears twice**

Pomodoro is accessible via:
1. GROW > Pomodoro (full screen, uses TaskPomodoro component)
2. Top header "Focus" button (launches GlobalPomodoro floating widget)
3. GlobalPomodoro widget is always rendered (AppLayout line 875)

This isn't a nav bug, but the mental model is ambiguous: is Pomodoro a nav destination or a global utility? Apps like Cron/Amie handle this by making the timer a persistent status widget with no nav destination at all. The nav entry for Pomodoro may be unnecessary if the Focus button + floating widget covers the use case.

---

## Benchmark: How Great Apps Organise This

| App | Primary nav pattern | Collapsible sections | Stub handling | Settings placement |
|-----|--------------------|--------------------|---------------|--------------------|
| **Things 3** | Flat sidebar: Inbox, Today, Upcoming, Anytime, Someday; then Areas > Projects | No collapse — all visible; depth via indent | Never ships empty destinations | Cmd+, only, no nav item |
| **Notion** | Pinned pages flat + collapsible user-created sections + Settings/Members at bottom | User-controlled; team workspaces collapse | Pages exist when created; no pre-emptive ghost entries | Bottom of sidebar, icon+label |
| **Linear** | Teams > Issues/Cycles/Projects/Views; flat within team | Teams can collapse; sections within team flat | All destinations have real content on first open | Bottom gear icon, not a full nav row |
| **Bear** | Tags list (flat or tree); no section labels | Tags auto-nest by slash syntax; no forced sections | No stub — notes exist or don't | Icon-only bottom row |
| **Fantastical** | Calendar list sidebar (My Calendars, Other, Subscriptions) + mini-cal + search | Calendar groups collapsible; no ghost calendars | Never shows a calendar that has no content | In-app preferences, not sidebar |
| **Day One** | Journals list (flat) + On This Day / Starred pinned above; Tags below | User collapses journal groups | No stubs — journals contain entries | Icon-only bottom |

**Patterns that emerge from the benchmark:**

1. **No section labels on primary nav** (Things 3, Bear, Day One) — the items speak for themselves. Labels are used only where the taxonomy is genuinely non-obvious (Linear uses "YOUR TEAMS" because teams are user-created, not fixed).
2. **Settings is never a first-class nav item** — it's always icon-only, bottom-pinned, or keyboard shortcut only. MBQ's sidebar footer already does this right; the top-header icon is the outlier.
3. **Ghost destinations don't ship** — every benchmarked app only shows nav items that have real content. Pre-announcing features via nav is a mobile-app dark pattern that erodes trust in desktop software.
4. **3-level nesting is rare and always motivated** — Notion allows it because users create the structure. Linear uses it for team > issue type. Neither forces it on fixed content of 4 items.

---

## The Core Problem

MBQ's nav structure was designed for the full shipped product (all 9 phases) but the nav is rendering as if all phases are complete. The section groupings (CORE / GROW / PROGRESS) reflect the developer's mental model of the product architecture, not the user's daily mental model of what they're trying to do. A user thinks: "I want to check my tasks" / "I want to do a mindfulness exercise" / "I want to see how I did this week." They don't think "I want to access CORE features" or "I want to GROW."

The secondary problem is that the Exercises nesting adds a click tax to 4 items that are all equally important psychological practices. The nesting exists to anticipate future items, but premature taxonomy is a nav antipattern — it optimizes for a hypothetical future at the expense of the current experience.

---

## Proposed Restructure

### Option A: Minimal Surgery (conservative)

Remove stubs, flatten Exercises, rename sections. ~30 min of work.

```
Sidebar
├── [logo]
│
│   ← no section label needed for primary items
├── Inbox           [badge]
├── Today           [badge]
├── Tasks           [badge]
├── Habits          [badge]
├── Journal
├── Mood & Energy
├── Goals
│
├── ─── PRACTICE ───   ← renamed from GROW/Exercises
├── CBT
├── Mindfulness
├── Positive Psychology
├── Neuroplasticity
│
├── ─── REVIEW ───     ← renamed from PROGRESS
├── Weekly Review
│   (Insights hidden until shipped)
│
└── ─── footer ───
    └── Settings
```

Changes from current:
- Remove CORE label (primary items need no label)
- Collapse GROW + Exercises into single flat "PRACTICE" section
- Remove Flashcards, Resources (stub) from nav
- Remove Insights (stub) from nav
- Rename PROGRESS → REVIEW (verb-oriented, clearer intent)
- Remove Settings icon from top header on desktop

### Option B: Purposeful Zones (bold)

Adopt a "mode" model used by Arc (Spaces) and Linear (Teams). Each zone reflects what the user is doing, not what content category it belongs to.

```
Sidebar
├── [logo + date/greeting]
│
├── NOW        ← what you're working on today
│   ├── Today
│   ├── Inbox  [badge]
│   └── Tasks  [badge]
│
├── TRACK      ← things you maintain over time
│   ├── Habits [badge]
│   ├── Mood & Energy
│   ├── Goals
│   └── Journal
│
├── PRACTICE   ← deliberate skill/wellness work
│   ├── CBT
│   ├── Mindfulness
│   ├── Positive Psychology
│   └── Neuroplasticity
│
├── REVIEW     ← periodic reflection
│   └── Weekly Review
│
└── ─── footer ───
    └── Settings
```

Changes from current:
- 4 named zones, all collapsible, all with user-meaningful names
- No sub-groups within zones (flat within each)
- Badges only on items that have urgency signal
- Stub items (Flashcards, Resources, Insights) hidden entirely
- Pomodoro removed from nav (lives as top-header Focus button + floating widget only)
- Section names are all imperatives/gerunds ("NOW" / "TRACK" / "PRACTICE" / "REVIEW") — user-action oriented

**Tradeoff:** Option B requires re-organizing the primary items out of a flat CORE into 2 sections (NOW + TRACK). This makes the sidebar slightly taller and requires the sections to default-open. Worth it because it makes the relationship between content types explicit: "I go to NOW to be productive, TRACK to maintain consistency, PRACTICE to build skills, REVIEW to reflect."

---

## Specific Fixes (Priority Order)

1. **Hide stub nav items immediately** — Remove `{ id: 'flashcards', ... }`, `{ id: 'resources', ... }` from `GROW_SECTION.items` and `{ id: 'insights', ... }` from `PROGRESS_SECTION.items` in AppLayout.tsx lines 122–135. Restore them when screens ship.

2. **Remove Settings icon from top header on desktop** — In `TopHeader` component (AppLayout.tsx line 573–585), wrap the settings button in `{!isDesktop && (...)}` so it only renders on mobile where sidebar is hidden. Eliminates the duplication.

3. **Rename GROW → PRACTICE (or EXERCISES)** — `GROW_SECTION` at line 110: change `label: 'GROW'` to `label: 'PRACTICE'`. Rename section key to `'practice'`. Update localStorage key assumption.

4. **Flatten the Exercises sub-group** — Move CBT, Mindfulness, Positive Psychology, Neuroplasticity from `children` of Exercises up to direct `items` of the PRACTICE section. Delete the Exercises parent node. Saves one level of nesting and one click.

5. **Fix off-scale nav spacing** — NavItemRow depth-0 padding: change `'7px 12px'` → `'8px 12px'` (--s-2). Depth-1: change `'6px 12px 6px 28px'` → `'8px 12px 8px 24px'` (--s-2, --s-6). SidebarContent outer padding: change `'8px 10px 12px'` → `'8px 12px'`.

6. **Add hover state to NavItemRow** — The `button` at line 205 has no hover CSS. Add `onMouseEnter`/`onMouseLeave` to toggle a `hovered` state and apply `background: var(--paper-2)` on hover (when not active). Alternatively, use a CSS class with `:hover` selector.

7. **Use `var(--overlay)` for mobile drawer backdrop** — AppLayout.tsx line 799: `background: 'var(--overlay)'` is already correct here. But check other raw `rgba(0,0,0,...)` instances across the app.

8. **Reconsider Today badge semantics** — Line 664: split `todayDueCount + habitsRemaining` or show only `todayDueCount` on Today badge to reduce anxiety inflation from habit count.

---

## What to Remove from Nav

| Item | Reason | Action |
|------|--------|--------|
| Flashcards | ComingSoonScreen — no content | Remove from nav array |
| Resources | ComingSoonScreen — no content | Remove from nav array |
| Insights | ComingSoonScreen — no content | Remove from nav array |
| Exercises (sub-group parent) | 3-level nesting for 4 items | Flatten children into parent section |
| Settings (top header, desktop only) | Duplicate of sidebar footer entry | Hide on isDesktop |
| Pomodoro (nav item, optional) | Covered by Focus button + GlobalPomodoro widget | Consider removing; keep if standalone timer page has distinct value |

---

## UI REVIEW COMPLETE

```json
{
  "copywriting": 2,
  "visuals": 3,
  "color": 3,
  "typography": 3,
  "spacing": 2,
  "experience": 2,
  "total": 15
}
```
