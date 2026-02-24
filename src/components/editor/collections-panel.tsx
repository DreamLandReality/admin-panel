'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import type { Collection } from '@/types'

// ─── CollectionsPanel (navigation-only for Data mode) ───────────────────────

export function CollectionsPanel() {
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const collectionData = useWizardStore((s) => s.collectionData)
  const addCollectionItem = useWizardStore((s) => s.addCollectionItem)
  const removeCollectionItem = useWizardStore((s) => s.removeCollectionItem)
  const selectedCollectionItem = useWizardStore((s) => s.selectedCollectionItem)
  const setSelectedCollectionItem = useWizardStore((s) => s.setSelectedCollectionItem)

  const collections: Collection[] = (selectedTemplate?.manifest?.collections as Collection[]) ?? []
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    collections[0]?.id ?? null
  )

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          No collections defined in this template.
        </p>
      </div>
    )
  }

  const activeCollection = collections.find((c) => c.id === activeCollectionId) ?? null
  const items = activeCollectionId ? (collectionData[activeCollectionId] ?? []) : []

  function handleAddItem() {
    if (!activeCollectionId || !activeCollection) return
    const newItem: Record<string, any> = {}
    if (activeCollection.schema?.properties) {
      for (const [key, fieldSchema] of Object.entries(activeCollection.schema.properties) as [string, any][]) {
        if (fieldSchema.type === 'string') newItem[key] = ''
        else if (fieldSchema.type === 'number') newItem[key] = 0
        else if (fieldSchema.type === 'array') newItem[key] = []
        else if (fieldSchema.type === 'object' && fieldSchema.properties) {
          const obj: Record<string, any> = {}
          for (const [subKey, subSchema] of Object.entries(fieldSchema.properties) as [string, any][]) {
            if (subSchema.type === 'string') obj[subKey] = ''
            else if (subSchema.type === 'number') obj[subKey] = 0
          }
          newItem[key] = obj
        }
      }
    }
    addCollectionItem(activeCollectionId, newItem)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Collection selector */}
      {collections.length > 1 && (
        <div className="px-2 py-1.5 border-b border-white/10 flex-shrink-0">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveCollectionId(c.id)
                setSelectedCollectionItem(null)
              }}
              className={cn(
                'w-full text-left px-2 py-1.5 text-xs rounded transition-colors',
                activeCollectionId === c.id
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:bg-white/5'
              )}
            >
              {c.name} ({(collectionData[c.id] ?? []).length})
            </button>
          ))}
        </div>
      )}

      {/* Collection header */}
      {activeCollection && (
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <span className="text-label uppercase tracking-label text-muted-foreground">
            {activeCollection.name} ({items.length})
          </span>
          <button
            onClick={handleAddItem}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            + Add
          </button>
        </div>
      )}

      {/* Items list — click to select, edit in right CollectionEditorPanel */}
      {activeCollection && (
        <div className="flex-1 overflow-y-auto py-1">
          {items.map((item) => {
            const isSelected =
              selectedCollectionItem?.collectionId === activeCollectionId &&
              selectedCollectionItem?.itemId === item.id
            const displayName = item.title ?? item.name ?? item.slug ?? item.id

            return (
              <div key={item.id} className="mx-1 group">
                <div
                  onClick={() =>
                    setSelectedCollectionItem(
                      isSelected ? null : { collectionId: activeCollectionId!, itemId: item.id }
                    )
                  }
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-white/10 text-foreground'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <span className="flex-1 text-xs truncate">{displayName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isSelected) setSelectedCollectionItem(null)
                      removeCollectionItem(activeCollectionId!, item.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0"
                    title="Remove item"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
