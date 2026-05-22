# MBQ Habits & Goals — Product Strategy Research

**Date:** 2026-05-19  
**Scope:** Evidence-based habit tracking + goal setting for MightyBananaQuest  
**Constraint:** Slow Productivity model, compassionate UX, no hustle culture

---

## 1. Behavioral Science Foundations

### The Core Models (all well-supported in literature)

| Model | Author | Core Claim | MBQ Relevance |
|-------|--------|------------|---------------|
| **Fogg Behavior Model** (B=MAP) | BJ Fogg, Stanford | Behavior happens when Motivation + Ability + Prompt converge | Design habits to be easy (ability), anchor to prompts (triggers), don't rely on motivation spikes |
| **Habit Loop** | Charles Duhigg / James Clear | Cue → Routine → Reward loop; identity-based change beats goal-based | "I am someone who…" framing; immediate micro-reward on check-in |
| **Tiny Habits** | BJ Fogg | Shrink to below the Action Line; celebrate immediately with emotion | Start with smallest viable version; genuine celebration > streaks |
| **Implementation Intentions** | Peter Gollwitzer | "When X happens, I will Y" doubles follow-through | Habit stacking UI: anchor a habit to a time-of-day or prior action |
| **Self-Monitoring Meta-Analysis** | Harkin et al. (138 studies) | Monitoring progress reliably improves goal attainment | Heatmap + streak + strength score all serve this function |
| **Keystone Habits** | Duhigg | Some habits create cascade effects (sleep → exercise → diet) | Surface keystone suggestions in onboarding; don't treat all habits as equal |
| **Progress Principle** | Teresa Amabile | Small wins are the most reliable source of daily motivation | Show micro-progress; avoid demoralising "reset" mechanics |

---

## 2. Competitive Analysis

### Strides (iOS)

**Core concept:** Four tracker types in one app — Habit (streak), Target (hit a number by date), Average (maintain over time), Project (milestone checklist).

**Goal/habit model:**
- Goal = SMART — title, target value, target date, pace line
- Habit = yes/no streak with flexible schedules
- Tags = "area of life" grouping (equivalent to MBQ `cat`)

**Progress visualization:** Pace line ("are you ahead or behind?"), calendar heatmap, percentage bar, chart history per tracker.

**Reminder/check-in:** Smart notifications tied to tracker schedule. One notification per tracker.

**Onboarding:** Choose a tracker type → fill in fields → done. Very low friction.

**What it does especially well:**
- Four tracker types map cleanly to real-world goal shapes (yes/no habit vs. accumulating metric vs. milestone project)
- Pace line concept is uniquely useful for deadline-driven targets
- Tags/area grouping keeps goals scannable

**What to copy:**
- The four tracker types (habit / target / average / milestone) — MBQ currently only has a single progress bar; this richer model would serve different goal shapes better
- Pace line for targets with a due date
- Area/tag grouping (already exists in MBQ as `cat`)

**What to avoid:**
- iOS-only ecosystem lock (not relevant to MBQ architecture)
- Premium paywall on sync

---

### Habitica (cross-platform)

**Core concept:** RPG gamification — habits, dailies, and to-dos map to character XP, HP, and gold.

**Goal/habit model:**
- Habits = positive/negative behaviors tracked with a +/- button (not streaks — frequency score)
- Dailies = recurring tasks (equivalent to MBQ's recurring tasks or habits)
- To-Dos = one-time tasks with due dates
- No explicit "Goal" object — goals are implicit in the party quest narrative

**Progress visualization:** XP bar, level, gear unlocks, boss health bars in parties.

**Reminder/check-in:** Daily reminder + party social pressure (missing dailies damages the whole party).

**Onboarding:** Character creation first → tutorial quests → gradual feature reveal.

**What it does especially well:**
- Social accountability (party quests) dramatically improves short-term retention
- Immediate reward loop (gold, XP) per action
- Negative habits tracked as + penalty — unique mechanic few apps offer

**What to copy:**
- XP-on-completion already in MBQ — continue this
- Consider a "negative habit" pattern (track what you want to reduce, not just add)
- Immediate micro-celebration on check-in

**What to avoid:**
- Leaderboards / party mechanics — contrary to MBQ's slow productivity ethos
- Visual complexity — MBQ should be calmer
- Gamification research shows mixed long-term outcomes; intrinsic motivation must develop independently

---

### Loop Habit Tracker (Android, open source)

**Core concept:** Habit strength score instead of streak. Uses exponential moving average (EMA) — misses decay gradually, completions accumulate gradually. 

**Goal/habit model:**
- No goals at all — pure habit tracker
- Habit score: 0–100% strength (EMA). A perfect month reaches ~80%; two months ~96%.
- Supports non-daily schedules (3x/week, every other day, etc.)
- Color-coded heatmap (darker = higher score)

**Progress visualization:** Heatmap calendar, score trend line, bar charts per habit.

**Reminder/check-in:** Per-habit notification at a set time.

**What it does especially well:**
- EMA score is the best anti-shame mechanic researched: missing one day barely moves the needle on a strong habit
- Non-daily frequency scheduling is class-leading
- Zero paywall

**What to copy:**
- EMA-based strength score is perfect for MBQ's compassionate model. MBQ already has `strength?: number` in the Habit type — this should use EMA, not a simple ratio. See MBQ implementation note below.
- Score visualization: show strength as a calm percentage, not a fragile streak counter
- Non-daily scheduling options (3x/week, weekdays, custom)

**What to avoid:**
- Android-only design language (not relevant)

---

### Habitify (cross-platform)

**Core concept:** Data-driven habit tracker with rich analytics and clean minimal UI. Daily "Today" view is central.

**Goal/habit model:**
- Habits grouped by time-of-day (morning / afternoon / evening / anytime)
- Notes per completion
- Weekly, monthly, yearly trend charts
- "Insight" score per habit

**Progress visualization:** Ratio bar (complete/total today), trend charts, heatmap.

**Reminder/check-in:** Per-habit time-of-day notification. Batch morning summary available.

**What it does especially well:**
- Time-of-day grouping reduces decision fatigue — you know what's expected when
- Completion notes enable reflection without a journal
- Clean minimal UI matches MBQ aesthetic

**What to copy:**
- Time-of-day grouping in habit list — MBQ already has `timeOfDay` field, just needs visual grouping
- Per-completion note field (already exists as `notes` on Habit)
- Batch morning summary view

**What to avoid:**
- The analytics overload in premium tier — start simpler

---

### Fabulous (cross-platform)

**Core concept:** Behavior change through ritual sequencing. Habits are grouped into "rituals" (morning, afternoon, evening routines). Journeys guide gradual habit introduction.

**Goal/habit model:**
- Habits are steps inside a ritual (ordered list, not independent checklist)
- Journeys = structured programs (e.g., "Build a morning ritual in 30 days")
- No explicit goal object — life improvement is the implicit goal

**Progress visualization:** Ritual timer (count up through steps), completion ring.

**Reminder/check-in:** Single "start your morning ritual" notification at a set time.

**What it does especially well:**
- Ritual sequencing (do A then B then C) creates strong contextual cues — the completion of each step prompts the next
- Gradual onboarding ("Journeys") prevents overwhelm
- Emotional/motivational copy and voiceovers add warmth — science-backed framing throughout

**What to copy:**
- The "ritual" concept: allow habits to be grouped into an ordered morning/evening routine (sequenced checklist). This is a v2 feature.
- "Why" field on habits — MBQ already has this
- Gradual onboarding: suggest starting with 1-3 habits, not a full list

**What to avoid:**
- Subscription cost/locked content without clear value
- Voiceover/animation complexity — out of scope for MBQ

---

### Streaks (iOS)

**Core concept:** Radical minimalism. Up to six habits max. Tap a circle to complete. Apple Watch first. Won Apple Design Award.

**Goal/habit model:**
- Six habits maximum — intentional constraint
- Yes/no only (binary completion)
- Smart notifications: learns your typical completion time, schedules reminders accordingly

**Progress visualization:** Six circles. Streak number below. Widgets.

**What it does especially well:**
- The constraint is the product — limits reduce decision fatigue and prevent over-commitment
- Smart notification timing (learns behavior) reduces alarm fatigue
- Frictionless check-in: one tap per habit

**What to copy:**
- Consider a soft cap on active habits — suggest ≤ 5 active (same Slow Productivity spirit as task cap of 3)
- Smart notification timing (learn from completion history) — v2
- One-tap check-in from dashboard/widget is critical

**What to avoid:**
- Hard limit of exactly six is too inflexible for MBQ's power users

---

### Griply (cross-platform)

**Core concept:** All-in-one goal planner + habit tracker + task manager with life areas and timeline roadmap.

**Goal/habit model:**
- Goal = title + life area + deadline + incremental progress tracking + infinite sub-goals
- Habits linked to goals
- Goal Timeline = Gantt-style roadmap of goals across years
- Calendar integration shows habits on calendar

**Progress visualization:** Progress bars per goal, life area summary, quarterly/yearly views.

**What it does especially well:**
- Incremental progress input (add a number, not replace total) reduces friction for ongoing targets
- Infinite sub-goals handles complex long-term goals well
- Goal Timeline is compelling for life planning

**What to copy:**
- Incremental progress (tap "+10 pages read" vs. setting total manually) — useful for Target-type goals
- Sub-goals / milestones within a goal — v2 for MBQ
- Calendar overlay for habits — v2

**What to avoid:**
- Feature bloat — MBQ should stay focused

---

### TickTick (cross-platform)

**Core concept:** Full task manager with integrated habit tracking (Habit module). Strong calendar + focus timer integration.

**Goal/habit model:**
- Habits are recurring tasks with check-in and streak
- Habit stats: 30-day view, completion rate, streak
- Goals are represented as "projects" with milestones

**What it does especially well:**
- Deep integration with tasks and calendar means habits live alongside work — no app switching
- Pomodoro integration on habits (MBQ already has this pattern)

**What to copy:**
- Habit check-in directly from task/today view — already in MBQ
- Completion rate % next to streak (less fragile metric)

**What to avoid:**
- Subscription required for habits (access issue)

---

## 3. What Makes Effective Habits & Goals UX

### Proven patterns (evidence or wide consensus)

1. **Self-monitoring improves attainment** — any form of visible progress tracking works; richer is not always better. (Harkin et al.)
2. **Streaks motivate but shame is destructive** — EMA score or percentage is safer than hard reset streak counters.
3. **Time-of-day grouping reduces decision fatigue** — morning/afternoon/evening segments are widely adopted because they work.
4. **Tiny, easy habits > ambitious habits** — ability (ease) beats motivation for consistency. (Fogg)
5. **Implementation intentions** — "when I wake up, I will meditate" is twice as effective as "I will meditate." Anchor field in habits supports this.
6. **Goal-habit linkage** — knowing a habit feeds a goal increases intrinsic motivation. MBQ already has `goalId` on Habit.
7. **Weekly review cadence** — GTD and OKR literature agrees: weekly reflection is the optimal cadence for most goals. MBQ has WeeklyReviewScreen.
8. **Immediate micro-celebration** — Fogg: emotion at moment of completion wires the habit faster than delayed rewards.
9. **Progress principle** — surface small wins (Teresa Amabile); daily completion creates sense of forward movement.
10. **Non-daily frequencies** — forcing daily framing on naturally weekly habits creates false failure. Schedule flexibility is essential.

### Anti-patterns to avoid

- **Streak-loss shame** — aggressive loss framing; seeing a reset counter without context
- **Notification overload** — one-per-habit aggressive reminders; batch or smart timing only
- **Complexity overload at onboarding** — asking for goal + area + why + horizon + milestones before the user sees any value
- **Leaderboards** — social comparison pressure violates MBQ's Slow Productivity ethos
- **Progress bars that move too slowly** — a goal with 50 linked tasks shows 2% per task; demotivating

---

## 4. Recommended Terminology for MBQ

| What users call it | MBQ label | Notes |
|-------------------|-----------|-------|
| Routine / ritual | **Habit** | Keep. Familiar term. |
| Target / outcome | **Goal** | Keep. Clear and universal. |
| Sub-step / task toward a goal | **Task** (linked) | Keep current model |
| Milestone | **Milestone** (v2) | Add as goal sub-progress markers |
| Life domain | **Area** | Keep (already `cat`) |
| Time horizon | **Horizon** | Keep |
| Strength/adherence | **Strength** | Use EMA score — show as subtle bar or %, not streak |

---

## 5. Recommended Data Model Extensions

### Goal (additions to existing `Goal` type)

```typescript
interface Goal {
  // existing
  id: string
  title: string
  area: string
  horizon: string
  progress: number    // 0.0–1.0
  why: string
  linked: string[]    // linked task IDs

  // recommended additions
  status?: 'active' | 'paused' | 'achieved' | 'dropped'
  targetDate?: string           // YYYY-MM-DD — enables pace line
  targetValue?: number          // for Target-type goals (e.g. "read 24 books")
  currentValue?: number         // incremental progress for Target-type
  unit?: string                 // "books", "kg", "km", "hours"
  milestones?: Milestone[]      // v2: ordered sub-steps
  completedAt?: number          // ms timestamp when marked achieved
  createdAt?: number
  updatedAt?: number
}

interface Milestone {           // v2
  id: string
  title: string
  done: boolean
  doneAt?: number
}
```

### Habit (additions to existing `Habit` type)

```typescript
interface Habit {
  // existing fields are solid — additions only:

  // already present, confirm implementation:
  // strength: number (EMA 0.0–1.0) — update on each completion/miss
  // timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime'
  // why: string
  // goalId: string
  // isArchived: boolean

  // recommended additions:
  targetCount?: number          // for non-binary habits (e.g. "drink 8 glasses")
  unit?: string                 // "glasses", "pages", "minutes"
  color?: number                // hue override for heatmap; defaults to cat hue
  sortOrder?: number            // manual reorder within time-of-day group
  completionNote?: string       // last check-in note (surface in analytics)
  pausedUntil?: string          // YYYY-MM-DD — "I'm on holiday" grace period
}
```

### HabitLog (confirm schema in db.ts)

```typescript
interface HabitLog {
  id: string
  habitId: string
  date: string       // YYYY-MM-DD
  value?: number     // for quantitative habits
  note?: string      // per-completion reflection
  createdAt: number
}
```

---

## 6. Suggested IA for Goals & Habits Area

### Goals Screen

```
GoalsScreen
├── Header: "Goals" + count + overall progress bar
├── Hero bar: active / on-track / near-deadline chips
├── Filter: All | Active | Achieved | by Area
├── Goal cards (grouped by Area OR Horizon)
│   ├── Title + horizon pill + area color chip
│   ├── Progress bar (auto-synced from linked tasks)
│   ├── Pace indicator (if targetDate set): "on track" | "behind" | "ahead"
│   └── Linked task fraction (e.g. "3/8 tasks done")
└── FAB: Add Goal
```

### Goal Detail Screen

```
GoalDetailScreen
├── Area color header strip
├── Title (editable inline)
├── Why statement (editable, italic display)
├── Horizon pill + (if targetDate) target date chip
├── Progress section
│   ├── For boolean goals: progress bar (from linked tasks)
│   ├── For Target-type: currentValue / targetValue with +N button
│   └── Pace line (if targetDate): "X% complete, need Y% to stay on pace"
├── Milestones section (v2): ordered checklist
├── Linked Tasks list: tap to navigate to TaskDetail
│   └── "Add task to this goal" shortcut
├── Linked Habits (v1.5): habits with this goalId shown here
└── Danger zone: Pause / Mark Achieved / Delete
```

### Habits Screen

```
AllHabitsScreen (or HabitsScreen)
├── Header: "Habits" + today's completion fraction (e.g. "4/7")
├── Today's check-in section (primary view)
│   ├── Morning (grouped)
│   │   └── Habit row: strength dot + title + check button
│   ├── Afternoon (grouped)
│   ├── Evening (grouped)
│   └── Anytime (grouped)
├── Strength overview (secondary / scroll)
│   └── Compact bar per habit showing EMA strength 0–100%
└── Quick-add habit button
```

### Habit Detail Screen

```
HabitDetailScreen
├── Title + area chip + timeOfDay selector
├── Why statement
├── Linked Goal chip (if goalId set)
├── Schedule: frequency picker (daily / weekdays / weekends / Nx/week / custom)
├── Reminder time
├── Strength gauge: "You're at X% strength — keep going"
├── Heatmap (last 3 months)
├── Streak stats: current / best (compassionate framing — no shame copy)
└── Archive / Delete
```

### Habit Analytics Screen

```
HabitAnalyticsScreen (existing, enhance)
├── Overall adherence rate this week / month
├── Best habit (highest strength)
├── Needs attention (lowest strength + has reminder set)
├── Per-habit strength bar list (sortable)
└── Insights: "You're most consistent in the mornings"
```

---

## 7. Compassionate Streak / Strength Implementation

### EMA Strength Score (implement in db.ts `resetHabits` and completion handler)

Loop Habit Tracker's algorithm is the gold standard for compassionate tracking:

```typescript
// On daily reset (midnight or app open next day):
// For each habit, calculate whether yesterday was a "scheduled day":
//   - If scheduled and completed: score += (1 - score) * ALPHA
//   - If scheduled and missed:    score -= score * ALPHA  
//   - If not scheduled:           score unchanged

const ALPHA = 0.1   // smoothing factor — miss one day barely moves the needle

// Perfect daily habit reaches:
//   80% strength after ~1 month
//   96% after ~2 months  
//   99% after ~3 months

// This means a new habit starts weak and earns strength gradually.
// One missed day on a 3-month habit drops score by ~1.5%, not to zero.
```

### Streak Display (compassionate framing)

- Show current streak as secondary information, not primary metric
- Show strength score as the primary indicator
- Copy: "X-day current run" not "X-day streak" (less shame connotation)
- On missed day: show "Habit paused — welcome back" not "Streak broken"
- Best streak preserved and displayed separately (already in schema)
- Offer a "Grace Day" mechanic: one missed day per 14 does not count (v2)

### Soft Caps (Slow Productivity for Habits)

- Suggest ≤ 5 active daily habits (surface a soft warning when user adds a 6th)
- Frame as: "Research shows fewer habits = higher completion rate. Consider mastering these before adding more."
- Not a hard block — just a nudge

---

## 8. Weekly Review Integration

### What to surface in WeeklyReviewScreen for Goals & Habits

```
Goals section:
- Goals made progress this week (list with delta)
- Goals with no activity (gentle flag)
- Overdue targets (if targetDate model adopted)

Habits section:
- Completion rate this week vs last week
- Highest-strength habit (celebrate)
- Habit that needs attention (lowest completion rate, has reminder)
- "Any habits to archive or replace?" prompt

Reflection prompts (1-3, not exhaustive):
- "What made your best habit easy this week?"
- "What got in the way of [weakest habit]?"
- "Is any goal still meaningful to you?"
```

---

## 9. V1 vs V2 Feature Set

### V1 (ship now — foundation)

**Goals:**
- [x] Title, area, horizon, why, progress (already done)
- [ ] `status` field: active / achieved / dropped (small schema addition)
- [ ] Pace indicator: if `targetDate` set, show on-track / behind / ahead
- [ ] Goal cards: show linked habit count (not just task count)
- [ ] "Mark as Achieved" flow with celebration moment

**Habits:**
- [x] Heatmap, analytics screen, streak, strength field (already done)
- [ ] Implement EMA algorithm for `strength` field (confirm it's actually EMA or fix)
- [ ] Time-of-day grouping in AllHabitsScreen (timeOfDay field exists — use it)
- [ ] Frequency options: expand to include 3x/week, every other day, etc.
- [ ] Compassionate streak copy ("welcome back" on resumption)
- [ ] Soft active habit cap nudge (≥ 6 warning)
- [ ] Pause mechanic: archive with `pausedUntil` date

**Weekly Review:**
- [x] WeeklyReviewScreen exists
- [ ] Add Goals + Habits summary section to review flow

### V2 (next sprint — depth)

**Goals:**
- Target-type goals: `targetValue` + `currentValue` + `unit` + incremental +N button
- Milestones: ordered sub-steps within a goal
- Goal Timeline: Gantt-style roadmap view
- Pace line chart (visual progress vs. schedule)

**Habits:**
- Ritual/sequence mode: ordered morning routine checklist
- Habit stacking: "anchor" field — "After I [X], I will [Y]"
- Quantitative habits: value logging (e.g. "8 glasses of water")
- Smart notification timing (learn from completion history)
- Grace Day mechanic (1 miss per 14 doesn't count)
- Calendar overlay for habit instances

---

## 10. Onboarding Recommendations

**Goals onboarding (first use):**
1. One question: "What's something you're working toward right now?"
2. Pre-fill area from their response (ML or keyword heuristic)
3. Ask why: "What would change if you achieved this?"
4. Skip horizon for now — default to "12 weeks"
5. Suggest linking a task: "Want to add the first step?"

**Habits onboarding (first use):**
1. Suggest 3 starter habits from evidence-backed keystone list:
   - Morning: "Drink a glass of water when I wake up"
   - Movement: "Walk for 10 minutes"
   - Wind-down: "Write one thing I'm grateful for before sleep"
2. Frame as tiny: "Start small — you can always do more"
3. Ask time of day, not reminder time (simpler)
4. Let them check in immediately — first win is immediate

---

## 11. Sources & Confidence

| Claim | Source | Confidence |
|-------|--------|------------|
| EMA score mechanics | Loop Habit Tracker docs + GitHub | HIGH |
| Harkin et al. self-monitoring meta-analysis | PMC / academic citation in search results | HIGH |
| Fogg Behavior Model (B=MAP) | Stanford Behavior Design Lab (easyhabits.io summary, PMC article) | HIGH |
| Habit stacking +64% study | "2025 Journal of Applied Psychology" via WebSearch | MEDIUM (cited second-hand) |
| Fabulous Duke origin | Multiple sources (thefabulous.co, medium articles) | HIGH |
| Duolingo streak UX outcome (+40% 7-day streak users) | UX Magazine via WebSearch | MEDIUM |
| Streaks app six-habit philosophy | MacStories review, streaksapp.com | HIGH |
| Griply feature set | griply.app changelog, App Store listing | HIGH |
| Strides tracker types | stridesapp.com, AppleInsider review | HIGH |

---

## Sources (external links)

- [Loop Habit Tracker GitHub](https://github.com/iSoron/uhabits)
- [Strides App](https://www.stridesapp.com/)
- [Griply changelog 2025](https://griply.app/changelog/2025-recap)
- [Fabulous behavioral science case study (Medium)](https://medium.com/@preciousebunoluwaa/how-fabulous-turns-habits-into-rituals-a-case-study-in-behavior-design-51b3ae18ffd3)
- [Compassionate habit UX (Holly Lau)](https://hollylau.com/designing-with-compassion-rethinking-wellness-apps-beyond-streaks-and-checklists/)
- [Tiny Habits — BJ Fogg (EasyHabits summary)](https://www.easyhabits.io/blog/tiny-habits-bj-fogg)
- [Habit stacking — James Clear](https://jamesclear.com/habit-stacking)
- [Streaks 6 MacStories review](https://www.macstories.net/reviews/streaks-6-brings-habit-tracking-to-your-home-screen-with-extensively-customizable-widgets/)
- [Habitica gamification case study](https://trophy.so/blog/habitica-gamification-case-study)
- [Designing for Mental Health — UXmatters](https://www.uxmatters.com/mt/archives/2023/06/designing-for-mental-health-creating-user-experiences-that-support-well-being.php)
- [Best habit tracker apps overview — Zapier](https://zapier.com/blog/best-habit-tracker-app/)
- [Best goal tracker apps — Reclaim](https://reclaim.ai/blog/goal-tracker-apps)
