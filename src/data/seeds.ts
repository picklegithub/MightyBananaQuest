import type { Task, Goal, JournalEntry, InboxItem, CopingCard } from '../types'

export const SEED_TASKS: Task[] = []

export const SEED_GOALS: Goal[] = []

export const SEED_JOURNAL: JournalEntry[] = []

export const SEED_INBOX: InboxItem[] = []

const now = Date.now()

export const SEED_COPING_CARDS: CopingCard[] = [

  // ── Anxiety (6) ────────────────────────────────────────────────────────────
  // Techniques: Beck Socratic, Anxiety wave/exposure, ACT defusion, Behavioural experiments, ACT willingness, Interoceptive exposure
  {
    id: 'cc-anxiety-1',
    title: 'Check the evidence',
    content: "Technique: Socratic questioning (Aaron Beck, Cognitive Therapy).\n\nYour brain has filed a threat prediction — but predictions are not facts. Ask:\n• What's the actual evidence for this thought?\n• What's the evidence against it?\n• What would I tell a friend thinking this?\n• What's the realistic outcome, not the worst case?\n\nWrite down one answer. The act of externalising it slows the threat circuit.",
    category: 'anxiety',
    isDefault: true,
    isPinned: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-anxiety-2',
    title: 'The anxiety wave',
    content: "Technique: Exposure and response prevention (Foa & Kozak, 1986).\n\nAnxiety is a wave, not a wall. Research shows that if you stay with the feeling without avoiding or escaping, it peaks and drops within 20–45 minutes — every single time.\n\nYou don't fight it. You surf it.\n\nNote the peak intensity (0–10). Watch it change. Each time you ride it without escaping, the next wave is smaller.",
    category: 'anxiety',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-anxiety-3',
    title: 'Name it to tame it',
    content: "Technique: Cognitive defusion (Steven Hayes, Acceptance & Commitment Therapy).\n\nfMRI research (Lieberman et al., 2007) shows that labelling an emotion reduces amygdala activation.\n\nInstead of 'I am anxious', say:\n→ 'I notice I'm having the thought that something bad will happen.'\n→ 'My mind is doing its catastrophe thing again.'\n\nYou are not the thought. You are the one observing it. A little distance changes everything.",
    category: 'anxiety',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-anxiety-4',
    title: 'Predict, then test',
    content: "Technique: Behavioural experiment (Clark & Wells, CBT for anxiety).\n\nAnxiety survives on untested predictions. You can run a mini-experiment:\n\n1. Write the prediction ('If I do X, Y will happen and it will be terrible.')\n2. Rate how likely it is (0–100%)\n3. Do X\n4. Record what actually happened\n5. Re-rate the prediction\n\nOver time this builds an evidence base your brain can actually use. Avoidance keeps the prediction alive forever.",
    category: 'anxiety',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-anxiety-5',
    title: 'Uncertainty is not danger',
    content: "Technique: Uncertainty tolerance training (Dugas & Robichaud, Generalised Anxiety).\n\nIntolerance of uncertainty drives most anxiety — not actual danger. The question 'but what if?' has no satisfying answer, because certainty is never available.\n\nThe goal is not to get certainty. It's to practise doing things while uncertain.\n\nAsk: Can I tolerate not knowing how this will turn out? Then act anyway. Tolerance is built by contact, not avoidance.",
    category: 'anxiety',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-anxiety-6',
    title: 'Physical symptoms ≠ danger',
    content: "Technique: Interoceptive exposure (Barlow, Panic Control Treatment).\n\nHeart pounding. Chest tight. Dizzy. These are your nervous system doing its job — they are uncomfortable, not dangerous.\n\nThe symptoms of anxiety and the symptoms of excitement are physiologically identical. Research confirms: no one has ever been harmed by anxiety sensations themselves.\n\nThey have a ceiling. They peak. They pass. You have felt this before and you were fine.",
    category: 'anxiety',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Social (5) ─────────────────────────────────────────────────────────────
  // Techniques: Clark & Wells (1995) model — attention training, safety behaviour drop, PEP interruption, observer perspective, avoidance cost
  {
    id: 'cc-social-1',
    title: 'Move your attention outward',
    content: "Technique: Attention training (Clark & Wells, 1995 — Social Anxiety Model).\n\nSocial anxiety is maintained by self-focused attention — you're watching yourself from the inside, monitoring for failure signals, which actually degrades performance and increases anxiety.\n\nRight now: shift attention to the other person.\n• What colour are their eyes?\n• What are they actually saying?\n• What do they seem to be feeling?\n\nGenuine curiosity about others is the antidote to self-surveillance.",
    category: 'social',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-social-2',
    title: 'Drop the safety behaviour',
    content: "Technique: Safety behaviour elimination (Clark & Wells, 1995).\n\nSafety behaviours (speaking quietly, avoiding eye contact, over-preparing scripts, leaving early) feel protective but maintain the problem — they prevent you from learning that things would have been fine.\n\nIdentify one thing you do to 'manage' social risk. Drop it today, just once. Note what actually happened vs. what you predicted.\n\nEvery safety behaviour you drop is evidence collected against the anxiety model.",
    category: 'social',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-social-3',
    title: 'Stop the post-event replay',
    content: "Technique: Post-Event Processing interruption (Clark & Wells, 1995).\n\nAfter social situations, anxious minds run a distorted highlight reel of failures — which strengthens the negative self-model for next time.\n\nWhen you notice the replay starting:\n1. Acknowledge it: 'That's post-event processing. It's biased.'\n2. Write a balanced account: what went okay? what was actually fine?\n3. Redirect attention — do something absorbing\n\nThe replay is not an accurate record. Don't let it write your self-image.",
    category: 'social',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-social-4',
    title: 'Your self-image is distorted',
    content: "Technique: Video feedback / observer perspective (Hackmann & Clark, Social Phobia).\n\nAnxious people dramatically overestimate how negatively they come across. Research using video feedback shows that people consistently rate themselves far worse than outside observers do.\n\nImagine watching a video of yourself in that interaction. What would a neutral observer actually see? Usually: someone who seems normal, maybe a little nervous — not the disaster your self-image is filing.\n\nThe gap between felt and seen is almost always huge.",
    category: 'social',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-social-5',
    title: 'When you want to cancel',
    content: "Technique: Avoidance cost analysis (Behavioural Activation + Clark & Wells).\n\nCancelling feels like relief. It lasts about 20 minutes.\n\nWhat it actually does: confirms to your nervous system that the situation was dangerous, raises the threshold for next time, and shrinks your world a little more.\n\nYou don't have to want to go. You just have to go. You can be anxious the whole time. That still counts as exposure — and it counts as keeping your world from getting smaller.",
    category: 'social',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Low mood (5) ───────────────────────────────────────────────────────────
  // Techniques: Behavioural Activation (Lewinsohn), DBT Opposite Action, Seligman Three Good Things, BA scheduling, self-validation
  {
    id: 'cc-mood-1',
    title: 'Action before feeling',
    content: "Technique: Behavioural Activation (Lewinsohn, 1974; Martell, Dimidjian — equal to antidepressants in RCTs).\n\nDepression tells you to wait until you feel like doing things. That's the trap — motivation follows action, it doesn't precede it.\n\nChoose one activity from your life that used to give you pleasure or a sense of accomplishment. Do a 10-minute version of it — not because you want to, but as a behavioural experiment.\n\nRecord your mood before (0–10) and after. Data, not feelings, is what breaks the cycle.",
    category: 'low-mood',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mood-2',
    title: 'Opposite action for sadness',
    content: "Technique: Opposite Action (Marsha Linehan, DBT — Emotion Regulation module).\n\nEvery emotion comes with an action urge. Sadness urges withdrawal and isolation — which deepens it.\n\nOpposite action: do the thing sadness tells you not to do.\n• Reach out instead of withdrawing\n• Get up and move instead of staying in bed\n• Engage instead of isolating\n\nDo it fully and without apology. The emotion follows the behaviour — eventually.",
    category: 'low-mood',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mood-3',
    title: 'Three good things',
    content: "Technique: Three Good Things / Gratitude journalling (Martin Seligman — highest effect size in positive psychology RCTs, sustained at 6 months).\n\nEach day, write three things that went well and why they happened. They can be small.\n\nThe 'why' is important — it builds the habit of noticing your own agency and the good that's already present. Brains notice threats by default. This reprograms the filter, deliberately.",
    category: 'low-mood',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mood-4',
    title: 'One small action',
    content: "Technique: Activity scheduling / graded task assignment (Beck, Cognitive Therapy of Depression).\n\nYou don't have to fix the whole day. You don't have to feel better first.\n\nName the smallest possible version of a useful action:\n→ Not 'exercise' — walk to the end of the street\n→ Not 'tidy the house' — put three things away\n→ Not 'be productive' — open one tab\n\nSmall actions create momentum. Momentum creates options. You only need the first domino.",
    category: 'low-mood',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mood-5',
    title: 'Credit what it cost you',
    content: "Technique: Self-validation under load (Linehan, DBT; Neff, Self-Compassion research).\n\nWhen everything is harder than usual, everything you do takes more than it usually would.\n\nGetting out of bed counted. Eating something counted. Reading this counted.\n\nDon't compare today's output to a well day. Compare it to what it cost you to do it. When the baseline shifts, the effort required shifts too — and that effort deserves to be seen.",
    category: 'low-mood',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Grounding (4) ──────────────────────────────────────────────────────────
  // Techniques: DBT TIPP, Physiological sigh/box breathing, 5-4-3-2-1 sensory, somatic anchoring
  {
    id: 'cc-ground-1',
    title: 'TIPP — fast physiology reset',
    content: "Technique: TIPP skills (Marsha Linehan, DBT — Crisis Survival).\n\nWhen emotion is at crisis intensity, change your body first:\n\n🌡 Temperature — cold water on face / ice on wrists (activates dive reflex, drops heart rate)\n🏃 Intense exercise — 60 seconds of hard movement burns the adrenaline\n🌬 Paced breathing — slow the exhale longer than the inhale\n💪 Progressive muscle relaxation — tense each muscle group, release\n\nThese are physiological interventions. They work regardless of what you're thinking.",
    category: 'grounding',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-ground-2',
    title: 'Box breathing',
    content: "Technique: Tactical breathing / box breathing (used in military, surgery, and panic research).\n\nYour exhale activates the parasympathetic nervous system. Slowing it down is physiologically calming — not metaphorically, literally.\n\nIn for 4 → hold for 4 → out for 4 → hold for 4.\n\nDo four full cycles. Your heart rate will measurably slow. This works if you do it properly and slowly — rushing defeats the purpose.",
    category: 'grounding',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-ground-3',
    title: '5-4-3-2-1 senses',
    content: "Technique: Sensory grounding (used in trauma therapy, PTSD treatment — Rothschild, Van der Kolk).\n\nWhen the mind is in the past or future, the senses bring it to now.\n\nName out loud or in writing:\n👁 5 things you can SEE\n✋ 4 things you can FEEL (feet on floor, air on skin, texture of chair)\n👂 3 things you can HEAR\n👃 2 things you can SMELL\n👅 1 thing you can TASTE\n\nYou are here. This moment is safe.",
    category: 'grounding',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-ground-4',
    title: 'Your body is here',
    content: "Technique: Somatic anchoring (Peter Levine, Somatic Experiencing; Van der Kolk body-based work).\n\nTrauma and anxiety pull awareness out of the body and into the future. The body is always in the present.\n\nRight now:\n• Press both feet flat on the floor — feel the ground holding you\n• Feel the weight of your body in the seat\n• Put one hand on your chest — feel it rise and fall\n• Notice: your body is here. The threat your mind is describing is not.\n\nThis moment is survivable.",
    category: 'grounding',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Mindfulness (5) ────────────────────────────────────────────────────────
  // Techniques: MBCT breathing space, Noting/affect labelling, ACT Leaves on a stream, RAIN (Tara Brach), MBSR body scan
  {
    id: 'cc-mindful-1',
    title: 'Three-minute breathing space',
    content: "Technique: Three-minute breathing space (Segal, Williams & Teasdale — MBCT, prevents depressive relapse as effectively as antidepressants).\n\nMinute 1 — AWARENESS: What thoughts, feelings, and body sensations are present right now? Name them without judgement.\n\nMinute 2 — GATHERING: Bring full attention to the breath. Each inhale, each exhale, just this.\n\nMinute 3 — EXPANDING: Widen awareness back out to the whole body, then the room. Bring this quality of presence into the next moment.\n\nThree minutes. Use it between tasks, before conversations, when spiralling starts.",
    category: 'mindfulness',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mindful-2',
    title: 'Noting practice',
    content: "Technique: Noting / affect labelling (Vipassana tradition; neuroscience: Lieberman et al. 2007, UCLA — reduces amygdala response).\n\nAs you sit quietly, simply note what arises with a single word:\n'Thinking.' 'Planning.' 'Worrying.' 'Itching.' 'Restless.' 'Sad.' 'Calm.'\n\nDon't analyse or follow the content. Just name and return to the breath.\n\nNaming activates the prefrontal cortex and reduces the emotional charge. You are not the thought — you are the one noticing it.",
    category: 'mindfulness',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mindful-3',
    title: 'Leaves on a stream',
    content: "Technique: Cognitive defusion — leaves on a stream (Steven Hayes, ACT).\n\nImagine sitting beside a slow-moving stream. Autumn leaves drift past on the surface.\n\nAs each thought or feeling arises, place it on a leaf and watch it float downstream. Don't grab the leaf. Don't push it away. Just watch it move.\n\nSome thoughts will pull you in — you'll find yourself on the leaf, thinking the thought. That's normal. When you notice, step back to the bank and watch again.\n\nYou are the observer. Thoughts are passing events.",
    category: 'mindfulness',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mindful-4',
    title: 'RAIN',
    content: "Technique: RAIN (Tara Brach, Insight meditation; widely used in MBSR clinical contexts).\n\n🌧 Recognise — what is happening right now? Name the feeling.\n\n✋ Allow — let it be here without fighting or fleeing. 'This is what's happening right now.'\n\n🔍 Investigate — where do you feel it in the body? What does it need?\n\n💛 Nurture — offer the part of you that's hurting some kindness. A hand on the chest. 'This is hard. I'm here.'\n\nRAIN doesn't fix the feeling. It changes your relationship to it.",
    category: 'mindfulness',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-mindful-5',
    title: 'Body scan',
    content: "Technique: Body scan meditation (Jon Kabat-Zinn, MBSR — reduces chronic pain, stress, and anxiety across 40+ RCTs).\n\nStarting at the crown of the head, move attention slowly down through the body. Spend 5–10 seconds in each area:\n\nScalp → face → jaw → neck → shoulders → chest → arms → hands → belly → lower back → hips → thighs → knees → calves → feet → toes.\n\nNotice: tension, warmth, numbness, tingling, nothing. Don't try to change anything. Just observe.\n\nThe body holds what the mind hasn't processed. Paying attention is the first step.",
    category: 'mindfulness',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Self-compassion (4) ────────────────────────────────────────────────────
  // Techniques: Neff 3-step break, Common humanity, Good friend test, Compassionate letter
  {
    id: 'cc-selfcomp-1',
    title: 'The self-compassion break',
    content: "Technique: Self-compassion break (Kristin Neff — MSC programme; RCTs show reduces anxiety, depression, self-criticism).\n\nThree steps, right now:\n\n1. MINDFULNESS — 'This is a moment of suffering.' (Acknowledge what's happening without exaggerating or minimising.)\n\n2. COMMON HUMANITY — 'Suffering is part of life.' (You're not uniquely broken. Every human struggles.)\n\n3. KINDNESS — Put a hand on your heart. 'May I be kind to myself right now. May I give myself what I need.'\n\nThese three things together — not one, all three.",
    category: 'self-compassion',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-selfcomp-2',
    title: 'Common humanity',
    content: "Technique: Common humanity (Kristin Neff, Self-Compassion Theory — contrasted with self-esteem, which is comparative and fragile).\n\nWhen you're struggling, the mind creates a story that you're uniquely failing — that other people don't feel this, aren't this behind, don't have this fear.\n\nThat story is false.\n\nEvery human experiences inadequacy, loss, anxiety, and pain. It's not a defect — it's membership. You're not alone in this. You're in the largest possible company: everyone who has ever been alive.",
    category: 'self-compassion',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-selfcomp-3',
    title: 'Talk to yourself like a good friend',
    content: "Technique: Self-compassion as inner friendship (Neff & Germer, MSC; Gilbert, Compassion-Focused Therapy).\n\nImagine your closest friend called you and described exactly what you're going through. What would you say to them?\n\nYou probably wouldn't say:\n'You're so weak. You should have handled this better. What's wrong with you?'\n\nYou'd probably say something much kinder, more patient, and more useful.\n\nNow: say that to yourself. Out loud if you can. You deserve the same warmth you'd offer someone you love.",
    category: 'self-compassion',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-selfcomp-4',
    title: 'Write yourself a compassion letter',
    content: "Technique: Compassionate letter writing (Neff; also Pennebaker expressive writing — sustained emotional benefit at 1–2 months in RCTs).\n\nWrite a letter to yourself from the perspective of a wise, caring friend who knows your full situation.\n\nInclude:\n• Acknowledgement of what's genuinely hard\n• Reminders of your strengths and efforts\n• Context for why you're struggling (it makes sense)\n• Encouragement that's honest, not hollow\n\nNo performance needed. It's private. Date it. Some people reread old ones when things are hard again.",
    category: 'self-compassion',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Values (4) ─────────────────────────────────────────────────────────────
  // Techniques: VIA character strengths, savouring (Bryant), ACT valued action, gratitude letter (Seligman)
  {
    id: 'cc-values-1',
    title: 'Use a strength today',
    content: "Technique: Character Strengths in new ways (VIA Institute; Seligman, Peterson — PERMA model; highest effect size interventions in positive psychology).\n\nResearch: using a signature strength in a new way each day for one week reduces depression and increases wellbeing at 6-month follow-up.\n\nYour strengths might include: curiosity, kindness, humour, perseverance, fairness, creativity.\n\nToday: identify one strength you have. Find one small, new way to use it before the day ends.\n\nThis isn't positivity theatre. It's building the skill of living from who you are.",
    category: 'values',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-values-2',
    title: 'Savour this',
    content: "Technique: Savouring (Fred Bryant, Loyola University — Savoring: A New Model of Positive Experience).\n\nThe brain is wired to notice threats and habituate to good things. Savouring is a deliberate counter to that:\n\n• Slow down right now\n• Notice something good that's present — sunlight, a warm drink, a quiet moment, a task completed\n• Stay with it for 20–30 seconds, longer than feels necessary\n• Describe it to yourself in specific detail\n\nSavouring builds positive affect that buffers against stress. It's not denial — it's balance.",
    category: 'values',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-values-3',
    title: 'What does this make possible?',
    content: "Technique: Values clarification and valued action (Steven Hayes, ACT — Acceptance & Commitment Therapy).\n\nAnxiety and discomfort only feel pointless when they're not connected to anything that matters.\n\nAsk: what does getting through this make possible? Not 'what do I get' — what does it enable? What kind of person does it let you be?\n\nDiscomfort in service of something you value is different from discomfort that has no purpose. Name the value underneath the difficulty you're facing right now.",
    category: 'values',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-values-4',
    title: 'Write the gratitude letter',
    content: "Technique: Gratitude letter / visit (Martin Seligman — highest effect size in PPT; benefits sustained at 1-month follow-up).\n\nThink of someone who has positively shaped your life and who you haven't properly thanked.\n\nWrite them a letter (half a page). Be specific about what they did and how it affected you.\n\nIf possible: read it to them in person or by video call (the in-person format shows the strongest effect).\n\nYou don't have to send it for it to be valuable — but if you can, it changes something for both of you.",
    category: 'values',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },

  // ── Crisis (3) ─────────────────────────────────────────────────────────────
  {
    id: 'cc-crisis-1',
    title: 'Just the next ten minutes',
    content: "You don't have to solve anything right now. You don't have to feel okay. You don't have to see a way through.\n\nYou just have to get through the next ten minutes.\n\nThen the ten after that.\n\nDon't look further. The future is not the task right now. Right now, only this moment is real — and you are still here in it.",
    category: 'crisis',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-crisis-2',
    title: 'When it is very dark',
    content: "These feelings are real. They're not permanent, even when they feel like they will be forever.\n\nResearch on suicidal crises consistently shows that the desire to die is a response to unbearable pain — not a fixed preference. It passes when the pain becomes more bearable.\n\nYou don't have to be alone right now. Reach out to one person — not to fix anything, just to not be alone while you wait for this to pass.\n\nIf you're unsafe: please call or text a crisis line, or go somewhere you're not alone.",
    category: 'crisis',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cc-crisis-3',
    title: 'Escalation steps',
    content: "When things are very bad, decisions are hard. Here are the steps in order — don't skip ahead:\n\n1. Ground first: feet on floor, cold water on face, slow your breath out\n2. Remove or distance from anything that could cause harm\n3. Text or call one person you trust — just to be not alone\n4. If you're unsafe or the feeling won't pass: call a crisis line or present to an emergency department\n\nYou don't have to solve everything. One step at a time. This moment only.",
    category: 'crisis',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  },
]
