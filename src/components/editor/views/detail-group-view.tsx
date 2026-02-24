'use client'

import { useRef } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { usePageList } from '@/hooks/use-page-list'
import { postToIframe } from '@/lib/utils/iframe'
import { slugify } from '@/lib/utils/slugify'
import { SchemaFieldRenderer } from '../schema-field-renderer'
import type { ManifestSection, FieldGroup } from '@/types'

// ─── DetailGroupView ─────────────────────────────────────────────────────────

export function DetailGroupView({ groupId, iframeRef }: { groupId: string; iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const sectionData = useWizardStore((s) => s.sectionData)
  const collectionData = useWizardStore((s) => s.collectionData)
  const activePage = useWizardStore((s) => s.activePage)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const updateArrayItemField = useWizardStore((s) => s.updateArrayItemField)
  const updateCollectionItem = useWizardStore((s) => s.updateCollectionItem)
  const setBlobUrl = useWizardStore((s) => s.setBlobUrl)
  const setDataUrl = useWizardStore((s) => s.setDataUrl)
  const addPendingImage = useWizardStore((s) => s.addPendingImage)
  const projectName = useWizardStore((s) => s.projectName)

  const manifest = selectedTemplate?.manifest
  const pageList = usePageList()

  // Find the dynamic page definition matching the active page
  const activeEntry = pageList.find((p) => p.id === activePage)
  const dynamicPageDef = activeEntry?.dynamicPageId
    ? manifest?.pages?.find((p: any) => p.dynamic && p.id === activeEntry.dynamicPageId)
    : null
  const sourceSection = dynamicPageDef?.sourceSection
  const sourceCollection = dynamicPageDef?.sourceCollection
  const slugField = dynamicPageDef?.slugField ?? 'slug'
  const detailSectionId = dynamicPageDef?.detailSectionId ?? sourceSection
  const fieldGroups: FieldGroup[] = dynamicPageDef?.fieldGroups ?? []

  // Find the matching array item — prefer collection data, fall back to section data
  const itemsPath = dynamicPageDef?.itemsPath
  const useCollection = !!(sourceCollection && collectionData[sourceCollection] !== undefined)
  let items: any[]
  if (useCollection) {
    items = collectionData[sourceCollection] ?? []
  } else {
    const rawSectionData = sourceSection ? sectionData[sourceSection] : null
    items = (itemsPath && rawSectionData && !Array.isArray(rawSectionData)
      ? (rawSectionData as any)[itemsPath]
      : rawSectionData ?? []) as any[]
  }
  const itemIndex = Array.isArray(items) ? items.findIndex((item: any) => item[slugField] === activePage) : -1
  const itemData = items[itemIndex] ?? {}

  // Find the schema — prefer collection schema, fall back to section schema
  const collectionDef = sourceCollection
    ? manifest?.collections?.find((c: any) => c.id === sourceCollection)
    : null
  const sectionDef = manifest?.sections?.find((s: ManifestSection) => s.id === sourceSection)
  const itemSchema = useCollection && collectionDef?.schema
    ? collectionDef.schema
    : (itemsPath && sectionDef?.schema?.properties?.[itemsPath]
      ? (sectionDef.schema.properties[itemsPath] as any)?.items
      : sectionDef?.schema?.items) as any

  // Find the field group
  const groupEntry = fieldGroups.find((g: FieldGroup) => g.id === groupId)
  const groupFields = groupEntry?.fields ?? []

  // Set to true by handleImageUpload just before SchemaFieldRenderer calls onChange.
  // Tells handleChange to skip the field-update postMessage — blob URLs can't cross origins.
  // sendFullUpdate (triggered when setDataUrl fires) sends the correct data URL instead.
  const skipNextIframePost = useRef(false)

  function handleChange(key: string, value: any) {
    if (itemIndex < 0) return
    if (useCollection && sourceCollection) {
      const itemId = items[itemIndex]?.id
      if (itemId) updateCollectionItem(sourceCollection, itemId, key, value)
    } else if (sourceSection) {
      updateArrayItemField(sourceSection, itemIndex, key, value, itemsPath)
    }
    if (detailSectionId && !skipNextIframePost.current) {
      postToIframe(iframeRef, { type: 'field-update', sectionId: detailSectionId, field: key, value })
    }
    skipNextIframePost.current = false
  }

  function handleImageUpload(fieldPath: string, url: string, file?: File) {
    // Signal handleChange (called right after this) to skip posting the blob URL to the iframe
    skipNextIframePost.current = true
    const blobKey = useCollection
      ? `${sourceCollection}.${activePage}.${fieldPath}`
      : `${sourceSection}.${itemIndex}.${fieldPath}`
    setBlobUrl(blobKey, url)
    if (file) {
      const slug = slugify(projectName)
      const ext = file.name.split('.').pop() || 'png'
      const itemId = items[itemIndex]?.id ?? activePage
      const sectionKey = useCollection ? sourceCollection : sourceSection
      const r2Key = `sites/${slug}/${sectionKey}/${itemId}/${fieldPath}.${ext}`
      addPendingImage(blobKey, { blobUrl: url, file, r2Key })
      // Convert blob URL to data URL. setDataUrl triggers sendFullUpdate which replaces
      // all blob URLs in the payload with data URLs before sending to the cross-origin iframe.
      const reader = new FileReader()
      reader.onload = () => setDataUrl(url, reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  if (itemIndex < 0) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-sm text-muted-foreground">Item not found</p>
      </div>
    )
  }

  return (
    <div>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-editor-surface border-b border-white/5">
        <p className="text-label-lg uppercase tracking-label text-muted-foreground">{groupEntry?.label ?? groupId}</p>
      </div>

      <div className="px-4 space-y-3 pb-4 pt-3">
        <SchemaFieldRenderer
          properties={itemSchema?.properties}
          data={itemData}
          onChange={handleChange}
          onImageUpload={handleImageUpload}
          fields={groupFields}
          collectionData={collectionData}
        />
      </div>
    </div>
  )
}
