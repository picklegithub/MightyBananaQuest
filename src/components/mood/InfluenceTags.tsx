import React, { useState } from 'react'
import { INFLUENCE_GROUPS } from './constants'

interface Props {
  selected: string[]
  onChange: (tags: string[]) => void
}

const MAX_SELECTED = 8

export function InfluenceTags({ selected, onChange }: Props) {
  const [showAll, setShowAll] = useState(false)

  // Show priority order: selected first, then rest
  const allTags = INFLUENCE_GROUPS.flatMap(g => g.tags)
  const groups  = showAll ? INFLUENCE_GROUPS : null

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else if (selected.length < MAX_SELECTED) {
      onChange([...selected, id])
    }
  }

  return (
    <div>
      {!showAll ? (
        /* Compact — flat tag cloud, first 12 tags */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allTags.slice(0, 12).map(tag => {
            const on = selected.includes(tag.id)
            return (
              <button key={tag.id} onClick={() => toggle(tag.id)} style={{
                padding: '5px 10px', borderRadius: 999,
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                background: on ? 'var(--ink)' : 'var(--paper-2)',
                color: on ? 'var(--paper)' : 'var(--ink-2)',
                border: '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                transition: 'all .1s',
              }}>
                <span>{tag.emoji}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.03em' }}>
                  {tag.label}
                </span>
              </button>
            )
          })}
          <button onClick={() => setShowAll(true)} style={{
            padding: '5px 10px', borderRadius: 999, fontSize: 11,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            background: 'transparent', color: 'var(--ink-3)',
            border: '1px dashed var(--rule)',
          }}>
            + more
          </button>
        </div>
      ) : (
        /* Expanded — grouped */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups!.map(group => (
            <div key={group.group}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
                color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6,
              }}>
                {group.group}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {group.tags.map(tag => {
                  const on = selected.includes(tag.id)
                  return (
                    <button key={tag.id} onClick={() => toggle(tag.id)} style={{
                      padding: '5px 10px', borderRadius: 999,
                      fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                      background: on ? 'var(--ink)' : 'var(--paper-2)',
                      color: on ? 'var(--paper)' : 'var(--ink-2)',
                      border: '1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                      transition: 'all .1s',
                    }}>
                      <span>{tag.emoji}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.03em' }}>
                        {tag.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <button onClick={() => setShowAll(false)} style={{
            alignSelf: 'flex-start', padding: '4px 10px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
            color: 'var(--ink-4)', background: 'transparent', border: 'none',
          }}>
            ↑ less
          </button>
        </div>
      )}
    </div>
  )
}
