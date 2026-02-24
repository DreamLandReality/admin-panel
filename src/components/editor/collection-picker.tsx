'use client'

import { useState } from 'react'

// ─── CollectionPickerWidget ───────────────────────────────────────────────────

export function CollectionPickerWidget({
  label,
  selectedIds,
  allItems,
  onChange,
}: {
  label: string
  selectedIds: string[]
  allItems: Record<string, any>[]
  onChange: (ids: string[]) => void
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const availableItems = allItems.filter((item) => !selectedIds.includes(item.id))

  function getItemName(id: string): string {
    const item = allItems.find((i) => i.id === id)
    return item?.title ?? item?.name ?? item?.slug ?? id
  }

  function handleRemove(id: string) {
    onChange(selectedIds.filter((sid) => sid !== id))
  }

  function handleAdd(id: string) {
    onChange([...selectedIds, id])
    setShowDropdown(false)
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    const ids = [...selectedIds]
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    onChange(ids)
  }

  function handleMoveDown(index: number) {
    if (index >= selectedIds.length - 1) return
    const ids = [...selectedIds]
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    onChange(ids)
  }

  return (
    <div>
      <p className="text-label uppercase tracking-label text-muted-foreground mb-2 mt-4">{label}</p>
      <div className="space-y-1">
        {selectedIds.map((id, i) => (
          <div
            key={id}
            className="flex items-center gap-1.5 bg-white/5 rounded-md px-2.5 py-1.5 group/pick"
          >
            <span className="flex-1 text-xs text-foreground truncate">{getItemName(id)}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover/pick:opacity-100 transition-opacity">
              <button
                onClick={() => handleMoveUp(i)}
                disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                title="Move up"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M2 6.5L5 3.5l3 3" />
                </svg>
              </button>
              <button
                onClick={() => handleMoveDown(i)}
                disabled={i >= selectedIds.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                title="Move down"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M2 3.5L5 6.5l3-3" />
                </svg>
              </button>
              <button
                onClick={() => handleRemove(id)}
                className="text-muted-foreground hover:text-red-400 p-0.5"
                title="Remove"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add from collection dropdown */}
      <div className="relative mt-1.5">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={availableItems.length === 0}
          className="w-full py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-white/5"
        >
          + Add from collection
        </button>
        {showDropdown && availableItems.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-editor-dropdown border border-white/10 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
            {availableItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAdd(item.id)}
                className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                {item.title ?? item.name ?? item.slug ?? item.id}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
