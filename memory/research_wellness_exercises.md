# MBQ Wellness Screens — Product Strategy Research

**Date:** 2026-05-19
**Scope:** Four stub screens — CBT Toolkit, Mindfulness Exercises, Positive Psychology, Neuroplasticity
**Constraint:** Interventions must be brief (<5 min), repeatable (daily/weekly), and trackable.

---

## 1. CBT Toolkit

### Best Evidence-Supported Exercises

| Exercise | Evidence Level | Brief Summary |
|---|---|---|
| **Thought Record (3-column)** | HIGH — cornerstone of CBT; meta-analysis of 269 RCTs [1] | Situation → automatic thought → cognitive distortion label |
| **Cognitive Reappraisal / Restructuring** | HIGH — direct mechanism of symptom reduction [2] | Identify distortion, generate alternative thought |
| **Behavioral Activation (activity scheduling)** | HIGH — strong evidence for depression [1] | Schedule one pleasant or meaningful activity today |
| **Worry Time** | MEDIUM — recommended in GAD protocols | Contain rumination by deferring it to a scheduled 10-min slot |
| **Safety Behavior Audit** | MEDIUM | Check what avoidance patterns appeared today |

The most compact v1 intervention: **5-column thought record** (situation, emotion, automatic thought, distortion type, balanced thought). A 2023 Springer study showed AI-assisted thought records on smartphones improve restructuring quality — the structured prompt scaffold is the key UX affordance [3].

**What to avoid:**
- Full 7-column Beck thought records — too cognitively demanding for a stressed user mid-day.
- Generic "journal" free text with no CBT structure — no evidence it produces reappraisal.
- Mood questionnaires (PHQ-9, GAD-7) as daily exercises — valid for screening, not intervention.
- Gamifying with "score" on thought quality — clinically counterproductive.

### Best Apps to Learn From

- **Woebot:** Conversational check-in → mood label → situation → thought challenge. The chatbot persona lowers defensiveness. Daily push notification framed as "check in with a friend" [4].
- **Sanvello (formerly Pacifica):** Clean thought record UI with distortion chip-select. Shows mood-over-time graph tied to entries.
- **MoodKit:** Pure tool — no gamification. Respects user as adult. Four tools: Activities, Mood, Thoughts, Journal.
- **Daylio:** Mood + activity tracking with streak. Minimal friction — icon-tap log.

**UX patterns worth copying:**
- Chip-select for emotion labels (faster than free text)
- Distortion type presented as a short named list with one-line definition
- Completion state = entry saved (binary, not rated)
- Optional "what would a friend say?" prompt as reappraisal scaffold

### Minimum Viable Interaction

1. Tap "Log a thought" from Today screen
2. Situation (1-2 sentences, free text)
3. Emotion + intensity (chip + slider)
4. Automatic thought (free text)
5. Distortion tag (chip from list of 10)
6. Alternative thought (free text, optional nudge prompt)

Time: 3–4 minutes. Saves as a thought record entry. Completion marks day done.

### v1 vs v2

**v1:**
- Thought record (simplified 5-step)
- Behavioral activation: "Schedule one activity" daily prompt
- Distortion library (10 types with definitions, accessible from thought record)
- Entry history with mood trend graph

**v2:**
- Worry time timer + deferred worry list
- Safety behavior check-in
- Patterns detection (which distortions appear most)
- Psychoeducation modules (10 short lessons on CBT concepts)
- AI-assisted reappraisal suggestion (GPT prompt to generate alternatives)

---

## 2. Mindfulness Exercises

### Best Evidence-Supported Exercises

| Exercise | Evidence Level | Format |
|---|---|---|
| **Focused Attention (breath)** | HIGH — Headspace RCT [5], Calm RCT [6] | 5–10 min guided audio |
| **Body Scan** | HIGH — MBSR protocol | 10 min; beginners need guided audio |
| **Mindful Breathing (box / 4-7-8)** | HIGH — parasympathetic activation, immediate effect | 2–4 min, animated visual |
| **STOP technique** | MEDIUM — used in MBCT | Single micro-pause: Stop, Take a breath, Observe, Proceed |
| **Urge Surfing** | MEDIUM — ACT/mindfulness for cravings | 5 min body-sensation observation |
| **Mindful Walking prompt** | MEDIUM | Cue-based: "Notice 5 things on your next walk" |

A 2024 University of Southampton RCT found 10 minutes of daily mindfulness practice boosts wellbeing and reduces depression [7]. A 2019 Calm RCT (college students) and a 2025 Headspace observational study of 73,000+ members with moderate/severe stress both show significant stress reduction from app-based practice [5][6].

**What to avoid:**
- Unguided silence for beginners — high dropout.
- Long sessions (>15 min) as default — completion rate drops sharply.
- "Clear your mind" framing — incorrect and discouraging. Frame as "notice thoughts and return."
- Streaks with hard penalty for missing a day — known to cause anxiety and abandonment.

### Best Apps to Learn From

- **Headspace:** "Today" tab with morning/afternoon/evening content slots. 5-min mindful break course for new users. Animated visualizations during breathing. Progress shown as "minutes practiced."
- **Calm:** Curated Daily Calm (10-min daily session). Sleep Stories as adjacent content. Strong brand on "moment of calm" rather than "training."
- **Insight Timer:** Community + free content. Teacher-led sessions feel more human.
- **Ten Percent Happier:** Heavier emphasis on explaining the "why" — suits skeptical users.

**UX patterns worth copying:**
- Time-of-day-aware prompt: morning = energizing breath, evening = body scan
- Animated breathing guide (expanding/contracting circle) removes need for audio
- Session timer with ambient sound as option
- "Minutes practiced this week" as progress unit (more meaningful than streaks)

### Minimum Viable Interaction

Option A (guided): Tap → choose duration (3 / 5 / 10 min) → audio or animated guide plays → completion logged.
Option B (micro): STOP technique card — single tap → 60-second animated breath guide → done. No audio required.

Both should complete in one action with no decision tree beyond duration.

### v1 vs v2

**v1:**
- Guided breathing exercise (box breath, 4-7-8) with animated visual — no audio dependency
- Body scan (text-guided, user controls pacing with "Next" taps)
- STOP micro-moment card (60 seconds)
- Session log: date + duration + type

**v2:**
- Audio guided sessions (requires recording or licensed library)
- Urge surfing exercise
- Mindful walking prompt (push notification at walk-scheduled time)
- Mood before/after capture
- Minutes-practiced weekly summary

---

## 3. Positive Psychology Exercises

### Best Evidence-Supported Exercises

| Exercise | Evidence Level | Notes |
|---|---|---|
| **Three Good Things (3GT)** | HIGH — Seligman et al. original [8]; RCT in healthcare workers [9] | Daily evening reflection on 3 positive events + why they happened |
| **Signature Strengths (new use)** | HIGH — VIA-IS study; 162 RCTs, 33,032 participants [10] | Identify top strength, use in a new way this week |
| **Savoring** | MEDIUM-HIGH — multiple studies | Pause and fully attend to a positive experience |
| **Best Possible Self** | MEDIUM — qualitative mechanisms identified [11] | Write about your ideal future self for 15 min |
| **Acts of Kindness** | HIGH — kindness strength RCT [10] | Do one small deliberate kind act and record it |
| **Gratitude Letter** | MEDIUM — one-time boost effect | Write and optionally deliver a letter to someone |

**Key evidence note:** A 2025 synthesis of 21 systematic reviews and 162 RCTs found kindness, humor, hope, perspective, and gratitude interventions have the strongest evidence for increasing well-being [10]. Three Good Things has been shown to reduce emotional exhaustion and depressive symptoms in healthcare workers in a formal RCT [9].

**What to avoid:**
- Forced positivity framing ("Today is GREAT!") — backfires, especially for users with depression.
- Gratitude journaling without "why" component — the causal reflection is the active ingredient, not just listing.
- Best Possible Self as daily exercise — too cognitively demanding; suits weekly use only.
- Overclaiming long-term effects — most studies show 1–4 week effects; maintenance requires continued practice.

### Best Apps to Learn From

- **Happify:** Games built on positive psychology constructs (gratitude, savoring, kindness). Uses "tracks" (goal areas) to contextualize exercises. Avoids feeling like homework. Strongest model for making PPIs feel enjoyable without being trivial [4].
- **Reflectly:** AI journaling with mood → daily prompts drawn from positive psychology. Clean, minimal.
- **Shine:** Affirmation + reflection hybrid. Good for self-compassion entry point.
- **Daylio:** Mood tracking as passive data layer — shows what activities correlate with good mood.

**UX patterns worth copying:**
- Time-boxed "track" framing (e.g., "7-day gratitude experiment") — reduces indefinite commitment anxiety
- 3GT prompt as evening notification: "What went well today?"
- Strengths: brief VIA-style quiz first, then daily "use your strength" prompts matched to result
- Progress shown as "days practiced" not performance score

### Minimum Viable Interaction

**3GT:** Notification at 8pm → tap → three text fields ("What went well?") with optional "Why?" sub-prompt → save. Time: 2–3 minutes.

**Strengths use:** Weekly prompt on Monday: "Your top strength is [X]. How could you use it today?" → freetext response → save.

### v1 vs v2

**v1:**
- Three Good Things (evening daily, notification-driven)
- Strengths identification (one-time 10-question quiz, surfaces top 3) + weekly "use it" prompt
- Acts of Kindness log (tap to record a kind act, optional note)

**v2:**
- Savoring exercise (photo + reflection on a positive moment)
- Best Possible Self (guided 15-min weekly writing session)
- Gratitude letter composer
- Mood–activity correlation view (which activities cluster with good days?)
- Personalized "track" framing (choose a focus: relationships, work, health)

---

## 4. Neuroplasticity Exercises

### The Evidence Problem

**Critical caveat:** The brain-training industry's claims substantially outpace evidence. A 2025 Springer meta-analysis found computerized brain training has limited cognitive benefits in healthy aging, and transfer effects (gains in trained tasks transferring to real-world function) are few and hard to replicate [12]. A 2023 review found that most BrainHQ/Lumosity studies showing transfer are either industry-funded or confounded by practice effects [12].

**What actually has robust evidence for neuroplasticity:**
- Aerobic exercise (BDNF increase, hippocampal neurogenesis) [13]
- Learning genuinely new skills (language, music, novel motor sequences) [14]
- Quality sleep (synaptic consolidation) — habit reminders are tractable
- Mindfulness meditation (structural changes in prefrontal cortex after 8 weeks)
- Social engagement (cognitive complexity of social interaction)

**What has weak/contested evidence:**
- N-back working memory games (specific task improvement, minimal transfer)
- Generic "brain puzzles" / sudoku / crosswords (familiarity reduces challenge)
- Commercial brain training packages as sold

### Best Evidence-Supported Exercises (Reframed)

| Exercise | Evidence Level | Notes |
|---|---|---|
| **Aerobic movement habit** | HIGH — systematic review [13] | Even 20 min walk raises BDNF, improves executive function |
| **Learning a new skill (micro-dose)** | HIGH — structural plasticity [14] | 5 min on Duolingo, new chord, new recipe — novelty is the signal |
| **Sleep hygiene habit** | HIGH | Wind-down checklist is trackable |
| **Mindful attention practice** | HIGH | Overlaps with mindfulness screen — dual entry point |
| **Dual n-back (with caveats)** | LOW-MEDIUM — some working memory gains, minimal transfer [12] | If included, must be framed as training one specific skill, not "brain health" |
| **Creative challenge (novel output)** | MEDIUM | Drawing, writing from a prompt, improvising — forced novelty |

### Best Apps to Learn From

- **Elevate:** Vocabulary, reading, math drills. Good UX: 3 mini-games per day, tracked daily streaks, skill radar chart. No overclaiming. Honest "you're getting better at this task."
- **Duolingo:** Best-in-class habit loop. Variable reward, streak mechanic, clear daily goal. Novelty/difficulty scaling.
- **Peak:** Tracks cognitive areas (memory, attention, etc.) with mini-games. Has a "coach" that assigns daily sessions.
- **BrainHQ:** Strongest evidence among commercial apps (ACTIVE trial), but dense UI, old design.

**UX patterns worth copying from Elevate/Duolingo:**
- Fixed daily session (3–5 exercises) with clear "Done for today" state
- Skill radar or area breakdown (gives sense of coverage vs. rut)
- Adaptive difficulty — exercise gets harder as you improve (this is the mechanism, not the game itself)
- Honest framing: "Practice [specific skill]" not "boost your brain"

### What MBQ Should (and Shouldn't) Build

**Honest positioning is a differentiator.** Most brain-training apps overclaim. MBQ should frame Neuroplasticity as a lifestyle habits screen, not a game suite:
- Track: Did I move today? Did I learn something new? Did I sleep well?
- Educate: Short explanations of what each habit actually does neurologically.
- Prompt novel challenge: Weekly "try something new" challenge card.

Do not build a mini-game suite — too much engineering, overclaiming, and the evidence is weak.

### Minimum Viable Interaction

Daily checklist, 3 items:
1. "Did you move for at least 15 minutes?" (tap yes/no)
2. "Did you learn or practice something new?" (tap yes + optional note)
3. "Did you get 7+ hours of sleep last night?" (tap yes/no)

Optional weekly: "This week's novel challenge" card (pre-written prompt, e.g., "Cook a recipe you've never made," "Write a haiku," "Learn 5 words in a new language").

### v1 vs v2

**v1:**
- Daily habit checklist (move, learn, sleep — 3 binary taps)
- Weekly novel challenge card (static set of ~30 rotating prompts)
- Streak for the checklist
- One-paragraph "why this matters" for each habit (expandable)

**v2:**
- Integration with HealthKit / Google Fit for automatic movement detection
- Cognitive journaling (reflect on what you learned this week — free text)
- Mini skill-tracking (user adds their own skill: "guitar practice" → logs minutes)
- Psychoeducation course: "How your brain changes" (5 short lessons)
- Sleep input connected to wakeup time capture

---

## Cross-Cutting Implementation Principles

### Shared UX Conventions

**1. One completion state per day per category.**
Each screen should produce a single binary "done today" outcome. Do not require multiple completions within a category. The user's cognitive load is already high — a single tap-able daily commitment is the target.

**2. Prompt-driven entry, not blank-canvas.**
Every free-text field should have a placeholder prompt that scaffolds the type of response expected. "What situation triggered this feeling?" outperforms "Write your thought." Blank boxes produce blank stares.

**3. Notification framing matters.**
- CBT: "Had a rough moment? Take 3 minutes to examine it."
- Mindfulness: "Time for your daily pause. 5 minutes." (time-of-day aware)
- Positive Psychology: "What went well today?" (evening only)
- Neuroplasticity: "Did you move, learn, and sleep well?" (morning check-in)
Avoid generic "Open app!" push notifications. Content-specific prompts have 2–3x higher open rates.

**4. Avoid performance scoring.**
Do not rate journal entries, score thought records, or rank mindfulness "quality." It induces performance anxiety and is clinically counterproductive. Completion = success.

**5. Streak mechanics: soft, not punitive.**
Show streaks as a positive indicator. Never show a red broken streak or count "days since last practice." Compassionate framing: "You've practiced 4 of the last 7 days. That's real progress."

**6. Progressive disclosure of depth.**
Show the 1-sentence version of each exercise. "Learn more" expands to the evidence basis. Users who want to know the science can find it; users who just want to do the thing aren't slowed down.

**7. Time estimates on every session.**
"~3 min" next to every exercise entry point. Users are more likely to start when they know it will end.

### Data Model Hints

```
WellnessEntry {
  id: string
  date: string          // YYYY-MM-DD — one per day per category
  category: 'cbt' | 'mindfulness' | 'positive-psychology' | 'neuroplasticity'
  exerciseType: string  // e.g. 'thought-record', 'breathing', '3gt', 'habit-checklist'
  durationSeconds: number | null
  content: Record<string, string>  // flexible key-value for entry fields
  completedAt: timestamp
}
```

- Store all four categories in one `wellnessEntries` table (flexible `content` blob avoids premature schema lock-in for v1).
- One entry per day per category is the natural query unit.
- Streak = count consecutive days with `completedAt` in each category.
- Sync via existing Supabase outbox (same pattern as tasks/habits).

### Shared Components (Design Once)

- `<WellnessPrompt>` — card with title, subtitle, time estimate, start button
- `<StepWizard>` — multi-step exercise flow (situation → emotion → thought → ...)
- `<CompletionBadge>` — "Done today" overlay state
- `<StreakDisplay>` — days practiced / this week view
- `<ChipSelect>` — multi-select chips for emotion labels, distortion types
- Animated breathing circle component (CSS animation, no library needed)

### v1 Scope Recommendation

Ship all four screens in the same sprint, each with exactly ONE core exercise:

| Screen | v1 Core Exercise | Est. Complexity |
|---|---|---|
| CBT Toolkit | 5-step thought record | Medium (multi-step form + distortion chips) |
| Mindfulness | Animated breathing guide (3/5/10 min) | Low-Medium (animation + timer) |
| Positive Psychology | Three Good Things (evening prompt + 3 fields) | Low |
| Neuroplasticity | Daily habit checklist (3 taps) | Low |

This gives every screen a real, evidence-backed, completable interaction. It avoids scope creep. It builds the shared data model and shared components in one pass. All four can share one `WellnessEntry` table and one set of UI primitives.

Resist adding more exercises until you have usage data showing completion rates on the first one. The most common mistake in wellness apps is building 20 features and watching users bounce off all of them because there is no clear default action.

### What to Avoid (Across All Four)

- **No mandatory onboarding quiz before accessing exercises.** Let users try the exercise first, profile later.
- **No AI-generated content in v1.** Adds latency, cost, and trust risk. Static scaffold prompts are sufficient.
- **No social features (sharing streaks, leaderboards).** Mental health data is private. Violating that expectation kills trust immediately.
- **No clinical language in UI copy.** "Cognitive distortion" in a label = fine. "You may have a cognitive disorder" = out of scope and harmful.
- **No dark patterns around subscription upsell tied to exercise completion.** If MBQ goes freemium, the core daily exercises must remain free. Paywalling the active ingredient destroys the health outcome and the trust.

---

## Sources

1. [CBT meta-analysis via digital apps — npj Digital Medicine 2026](https://www.nature.com/articles/s41746-026-02466-z)
2. [Cognitive Reappraisal — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1077722922000505)
3. [AI-assisted thought records on smartphone — Cognitive Therapy and Research 2023](https://link.springer.com/article/10.1007/s10608-023-10411-7)
4. [Woebot engagement patterns — One Mind PsyberGuide](https://onemindpsyberguide.org/apps/woebot/)
5. [Headspace RCT — Annals of Behavioral Medicine 2025](https://academic.oup.com/abm/article/59/1/kaaf025/8116836)
6. [Calm RCT college students — JMIR mHealth 2019](https://mhealth.jmir.org/2019/6/e14273/)
7. [10 minutes daily mindfulness boosts wellbeing — University of Southampton 2024](https://www.southampton.ac.uk/news/2024/08/just-ten-minutes-of-mindfulness-daily-boosts-wellbeing-and-fights-depression-study-reveals.page)
8. [Three Good Things original / gratitude app RCT — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9540053/)
9. [3GT RCT in healthcare workers — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10202508/)
10. [Synthesis of 21 systematic reviews on strengths/virtues — Wiley Applied Psychology 2025](https://iaap-journals.onlinelibrary.wiley.com/doi/10.1111/aphw.70069)
11. [Best Possible Self qualitative mechanisms — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6524817/)
12. [Computerized brain training limited benefits — Springer 2025](https://link.springer.com/article/10.1007/s00426-025-02110-7)
13. [Aerobic exercise and neuroplasticity systematic review — PMC 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10932589/)
14. [Cognitive and brain plasticity from physical exercise and cognitive training — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5949345/)
