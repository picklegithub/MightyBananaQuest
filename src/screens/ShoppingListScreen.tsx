import React, { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addShoppingItem, updateShoppingItem, deleteShoppingItem, deleteCheckedShoppingItems } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import type { ShoppingItem, Screen } from '../types'

// ── Add / Edit item sheet ─────────────────────────────────────────────────────
function ItemSheet({
  initial,
  existingCategories,
  onSave,
  onClose,
}: {
  initial?: ShoppingItem
  existingCategories: string[]
  onSave: (data: { title: string; category: string; quantity: string; notes: string }) => void
  onClose: () => void
}) {
  const [title,    setTitle]    = useState(initial?.title    ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? '')
  const [notes,    setNotes]    = useState(initial?.notes    ?? '')
  const [showCats, setShowCats] = useState(false)

  const canSave = title.trim().length > 0

  const uniqueCats = Array.from(new Set(existingCategories.filter(c => c.length > 0)))

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="t-display" style={{ fontSize: 20 }}>{initial ? 'Edit item' : 'Add item'}</h2>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}><Icons.close size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Item</div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSave && onSave({ title: title.trim(), category: category.trim(), quantity: quantity.trim(), notes: notes.trim() })}
              placeholder="e.g. Oat milk, Bananas…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)', boxSizing: 'border-box' }}
            />
          </div>

          {/* Quantity */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Quantity <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></div>
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 2, 500g, a bunch…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)', boxSizing: 'border-box' }}
            />
          </div>

          {/* Category */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Category <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></div>
            <input
              value={category}
              onChange={e => { setCategory(e.target.value); setShowCats(true) }}
              onFocus={() => setShowCats(true)}
              onBlur={() => setTimeout(() => setShowCats(false), 150)}
              placeholder="e.g. Produce, Dairy, Bakery…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)', boxSizing: 'border-box' }}
            />
            {showCats && uniqueCats.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {uniqueCats.map(c => (
                  <button
                    key={c}
                    onMouseDown={() => { setCategory(c); setShowCats(false) }}
                    style={{
                      padding: '4px 10px', borderRadius: 20,
                      background: category === c ? 'var(--ink)' : 'var(--paper-3)',
                      color: category === c ? 'var(--paper)' : 'var(--ink-2)',
                      border: '1px solid var(--rule)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Notes <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any details…"
              rows={2}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--paper-2)', fontSize: 15, color: 'var(--ink)', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={() => canSave && onSave({ title: title.trim(), category: category.trim(), quantity: quantity.trim(), notes: notes.trim() })}
            disabled={!canSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: canSave ? 'var(--ink)' : 'var(--paper-3)',
              color: canSave ? 'var(--paper)' : 'var(--ink-3)',
            }}
          >
            {initial ? 'Save changes' : 'Add to list'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Individual item row ───────────────────────────────────────────────────────
function ItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [swiped, setSwiped] = useState(false)
  const [startX, setStartX] = useState(0)

  function handleTouchStart(e: React.TouchEvent) {
    setStartX(e.touches[0].clientX)
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = startX - e.changedTouches[0].clientX
    if (dx > 60) setSwiped(true)
    else if (dx < -20) setSwiped(false)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
      {/* Delete action revealed by swipe */}
      <div style={{
        position: 'absolute', inset: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        background: 'var(--warn)', borderRadius: 10, paddingRight: 16,
      }}>
        <button
          onClick={onDelete}
          aria-label="Delete item"
          style={{ color: 'white', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em' }}
        >
          <Icons.close size={14} /> DELETE
        </button>
      </div>

      {/* Item card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 12px',
          background: 'var(--paper-2)', borderRadius: 10,
          border: '1px solid var(--rule)',
          transform: swiped ? 'translateX(-80px)' : 'translateX(0)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Checkbox */}
        <button
          onClick={onToggle}
          aria-label={item.checked ? 'Uncheck item' : 'Check off item'}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${item.checked ? 'var(--accent)' : 'var(--rule)'}`,
            background: item.checked ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
          }}
        >
          {item.checked && <Icons.check size={12} />}
        </button>

        {/* Content */}
        <button
          onClick={onEdit}
          style={{ flex: 1, textAlign: 'left', minWidth: 0 }}
          aria-label={`Edit ${item.title}`}
        >
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: item.checked ? 'var(--ink-4)' : 'var(--ink)',
            textDecoration: item.checked ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.quantity ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginRight: 6 }}>{item.quantity}</span> : null}
            {item.title}
          </div>
          {item.notes && (
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.notes}
            </div>
          )}
        </button>

        {/* Swipe hint (when not swiped) — tap to re-hide swipe */}
        {swiped && (
          <button
            onClick={() => setSwiped(false)}
            style={{ color: 'var(--ink-4)', flexShrink: 0 }}
            aria-label="Close swipe"
          >
            <Icons.close size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  back: () => void
  navigate?: (s: Screen) => void
}

export function ShoppingListScreen({ back, navigate }: Props) {
  const items = useLiveQuery(() => db.shoppingItems.orderBy('createdAt').toArray(), []) ?? []
  const [showAdd,    setShowAdd]    = useState(false)
  const [editTarget, setEditTarget] = useState<ShoppingItem | null>(null)

  const uncheckedCount = items.filter(i => !i.checked).length
  const checkedCount   = items.filter(i => i.checked).length

  // Group by category
  const categorised: Record<string, ShoppingItem[]> = {}
  const UNCATEGORISED = '—'
  for (const item of items) {
    const key = item.category.trim() || UNCATEGORISED
    if (!categorised[key]) categorised[key] = []
    categorised[key].push(item)
  }
  // Sort: named categories first (alphabetical), uncategorised last
  const sortedKeys = Object.keys(categorised).sort((a, b) => {
    if (a === UNCATEGORISED) return 1
    if (b === UNCATEGORISED) return -1
    return a.localeCompare(b)
  })

  const existingCategories = Array.from(new Set(items.map(i => i.category.trim()).filter(Boolean)))

  async function handleAdd(data: { title: string; category: string; quantity: string; notes: string }) {
    await addShoppingItem({ title: data.title, category: data.category, checked: false, quantity: data.quantity || undefined, notes: data.notes || undefined })
    setShowAdd(false)
  }

  async function handleEdit(data: { title: string; category: string; quantity: string; notes: string }) {
    if (!editTarget) return
    await updateShoppingItem(editTarget.id, { title: data.title, category: data.category, quantity: data.quantity || undefined, notes: data.notes || undefined })
    setEditTarget(null)
  }

  async function handleToggle(item: ShoppingItem) {
    await updateShoppingItem(item.id, { checked: !item.checked })
  }

  async function handleClearChecked() {
    await deleteCheckedShoppingItems()
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={back} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <Icons.back size={16} /> Today
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {checkedCount > 0 && (
                <button
                  onClick={handleClearChecked}
                  aria-label="Clear checked items"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                    color: 'var(--warn)', padding: '4px 8px', borderRadius: 6,
                    border: '1px solid var(--warn)',
                  }}
                >
                  CLEAR DONE
                </button>
              )}
              <ThemeToggle />
              {navigate && (
                <button onClick={() => navigate({ name: 'settings' } as Screen)} style={{ color: 'var(--ink-2)' }}>
                  <Icons.settings size={20} />
                </button>
              )}
            </div>
          </div>
          <div>
            <div className="t-display" style={{ fontSize: 22 }}>Shopping List</div>
            {items.length > 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
                {uncheckedCount} remaining{checkedCount > 0 ? ` · ${checkedCount} checked` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="screen-scroll" style={{ padding: '16px 20px' }}>
        {items.length === 0 ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12, color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 48 }}>🛒</div>
            <div className="t-display" style={{ fontSize: 18, color: 'var(--ink-2)' }}>Your list is empty</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.6, maxWidth: 220 }}>
              This is separate from your tasks — just a simple place to keep track of things to buy.
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                marginTop: 12, padding: '12px 24px', borderRadius: 12,
                background: 'var(--ink)', color: 'var(--paper)',
                fontSize: 14, fontWeight: 600,
              }}
            >
              Add first item
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sortedKeys.map(catKey => (
              <div key={catKey}>
                {/* Category header */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--ink-3)',
                  marginBottom: 8,
                  borderBottom: '1px solid var(--rule)', paddingBottom: 4,
                }}>
                  {catKey === UNCATEGORISED ? 'Other' : catKey}
                </div>
                {/* Items in this category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categorised[catKey].map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => handleToggle(item)}
                      onEdit={() => setEditTarget(item)}
                      onDelete={() => deleteShoppingItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        aria-label="Add item"
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          right: 24, zIndex: 50,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--ink)', color: 'var(--paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-pop)',
          border: '2px solid var(--paper)',
        }}
      >
        <Icons.plus size={20} />
      </button>

      {/* Sheets */}
      {showAdd && (
        <ItemSheet
          existingCategories={existingCategories}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editTarget && (
        <ItemSheet
          initial={editTarget}
          existingCategories={existingCategories}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
