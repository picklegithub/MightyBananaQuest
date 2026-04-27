import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addTask, updateTask } from '../data/db'
import { DEFAULT_CATEGORIES } from '../constants'
import { Icons } from '../components/ui/Icons'
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
    <div style={{ padding: '0 4px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 24 }}>
        Step 01 / 03
      </div>
      <h1 className="t-display" style={{ fontSize: 38, lineHeight: 0.95, marginBottom: 20 }}>
        The small things,<br />
        <em style={{ color: 'var(--accent)' }}>handled.</em>
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65, marginBottom: 12 }}>
        A calm place for tasks, habits, goals, and the rest of life's quiet logistics.
      </p>
      <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 40 }}>
        Takes 2 minutes to set up.
      </p>
      <button onClick={onNext} style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '14px 28px', borderRadius: 999, fontWeight: 500, fontSize: 14,
        background: 'var(--ink)', color: 'var(--paper)',
      }}>
        Begin <Icons.arrow size={16} />
      </button>
    </div>
  )
}

// ── Step 1: Life areas (toggle grid) ─────────────────────────────────────────
function StepAreas({ onNext }: { onNext: () => void }) {
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? DEFAULT_CATEGORIES
  // Start with all areas selected
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_CATEGORIES.map(c => c.id))
  )
  const [adding,  setAdding]  = useState(false)
  const [newName, setNewName] = useState('')

  // Sync selected set when cats first load from DB (useLiveQuery is async)
  const didSyncSelected = React.useRef(false)
  useEffect(() => {
    if (cats.length > 0 && !didSyncSelected.current) {
      didSyncSelected.current = true
      setSelected(new Set(cats.map(c => c.id)))
    }
  }, [cats])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleNext() {
    // Remove unselected categories
    for (const cat of cats) {
      if (!selected.has(cat.id)) {
        await db.categories.delete(cat.id)
        // Move tasks in this cat to inbox
        const catTasks = await db.tasks.where('cat').equals(cat.id).toArray()
        for (const t of catTasks) await db.tasks.update(t.id, { cat: 'inbox' })
      }
    }
    onNext()
  }

  async function addCustom() {
    const name = newName.trim()
    if (!name) return
    const id = `c_${Date.now()}`
    await db.categories.add({ id, name, icon: 'sparkle', hue: 200 })
    setSelected(prev => new Set([...prev, id]))
    setNewName(''); setAdding(false)
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Step 02 / 03</div>
      <h2 className="t-display" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 8 }}>
        Choose the <em>parts of life</em> you want here.
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
        Pick 3 to start. Remove or add any time.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, maxHeight: 340, overflowY: 'auto' }} className="no-scrollbar">
        {cats.map(c => {
          const I      = Icons[c.icon] ?? Icons.sparkle
          const active = selected.has(c.id)
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{
              padding: '14px 12px', borderRadius: 14, textAlign: 'left',
              background: active ? 'var(--ink)' : 'var(--paper-2)',
              color: active ? 'var(--paper)' : 'var(--ink)',
              border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
              transition: 'all .18s', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 88,
            }}>
              <I size={18} stroke={active ? 'var(--paper)' : `hsl(${c.hue}, 55%, 42%)`} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 9, opacity: 0.65, fontFamily: 'var(--font-mono)', marginTop: 2, letterSpacing: '0.06em' }}>
                  {active ? 'SELECTED' : 'TAP TO ADD'}
                </div>
              </div>
            </button>
          )
        })}

        {/* + Create your own */}
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            padding: '14px 12px', borderRadius: 14, minHeight: 88,
            background: 'transparent', border: '1px dashed var(--rule)',
            color: 'var(--ink-3)', textAlign: 'left',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <Icons.plus size={18} />
            <div>
              <div className="t-display" style={{ fontSize: 13, fontStyle: 'italic' }}>Your own</div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', marginTop: 2, letterSpacing: '0.06em', color: 'var(--ink-4)' }}>CREATE AREA</div>
            </div>
          </button>
        )}

        {adding && (
          <div style={{
            gridColumn: '1 / -1', padding: 14, borderRadius: 14,
            background: 'var(--paper-2)', border: '1px solid var(--ink)',
          }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>New area</div>
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="e.g. Mindfulness"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={addCustom} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--ink)', color: 'var(--paper)', fontSize: 13, fontWeight: 500 }}>Add</button>
              <button onClick={() => { setAdding(false); setNewName('') }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--rule)', fontSize: 13, color: 'var(--ink-2)' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        disabled={selected.size === 0}
        style={{
          width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15,
          background: selected.size > 0 ? 'var(--ink)' : 'var(--paper-3)',
          color: selected.size > 0 ? 'var(--paper)' : 'var(--ink-3)',
        }}
      >
        {selected.size === 0 ? 'Pick at least one →' : `Keep ${selected.size} area${selected.size !== 1 ? 's' : ''} →`}
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
