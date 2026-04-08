'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { postToIframe } from '@/lib/utils/iframe'
import { slugify } from '@/lib/utils/slugify'
import { StyleSection } from '../style-controls'
import { SchemaFieldRenderer } from '../schema-field-renderer'
import { PanelHeader } from '@/components/layout/PanelHeader'
import type { ManifestSection } from '@/types'

/** Deep-walk data and replace blob URL strings with their data URL equivalents */
function resolveBlobUrls(data: any, map: Record<string, string>): any {
  if (typeof data === 'string') return map[data] ?? data
  if (Array.isArray(data)) return data.map((item) => resolveBlobUrls(item, map))
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, resolveBlobUrls(v, map)]))
  }
  return data
}

// ─── SectionFieldsView ──────────────────────────────────────────────────────

export function SectionFieldsView({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const sectionId = useWizardStore((s) => s.selection.sectionId)
  const sectionData = useWizardStore((s) => s.sectionData)
  const collectionData = useWizardStore((s) => s.collectionData)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const updateField = useWizardStore((s) => s.updateField)
  const setBlobUrl = useWizardStore((s) => s.setBlobUrl)
  const setDataUrl = useWizardStore((s) => s.setDataUrl)
  const addPendingImage = useWizardStore((s) => s.addPendingImage)
  const projectName = useWizardStore((s) => s.projectName)
  const addArrayItem = useWizardStore((s) => s.addArrayItem)
  const removeArrayItem = useWizardStore((s) => s.removeArrayItem)
  const updateArrayItemField = useWizardStore((s) => s.updateArrayItemField)

  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const selectionItemIndex = useWizardStore((s) => s.selection.itemIndex)
  const selectionField = useWizardStore((s) => s.selection.field)

  // Auto-expand array item when clicked in the preview iframe
  useEffect(() => {
    if (selectionItemIndex !== null && selectionItemIndex !== undefined) {
      setExpandedItem(selectionItemIndex)
    }
  }, [selectionItemIndex, selectionField])

  if (!sectionId) return null

  const manifest = selectedTemplate?.manifest
  const section = manifest?.sections?.find((s: ManifestSection) => s.id === sectionId)
  const schema = section?.schema as any
  const data = sectionData[sectionId]

  // Helper to update a field and sync to iframe
  function handleFieldChange(field: string, value: any) {
    updateField(sectionId!, field, value)
    // Blob URLs are origin-bound and cause black images in cross-origin iframes.
    // Resolve known blob→data URL mappings before sending. If any unresolved blob URLs
    // remain (FileReader still pending), skip — sendFullUpdate handles it after conversion.
    let resolved = value
    const dataUrlMap = useWizardStore.getState().dataUrls
    if (Object.keys(dataUrlMap).length > 0) {
      resolved = resolveBlobUrls(value, dataUrlMap)
    }
    const json = typeof resolved === 'string' ? resolved : JSON.stringify(resolved)
    if (json?.includes('blob:')) return
    postToIframe(iframeRef, { type: 'field-update', sectionId: sectionId!, field, value: resolved })
  }

  function handleImageUpload(fieldPath: string, url: string, file?: File) {
    setBlobUrl(`${sectionId}.${fieldPath}`, url)
    if (file) {
      const slug = slugify(projectName)
      const ext = file.name.split('.').pop() || 'png'
      const r2Key = `sites/${slug}/${sectionId}/${fieldPath}.${ext}`
      addPendingImage(`${sectionId}.${fieldPath}`, { blobUrl: url, file, r2Key })
      const reader = new FileReader()
      reader.onload = () => setDataUrl(url, reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  // Update array item field
  function handleArrayItemChange(index: number, field: string, value: any, path?: string) {
    updateArrayItemField(sectionId!, index, field, value, path)
  }

  function handleArrayItemImageUpload(index: number, key: string, url: string, arrayPath?: string, file?: File) {
    setBlobUrl(`${sectionId}.${index}.${key}`, url)
    handleArrayItemChange(index, key, url, arrayPath)
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setDataUrl(url, reader.result as string)
      reader.readAsDataURL(file)
      const slug = slugify(projectName)
      const ext = file.name.split('.').pop() || 'png'
      // Resolve item ID from section data
      const rawData = sectionData[sectionId!]
      const arrItems = arrayPath && rawData && !Array.isArray(rawData)
        ? (rawData as any)[arrayPath]
        : rawData
      const itemId = Array.isArray(arrItems) ? (arrItems[index]?.id ?? `item_${index}`) : `item_${index}`
      const r2Key = `sites/${slug}/${sectionId}/${itemId}/${key}.${ext}`
      addPendingImage(`${sectionId}.${index}.${key}`, { blobUrl: url, file, r2Key })
    }
  }

  // ── Style controls ──
  const styleDef = section?.styleControls
  const sectionStyleControls = styleDef?.section ?? []

  function renderStyleControls() {
    if (sectionStyleControls.length === 0) return null
    return (
      <>
        <div className="border-t border-white/5 mt-4 pt-4">
          <p className="text-label uppercase tracking-label text-muted-foreground mb-3">Layout</p>
        </div>
        <StyleSection
          label=""
          sectionId={sectionId!}
          styleKey="__section"
          controls={sectionStyleControls}
          iframeRef={iframeRef}
        />
      </>
    )
  }

  // ── Detect object-with-items sections ──
  // Only treat an array field as the section's top-level list when it is NOT a repeater widget.
  // Repeater widget arrays are rendered inline by SchemaFieldRenderer — they don't need special promotion.
  const embeddedArrayKey = schema?.type === 'object' && schema?.properties
    ? Object.keys(schema.properties).find((k: string) => {
        const prop = schema.properties[k]
        return prop?.type === 'array' && prop?.items?.type === 'object' && prop?.uiWidget !== 'repeater'
      })
    : null

  // ── Array-type section (pure array or object-with-items) ──
  if (schema?.type === 'array' || embeddedArrayKey) {
    const items = embeddedArrayKey
      ? (Array.isArray((data as any)?.[embeddedArrayKey]) ? (data as any)[embeddedArrayKey] : [])
      : (Array.isArray(data) ? (data as any[]) : [])
    const itemProperties = embeddedArrayKey
      ? schema.properties[embeddedArrayKey]?.items?.properties
      : schema.items?.properties
    const arrayPath = embeddedArrayKey || undefined

    // Collect non-array object fields for rendering above the list
    const objectFieldEntries = embeddedArrayKey && schema.properties
      ? Object.entries(schema.properties).filter(([k]: [string, any]) => k !== embeddedArrayKey)
      : []

    return (
      <div>
        <PanelHeader title={section?.name ?? sectionId ?? ''} sticky />
        <div className="px-2 pb-4 pt-3">
          {/* Render object-level fields above the items list */}
          {objectFieldEntries.length > 0 && (
            <div className="px-2 pb-3 mb-2 border-b border-white/5 space-y-3">
              <SchemaFieldRenderer
                properties={Object.fromEntries(objectFieldEntries)}
                data={data as Record<string, any>}
                onChange={handleFieldChange}
                onImageUpload={handleImageUpload}
                collectionData={collectionData}
                fieldStyleControls={styleDef?.fields ?? {}}
                sectionId={sectionId!}
                iframeRef={iframeRef}
              />
            </div>
          )}
          <div className="space-y-1">
            {items.map((item: any, i: number) => {
              const isExpanded = expandedItem === i
              return (
                <div key={i} className="rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : i)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-foreground hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{item.title || item.label || item.name || `Item ${i + 1}`}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeArrayItem(sectionId!, i, arrayPath)
                          if (expandedItem === i) setExpandedItem(null)
                        }}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
                        className={cn('transition-transform', isExpanded && 'rotate-90')}
                      >
                        <path d="M4.5 3L7.5 6l-3 3" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && itemProperties && (
                    <div className="px-3 pb-3 space-y-3">
                      <ArrayItemFields
                        item={item}
                        index={i}
                        itemProperties={itemProperties}
                        arrayPath={arrayPath}
                        onFieldChange={handleArrayItemChange}
                        onImageUpload={handleArrayItemImageUpload}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button
            onClick={() => {
              const newItem: Record<string, any> = {}
              if (itemProperties) {
                Object.entries(itemProperties).forEach(([k, s]: [string, any]) => {
                  if (s.type === 'number') newItem[k] = 0
                  else if (s.type === 'object') newItem[k] = {}
                  else if (s.type === 'array') newItem[k] = []
                  else newItem[k] = ''
                })
              }
              addArrayItem(sectionId!, newItem, arrayPath)
            }}
            className="w-full mt-2 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors"
          >
            + Add {section?.name?.replace(/s$/, '') || 'Item'}
          </button>

          {renderStyleControls()}
        </div>
      </div>
    )
  }

  // ── Object-type section ──
  return (
    <div>
      <PanelHeader title={section?.name ?? sectionId ?? ''} sticky />
      <div className="px-4 space-y-3 pb-4 pt-3">
        <SchemaFieldRenderer
          properties={schema?.properties}
          data={data as Record<string, any>}
          onChange={handleFieldChange}
          onImageUpload={handleImageUpload}
          collectionData={collectionData}
          fieldStyleControls={styleDef?.fields ?? {}}
          sectionId={sectionId!}
          iframeRef={iframeRef}
        />
        {renderStyleControls()}
      </div>
    </div>
  )
}

// ─── ArrayItemFields (expanded item in accordion) ────────────────────────────

function ArrayItemFields({
  item,
  index,
  itemProperties,
  arrayPath,
  onFieldChange,
  onImageUpload,
}: {
  item: any
  index: number
  itemProperties: Record<string, any>
  arrayPath?: string
  onFieldChange: (index: number, field: string, value: any, path?: string) => void
  onImageUpload: (index: number, key: string, url: string, arrayPath?: string, file?: File) => void
}) {
  return (
    <SchemaFieldRenderer
      properties={itemProperties}
      data={item}
      onChange={(fieldPath, value) => onFieldChange(index, fieldPath, value, arrayPath)}
      onImageUpload={(fieldPath, url, file) => onImageUpload(index, fieldPath, url, arrayPath, file)}
    />
  )
}
