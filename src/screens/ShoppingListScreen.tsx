import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addShoppingItem, updateShoppingItem, deleteShoppingItem, deleteCheckedShoppingItems } from '../data/db'
import { Icons } from '../components/ui/Icons'
import { ThemeToggle } from '../components/ThemeToggle'
import type { ShoppingItem, Screen } from '../types'

// ── Store chooser ─────────────────────────────────────────────────────────────
const STORES = ['Aldi', 'Coles', 'Drakes', 'Woolies']

// ── Inline ghost input for quick item entry ───────────────────────────────────
function GhostInputShopping({ defaultStore, onSaved }: { defaultStore: string | null; onSaved: () => void }) {
  const [active, setActive] = useState(false)
  const [value, setValue]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 40)
  }, [active])

  useEffect(() => {
    const handler = () => setActive(true)
    window.addEventListener('shopping:add-item', handler)
    return () => window.removeEventListener('shopping:add-item', handler)
  }, [])

  async function handleSave() {
    const t = value.trim()
    if (!t) { setActive(false); return }
    await addShoppingItem({
      title: t, category: '', checked: false,
      store: defaultStore || undefined,
    })
    setValue('')
    setActive(false)
    onSaved()
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '9px 13px',
          borderRadius: 12, border: '1px dashed var(--rule)',
          color: 'var(--ink-4)', fontSize: 13,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '1.5px dashed var(--rule)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-4)', flexShrink: 0,
        }}>
          <Icons.plus size={11} />
        </span>
        Add item{defaultStore ? ` to ${defaultStore}` : ''}…
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) handleSave()
          if (e.key === 'Escape') { setValue(''); setActive(false) }
        }}
        placeholder="Item name…"
        style={{
          flex: 1, padding: '10px 13px', borderRadius: 12,
          border: '2px solid var(--accent)',
          background: 'var(--paper-2)', fontSize: 14, color: 'var(--ink)',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSave}
        disabled={!value.trim()}
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: value.trim() ? 'var(--ink)' : 'var(--paper-3)',
          color: value.trim() ? 'var(--paper)' : 'var(--ink-4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icons.check size={14} sw={2.5} />
      </button>
      <button
        onClick={() => { setValue(''); setActive(false) }}
        style={{ width: 38, height: 38, borderRadius: 10, color: 'var(--ink-3)', border: '1px solid var(--rule)', flexShrink: 0 }}
      >
        <Icons.close size={14} />
      </button>
    </div>
  )
}

// ── Item edit panel — full-screen edit mode (mirrors task detail layout) ───────
function ItemEditPanel({
  item,
  existingCategories,
  onSave,
  onDelete,
  onBack,
  onSettings,
}: {
  item: ShoppingItem
  existingCategories: string[]
  onSave: (patch: Partial<ShoppingItem>) => Promise<void>
  onDelete: () => Promise<void>
  onBack: () => void
  onSettings?: () => void
}) {
  const [title,    setTitle]    = useState(item.title)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [category, setCategory] = useState(item.category)
  const [notes,    setNotes]    = useState(item.notes ?? '')
  const [store,    setStore]    = useState(item.store ?? '')
  const [showCats, setShowCats] = useState(false)
  const [savedFlash,     setSavedFlash]     = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  const uniqueCats = Array.from(new Set(existingCategories.filter(c => c.length > 0)))

  async function handleSave() {
    if (!title.trim()) return
    setSavedFlash(true)
    await onSave({
      title:    title.trim(),
      quantity: quantity.trim() || undefined,
      category: category.trim(),
      notes:    notes.trim() || undefined,
      store:    store.trim() || undefined,
    })
    setTimeout(() => { setSavedFlash(false); onBack() }, 700)
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--rule)', background: 'var(--paper-2)',
    fontSize: 14, color: 'var(--ink)', boxSizing: 'border-box' as const,
  }
  const label: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, color: 'var(--ink-4)', marginBottom: 6,
    display: 'block',
  }

  return (
    <div className="screen">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: '1px solid var(--rule)', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
          <Icons.back size={16} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>Shopping List</span>
        </button>
        <div style={{ flex: 1 }} />
        <ThemeToggle />
        {onSettings && (
          <button onClick={onSettings} style={{ color: 'var(--ink-2)' }}>
            <Icons.settings size={20} />
          </button>
        )}
      </div>

      {/* Scrollable fields */}
      <div className="screen-scroll" style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Item name */}
        <div>
          <span style={label}>Item</span>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Item name…"
            style={fieldStyle}
          />
        </div>

        {/* Quantity */}
        <div>
          <span style={label}>Quantity <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></span>
          <input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="e.g. 2, 500g, a bunch…"
            style={fieldStyle}
          />
        </div>

        {/* Category */}
        <div>
          <span style={label}>Category <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></span>
          <input
            value={category}
            onChange={e => { setCategory(e.target.value); setShowCats(true) }}
            onFocus={() => setShowCats(true)}
            onBlur={() => setTimeout(() => setShowCats(false), 150)}
            placeholder="e.g. Produce, Dairy, Bakery…"
            style={fieldStyle}
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

        {/* Store */}
        <div>
          <span style={label}>Shop</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setStore('')}
              style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 11, flexShrink: 0,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                background: !store ? 'var(--ink)' : 'var(--paper-2)',
                color: !store ? 'var(--paper)' : 'var(--ink-3)',
                border: '1px solid', borderColor: !store ? 'var(--ink)' : 'var(--rule)',
              }}
            >
              Any
            </button>
            {STORES.map(s => (
              <button
                key={s}
                onClick={() => setStore(store === s ? '' : s)}
                style={{
                  padding: '6px 13px', borderRadius: 20, fontSize: 11, flexShrink: 0,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: store === s ? 'var(--ink)' : 'var(--paper-2)',
                  color: store === s ? 'var(--paper)' : 'var(--ink-3)',
                  border: '1px solid', borderColor: store === s ? 'var(--ink)' : 'var(--rule)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <span style={label}>Notes <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any details…"
            rows={3}
            style={{ ...fieldStyle, resize: 'none', lineHeight: 1.5 }}
          />
        </div>
      </div>

      {/* ── Save + Delete footer (mirrors task detail proportions) ── */}
      <div style={{
        flexShrink: 0,
        padding: '12px 20px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--rule)',
        display: 'flex', gap: 8,
      }}>
        {/* Save — hidden while confirming delete */}
        {!confirmDelete && (
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 6, padding: '13px 12px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: savedFlash ? 'var(--accent)' : (title.trim() ? 'var(--ink)' : 'var(--paper-3)'),
              color: title.trim() ? 'var(--paper)' : 'var(--ink-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background .2s',
            }}
          >
            {savedFlash ? <><Icons.check size={14} sw={2.5} /> Saved!</> : <><Icons.check size={13} sw={2} /> Save</>}
          </button>
        )}

        {/* Delete — confirm/cancel only (no Save when confirming) */}
        {confirmDelete ? (
          <>
            <button
              onClick={async () => { await onDelete(); onBack() }}
              style={{
                flex: 4, padding: '13px 8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--warn)', color: 'white',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                flex: 2, padding: '13px 8px', borderRadius: 10, fontSize: 13,
                background: 'var(--paper-2)', color: 'var(--ink-3)',
                border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)',
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              flex: 3, padding: '13px 8px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: 'var(--warn-soft)', color: 'var(--warn)',
              border: '1px solid var(--warn-soft)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Individual item row — tap anywhere to edit ────────────────────────────────
function ItemRow({
  item,
  onToggle,
  onEdit,
}: {
  item: ShoppingItem
  onToggle: (e: React.MouseEvent) => void
  onEdit: () => void
}) {
  return (
    <button
      onClick={onEdit}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 14px',
        background: 'var(--paper-2)', borderRadius: 10,
        border: '1px solid var(--rule)', textAlign: 'left',
      }}
    >
      {/* Checkbox — stop propagation so it only toggles, not opens edit */}
      <span
        onClick={onToggle}
        role="checkbox"
        aria-checked={item.checked}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${item.checked ? 'var(--accent)' : 'var(--rule)'}`,
          background: item.checked ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white',
        }}
      >
        {item.checked && <Icons.check size={12} />}
      </span>

      {/* Text */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 14, fontWeight: 500,
          color: item.checked ? 'var(--ink-4)' : 'var(--ink)',
          textDecoration: item.checked ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.quantity && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginRight: 6 }}>
              {item.quantity}
            </span>
          )}
          {item.title}
        </span>
        {(item.category || item.notes || item.store) && (
          <span style={{
            display: 'block', fontSize: 11, color: 'var(--ink-4)', marginTop: 2,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {[item.store, item.category, item.notes].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>

      {/* Edit chevron */}
      <Icons.arrow size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
    </button>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  back: () => void
  navigate?: (s: Screen) => void
}

export function ShoppingListScreen({ back, navigate }: Props) {
  const items = useLiveQuery(() => db.shoppingItems.orderBy('createdAt').toArray(), []) ?? []
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)
  const [activeStore,  setActiveStore]  = useState<string | null>(null)

  // ── Edit panel — renders instead of list when an item is tapped ────────────
  if (editingItem) {
    const existingCategories = Array.from(new Set(items.map(i => i.category.trim()).filter(Boolean)))
    return (
      <ItemEditPanel
        item={editingItem}
        existingCategories={existingCategories}
        onSave={async (patch) => { await updateShoppingItem(editingItem.id, patch) }}
        onDelete={async () => { await deleteShoppingItem(editingItem.id) }}
        onBack={() => setEditingItem(null)}
        onSettings={navigate ? () => navigate({ name: 'settings' } as Screen) : undefined}
      />
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  // Filter by selected store (items with no store tag show in all views)
  const visibleItems = activeStore
    ? items.filter(i => !i.store || i.store === activeStore)
    : items

  const uncheckedCount = visibleItems.filter(i => !i.checked).length
  const checkedCount   = visibleItems.filter(i => i.checked).length

  // Group by category
  const categorised: Record<string, ShoppingItem[]> = {}
  const UNCATEGORISED = '—'
  for (const item of visibleItems) {
    const key = item.category.trim() || UNCATEGORISED
    if (!categorised[key]) categorised[key] = []
    categorised[key].push(item)
  }
  const sortedKeys = Object.keys(categorised).sort((a, b) => {
    if (a === UNCATEGORISED) return 1
    if (b === UNCATEGORISED) return -1
    return a.localeCompare(b)
  })

  const existingCategories = Array.from(new Set(items.map(i => i.category.trim()).filter(Boolean)))

  async function handleToggle(e: React.MouseEvent, item: ShoppingItem) {
    e.stopPropagation()
    await updateShoppingItem(item.id, { checked: !item.checked })
  }

  async function handleClearChecked() {
    if (activeStore) {
      const toDelete = items.filter(i => i.checked && (!i.store || i.store === activeStore))
      for (const item of toDelete) await deleteShoppingItem(item.id)
    } else {
      await deleteCheckedShoppingItems()
    }
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
            <div className="t-display" style={{ fontSize: 22 }}>
              {activeStore ? `${activeStore} run` : 'Shopping List'}
            </div>
            {items.length > 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
                {uncheckedCount} remaining{checkedCount > 0 ? ` · ${checkedCount} checked` : ''}
              </div>
            )}
          </div>

          {/* Store chooser */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              onClick={() => setActiveStore(null)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                background: !activeStore ? 'var(--ink)' : 'var(--paper-2)',
                color: !activeStore ? 'var(--paper)' : 'var(--ink-3)',
                border: '1px solid', borderColor: !activeStore ? 'var(--ink)' : 'var(--rule)',
              }}
            >
              All shops
            </button>
            {STORES.map(store => (
              <button
                key={store}
                onClick={() => setActiveStore(activeStore === store ? null : store)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: activeStore === store ? 'var(--ink)' : 'var(--paper-2)',
                  color: activeStore === store ? 'var(--paper)' : 'var(--ink-3)',
                  border: '1px solid', borderColor: activeStore === store ? 'var(--ink)' : 'var(--rule)',
                }}
              >
                {store}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="screen-scroll" style={{ padding: '16px 20px 24px' }}>
        {visibleItems.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12, color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 48 }}>🛒</div>
            <div className="t-display" style={{ fontSize: 18, color: 'var(--ink-2)' }}>
              {activeStore ? `No items for ${activeStore}` : 'Your list is empty'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.6, maxWidth: 220 }}>
              {activeStore
                ? `Tap Add item to add something to your ${activeStore} run.`
                : 'This is separate from your tasks — just a simple place to keep track of things to buy.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sortedKeys.map(catKey => (
              <div key={catKey}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--ink-3)',
                  marginBottom: 8,
                  borderBottom: '1px solid var(--rule)', paddingBottom: 4,
                }}>
                  {catKey === UNCATEGORISED ? 'Other' : catKey}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categorised[catKey].map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={(e) => handleToggle(e, item)}
                      onEdit={() => setEditingItem(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline ghost input */}
        <div style={{ marginTop: visibleItems.length === 0 ? 24 : 20 }}>
          <GhostInputShopping defaultStore={activeStore} onSaved={() => {}} />
        </div>
      </div>
    </div>
  )
}
