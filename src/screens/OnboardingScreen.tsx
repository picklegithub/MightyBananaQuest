import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, updateTask } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import type { Task } from '../types'

interface Props {
  onDone: () => void
}

const STEP_COUNT = 4

// ── Dot progress indicator ────────────────────────────────────────────────────
function Dots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === step ? 20 : 6, height: 6, borderRadius: 3,
          background: i === step ? 'var(--ink)' : 'var(--rule)',
          transition: 'all .3s cubic-bezier(.25,.8,.25,1)',
        }} />
      ))}
    </div>
  )
}

// ── Step 0: Welcome ───────────────────────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 8px' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🍌</div>
      <h1 className="t-display" style={{ fontSize: 30, marginBottom: 10, lineHeight: 1.2 }}>
        Welcome to<br />MightyBananaQuest
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.65, marginBottom: 36, maxWidth: 300, margin: '0 auto 36px' }}>
        Your life admin, tasks, goals, and habits — all in one calm, focused place. Let's set you up in 2 minutes.
      </p>
      <button onClick={onNext} style={{
        width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 16,
        background: 'var(--ink)', color: 'var(--paper)',
      }}>
        Get started →
      </button>
    </div>
  )
}

// ── Step 1: Life areas ────────────────────────────────────────────────────────
function StepAreas({ onNext }: { onNext: () => void }) {
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  const [editing, setEditing] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  function startEdit(id: string, current: string) {
    setEditing(id); setEditVal(current)
  }

  async function saveEdit(id: string) {
    const trimmed = editVal.trim()
    if (trimmed) await db.categories.update(id, { name: trimmed })
    setEditing(null)
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
        <h2 className="t-display" style={{ fontSize: 24, marginBottom: 8 }}>Your life areas</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>
          These are the buckets your tasks and goals live in. Tap any name to rename it.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {cats.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--paper-2)', border: '1px solid var(--rule)',
          }}>
            {/* Colour swatch */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: `hsl(${c.hue}, 50%, 60%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              {c.icon}
            </div>

            {/* Name — tappable to edit */}
            {editing === c.id ? (
              <input
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => saveEdit(c.id)}
                onKeyDown={e => e.key === 'Enter' && saveEdit(c.id)}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  borderBottom: '1.5px solid var(--accent)', fontSize: 14,
                  fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
                  padding: '2px 0',
                }}
              />
            ) : (
              <button
                onClick={() => startEdit(c.id, c.name)}
                style={{ flex: 1, textAlign: 'left', fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}
              >
                {c.name}
              </button>
            )}
          </div>
        ))}
      </div>

      <button onClick={onNext} style={{
        width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15,
        background: 'var(--ink)', color: 'var(--paper)',
      }}>
        Looks good →
      </button>
    </div>
  )
}

// ── Step 2: First task ────────────────────────────────────────────────────────
function StepFirstTask({ onNext }: { onNext: () => void }) {
  const [title,   setTitle]   = useState('')
  const [saved,   setSaved]   = useState(false)
  const [skipped, setSkipped] = useState(false)
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? []

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) return
    const task: Task = {
      id: `t${Date.now()}`,
      title: trimmed, cat: 'inbox', effort: 's', due: 'Today',
      ctx: '@anywhere', quad: 'q2', recurring: null,
      done: false, streak: 0, sub: [],
    }
    await addTask(task)
    setSaved(true)
    setTimeout(onNext, 700)
  }

  if (skipped) { onNext(); return null }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✏️</div>
        <h2 className="t-display" style={{ fontSize: 24, marginBottom: 8 }}>Add your first task</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6 }}>
          What's one thing on your mind right now? Even small things count.
        </p>
      </div>

      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && title.trim() && handleSave()}
        placeholder="e.g. Book dentist appointment"
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12, marginBottom: 12,
          border: '1px solid var(--rule)', background: 'var(--paper-2)',
          fontSize: 15, color: 'var(--ink)',
        }}
      />

      <button
        onClick={handleSave}
        disabled={!title.trim() || saved}
        style={{
          width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15,
          marginBottom: 10,
          background: saved ? 'var(--accent-soft)' : title.trim() ? 'var(--ink)' : 'var(--paper-3)',
          color: saved ? 'var(--ink)' : title.trim() ? 'var(--paper)' : 'var(--ink-3)',
          transition: 'all .15s',
        }}
      >
        {saved ? '✓ Saved!' : 'Add task →'}
      </button>

      <button onClick={() => setSkipped(true)} style={{
        width: '100%', padding: '12px', borderRadius: 14, fontSize: 13,
        color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        border: '1px solid var(--rule)', background: 'transparent',
      }}>
        Skip for now
      </button>
    </div>
  )
}

// ── Step 3: All set ───────────────────────────────────────────────────────────
function StepDone({ onDone }: { onDone: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 8px' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
      <h2 className="t-display" style={{ fontSize: 28, marginBottom: 10 }}>You're all set!</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65, marginBottom: 12, maxWidth: 300, margin: '0 auto 12px' }}>
        Your life areas are ready, and you've captured your first task.
      </p>
      <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 36, maxWidth: 300, margin: '0 auto 36px' }}>
        Tap the ＋ button any time to capture a task. The flame button logs a habit. Use the journal each morning and evening to stay grounded.
      </p>
      <button onClick={onDone} style={{
        width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 16,
        background: 'var(--ink)', color: 'var(--paper)',
      }}>
        Let's go 🍌
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export const OnboardingScreen = ({ onDone }: Props) => {
  const [step, setStep] = useState(0)

  async function finish() {
    await db.settings.update(1, { onboarded: true })
    onDone()
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--paper)', overflowY: 'auto',
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '32px 28px 48px',
        maxWidth: 420, margin: '0 auto', width: '100%',
      }}>
        <Dots step={step} total={STEP_COUNT} />

        {step === 0 && <StepWelcome  onNext={() => setStep(1)} />}
        {step === 1 && <StepAreas    onNext={() => setStep(2)} />}
        {step === 2 && <StepFirstTask onNext={() => setStep(3)} />}
        {step === 3 && <StepDone     onDone={finish} />}
      </div>
    </div>
  )
}
