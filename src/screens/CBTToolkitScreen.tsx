import React, { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveJournalEntry } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ScreenHeader } from '../components/layout/ScreenHeader'
import { useNav } from '../lib/navContext'
import { localDateISO } from '../lib/useCurrentDate'
import { CopingCardsContent } from './CopingCardsScreen'

const DISTORTIONS = [
  { label: 'All-or-nothing',    def: 'Seeing situations as black or white. "It either works perfectly or it\'s a disaster."' },
  { label: 'Catastrophising',   def: 'Assuming the worst possible outcome will definitely happen.' },
  { label: 'Mind reading',      def: 'Assuming you know what others think — usually negatively — without evidence.' },
  { label: 'Fortune telling',   def: 'Predicting the future as certain, typically in a negative direction.' },
  { label: 'Emotional reasoning', def: 'Treating feelings as facts. "I feel like a failure, so I must be one."' },
  { label: 'Should statements', def: 'Rigid rules about how you or others must behave. Creates guilt and resentment.' },
  { label: 'Overgeneralisation', def: 'Sweeping conclusions from a single event. "This always happens to me."' },
  { label: 'Personalisation',   def: 'Blaming yourself for things partly or fully outside your control.' },
  { label: 'Discounting positives', def: 'Dismissing good outcomes as luck. Keeps the negative story alive.' },
  { label: 'Labelling',         def: 'Attaching a harsh label instead of describing a behaviour. "I\'m an idiot."' },
]

const STEP_LABELS = ['Situation', 'Automatic Thought', 'Distortion', 'Evidence', 'Reframe']

const TA_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--paper)', border: '1px solid var(--rule)',
  borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-ui)',
  fontSize: 14, color: 'var(--ink)', resize: 'none', outline: 'none', lineHeight: 1.55,
  boxSizing: 'border-box',
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-2)', borderRadius: 14,
  border: '1px solid var(--rule)', padding: '20px',
}

export function CBTToolkitScreen() {
  const { back, navigate } = useNav()
  const today = localDateISO()

  const [tab, setTab] = useState<'thought-record' | 'coping-cards'>('thought-record')
  const [step, setStep]               = useState(1)
  const [situation, setSituation]     = useState('')
  const [thought, setThought]         = useState('')
  const [distortion, setDistortion]   = useState<string | null>(null)
  const [distortionDef, setDistortionDef] = useState('')
  const [evidenceFor, setEvidenceFor]     = useState('')
  const [evidenceAgainst, setEvidenceAgainst] = useState('')
  const [reframe, setReframe]         = useState('')
  const [saved, setSaved]             = useState(false)
  const [starting, setStarting]       = useState(false)

  const existing = useLiveQuery(() => db.journal.get(`thought-record:${today}`), [today])

  useEffect(() => {
    if (existing && !starting) setSaved(true)
  }, [existing, starting])

  function reset() {
    setSituation(''); setThought(''); setDistortion(null); setDistortionDef('')
    setEvidenceFor(''); setEvidenceAgainst(''); setReframe('')
    setSaved(false); setStep(1); setStarting(true)
  }

  async function handleSave() {
    await saveJournalEntry({
      id: `thought-record:${today}`,
      date: today,
      kind: 'thought-record' as any,
      notes: JSON.stringify({ situation, thought, distortion, evidenceFor, evidenceAgainst, reframe }),
    })
    setSaved(true)
  }

  const tabBar = (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
      {(['thought-record', 'coping-cards'] as const).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            flex: 1, padding: '11px 16px',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
            background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--ink)' : '2px solid transparent',
            cursor: 'pointer', transition: 'color 0.15s',
          }}
        >
          {t === 'thought-record' ? 'Thought Record' : 'Coping Cards'}
        </button>
      ))}
    </div>
  )

  if (saved && existing) {
    return (
      <div className="screen">
        <ScreenHeader title="CBT Toolkit" back={back} icon={<Icons.heart size={22} />} />
        {tabBar}
        <div className="screen-scroll" style={{ paddingBottom: 48 }}>
          <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              ...CARD, background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>
                  Today's thought record done ✓
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>You've already completed a thought record today.</div>
              </div>
            </div>
            <button onClick={reset} style={{
              background: 'none', border: '1px solid var(--rule)', borderRadius: 'var(--r-pill)',
              padding: '13px 24px', fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500,
              cursor: 'pointer', color: 'var(--ink)',
            }}>
              Start a new one
            </button>
          </div>
        </div>
      </div>
    )
  }

  function canAdvance() {
    if (step === 1) return situation.trim().length > 0
    if (step === 2) return thought.trim().length > 0
    if (step === 3) return distortion !== null
    if (step === 4) return true
    return true
  }

  if (tab === 'coping-cards') {
    return (
      <div className="screen">
        <ScreenHeader title="CBT Toolkit" back={back} icon={<Icons.heart size={22} />} />
        {tabBar}
        <CopingCardsContent />
      </div>
    )
  }

  return (
    <div className="screen">
      <ScreenHeader title="CBT Toolkit" back={back} icon={<Icons.heart size={22} />} />
      {tabBar}

      {/* Progress bar */}
      <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? 'var(--accent)' : 'var(--rule)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          Step {step} of 5 · {STEP_LABELS[step - 1]}
        </div>
      </div>

      <div className="screen-scroll" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {step === 1 && (
            <div style={CARD}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Describe the situation</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>
                What happened? Who was there? What were you doing?
              </p>
              <textarea
                style={TA_STYLE}
                rows={5}
                placeholder="e.g. My manager didn't reply to my message for two days…"
                value={situation}
                onChange={e => setSituation(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div style={CARD}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>What thought went through your mind?</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>
                Capture the exact automatic thought — not a rational analysis.
              </p>
              <textarea
                style={TA_STYLE}
                rows={5}
                placeholder={`e.g. "They think I'm useless. I'm going to be fired."`}
                value={thought}
                onChange={e => setThought(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 3 && (
            <div style={CARD}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Identify the distortion</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>
                Which thinking pattern best describes this thought?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: distortionDef ? 14 : 0 }}>
                {DISTORTIONS.map(d => (
                  <button
                    key={d.label}
                    onClick={() => { setDistortion(d.label); setDistortionDef(d.def) }}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 13,
                      cursor: 'pointer', fontFamily: 'var(--font-ui)',
                      background: distortion === d.label ? 'var(--accent)' : 'var(--paper)',
                      color: distortion === d.label ? 'var(--paper)' : 'var(--ink)',
                      border: distortion === d.label ? 'none' : '1px solid var(--rule)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {distortionDef && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'var(--accent-soft)', borderRadius: 8,
                  fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic',
                }}>
                  {distortionDef}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={CARD}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Examine the evidence</div>
              <div style={{ marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Evidence for</div>
                <textarea
                  style={TA_STYLE}
                  rows={4}
                  placeholder="What supports this thought being true?"
                  value={evidenceFor}
                  onChange={e => setEvidenceFor(e.target.value)}
                />
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Evidence against</div>
                <textarea
                  style={TA_STYLE}
                  rows={4}
                  placeholder="What contradicts this thought?"
                  value={evidenceAgainst}
                  onChange={e => setEvidenceAgainst(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div style={CARD}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Reframe</div>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', marginBottom: 12 }}>
                What would a trusted friend say?
              </p>
              <textarea
                style={TA_STYLE}
                rows={5}
                placeholder="Write a more balanced, realistic thought…"
                value={reframe}
                onChange={e => setReframe(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 5 && saved && (
            <div style={{ ...CARD, background: 'var(--accent-soft)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, marginBottom: 12 }}>
                Done ✓
              </div>
              <button
                onClick={() => navigate({ name: 'coping-cards' })}
                style={{
                  background: 'var(--accent)', color: 'var(--paper)', borderRadius: 'var(--r-pill)',
                  border: 'none', padding: '13px 24px', fontFamily: 'var(--font-ui)',
                  fontSize: 15, fontWeight: 500, cursor: 'pointer',
                }}
              >
                View Coping Cards
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Navigation buttons */}
      {!saved && (
        <div style={{
          flexShrink: 0, padding: '12px 16px',
          borderTop: '1px solid var(--rule)', background: 'var(--paper)',
          display: 'flex', gap: 10,
        }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, background: 'none', border: '1px solid var(--rule)',
                borderRadius: 'var(--r-pill)', padding: '13px 24px',
                fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
                color: 'var(--ink)',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={async () => {
              if (step < 5) setStep(s => s + 1)
              else await handleSave()
            }}
            disabled={!canAdvance()}
            style={{
              flex: 2,
              background: canAdvance() ? 'var(--accent)' : 'var(--rule)',
              color: canAdvance() ? 'var(--paper)' : 'var(--ink-3)',
              borderRadius: 'var(--r-pill)', border: 'none',
              padding: '13px 24px', fontFamily: 'var(--font-ui)',
              fontSize: 15, fontWeight: 500, cursor: canAdvance() ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
          >
            {step === 5 ? 'Save record' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
