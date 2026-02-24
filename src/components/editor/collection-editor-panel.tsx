'use client'

import { useWizardStore } from '@/stores/wizard-store'
import { slugify } from '@/lib/utils/slugify'
import { SchemaFieldRenderer } from './schema-field-renderer'
import type { Collection } from '@/types'

// ─── CollectionEditorPanel ──────────────────────────────────────────────────

export function CollectionEditorPanel() {
  const selectedCollectionItem = useWizardStore((s) => s.selectedCollectionItem)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const collectionData = useWizardStore((s) => s.collectionData)
  const updateCollectionItem = useWizardStore((s) => s.updateCollectionItem)
  const setBlobUrl = useWizardStore((s) => s.setBlobUrl)
  const setDataUrl = useWizardStore((s) => s.setDataUrl)
  const addPendingImage = useWizardStore((s) => s.addPendingImage)
  const projectName = useWizardStore((s) => s.projectName)

  if (!selectedCollectionItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7V4h16v3M9 20h6M12 4v16" />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Select an item from the left panel to edit its fields.
        </p>
      </div>
    )
  }

  const { collectionId, itemId } = selectedCollectionItem
  const collections: Collection[] = (selectedTemplate?.manifest?.collections as Collection[]) ?? []
  const collection = collections.find((c) => c.id === collectionId)
  const items = collectionData[collectionId] ?? []
  const item = items.find((i) => i.id === itemId)

  if (!collection || !item) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Item not found. It may have been removed.
        </p>
      </div>
    )
  }

  const schema = collection.schema
  const displayName = item.title ?? item.name ?? item.slug ?? item.id

  function handleChange(field: string, value: any) {
    updateCollectionItem(collectionId, itemId, field, value)
  }

  function handleImageUpload(fieldPath: string, url: string, file?: File) {
    const blobKey = `${collectionId}.${itemId}.${fieldPath}`
    setBlobUrl(blobKey, url)
    if (file) {
      const slug = slugify(projectName)
      const ext = file.name.split('.').pop() || 'png'
      const r2Key = `sites/${slug}/${collectionId}/${itemId}/${fieldPath}.${ext}`
      addPendingImage(blobKey, { blobUrl: url, file, r2Key })
      const reader = new FileReader()
      reader.onload = () => setDataUrl(url, reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-white/5">
        <p className="text-label uppercase tracking-label text-muted-foreground mb-1">
          {collection.name}
        </p>
        <h2 className="text-lg font-medium text-foreground">{displayName}</h2>
      </div>

      {/* Fields */}
      {schema?.properties && (
        <SchemaFieldRenderer
          properties={schema.properties}
          data={item}
          onChange={handleChange}
          onImageUpload={handleImageUpload}
          collectionData={collectionData}
        />
      )}
    </div>
  )
}
