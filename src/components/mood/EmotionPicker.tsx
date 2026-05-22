import React from 'react'
import { EMOTION_GROUPS } from './constants'

interface Props {
  selected: string[]
  onChange: (emotions: string[]) => void
}

const MAX_EMOTIONS = 5

export function EmotionPicker({ selected, onChange }: Props) {
  function toggle(emotion: string) {
    const id = emotion.toLowerCase()
    if (selected.includes(id)) {
      onChange(selected.filter(e => e !== id))
    } else if (selected.length < MAX_EMOTIONS) {
      onChange([...selected, id])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {EMOTION_GROUPS.map(group => (
        <div key={group.tone}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '0.12em', color: group.color,
            textTransform: 'uppercase', marginBottom: 7,
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {group.emotions.map(emotion => {
              const id = emotion.toLowerCase()
              const on = selected.includes(id)
              return (
                <button key={id} onClick={() => toggle(emotion)} style={{
                  padding: '5px 11px', borderRadius: 999,
                  fontFamily: 'var(--font-mono)', fontSize: 10.5,
                  letterSpacing: '0.04em',
                  background: on ? group.color : 'transparent',
                  color: on ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${on ? group.color : 'var(--rule)'}`,
                  transition: 'all .1s',
                }}>
                  {emotion}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {selected.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--ink-4)', letterSpacing: '0.04em',
        }}>
          {selected.length}/{MAX_EMOTIONS} selected
        </div>
      )}
    </div>
  )
}
