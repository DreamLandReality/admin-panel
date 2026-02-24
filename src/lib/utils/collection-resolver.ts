// Collection reference resolver — converts between ID references and full objects
// Used by preview-canvas, wizard-store, and deploy pipeline

import type { Collection, CollectionItem, TemplateManifest } from '@/types'

/**
 * Build a lookup map of all collection items by their ID.
 */
export function buildCollectionIndex(
  collections: Collection[]
): Map<string, CollectionItem> {
  const index = new Map<string, CollectionItem>()
  for (const col of collections) {
    for (const item of col.data) {
      index.set(item.id, item)
    }
  }
  return index
}

/**
 * Check if a manifest uses the collections pattern.
 */
export function hasCollections(manifest: TemplateManifest): boolean {
  return Array.isArray(manifest.collections) && manifest.collections.length > 0
}

/**
 * Resolve section data by replacing ID-reference arrays with full objects.
 * Walks through sectionData and replaces any array of string IDs that
 * match a collectionPicker schema with the corresponding objects.
 */
export function resolveReferences(
  sectionData: Record<string, any>,
  manifest: TemplateManifest
): Record<string, any> {
  if (!hasCollections(manifest)) return sectionData
  const index = buildCollectionIndex(manifest.collections!)
  const resolved = { ...sectionData }

  for (const section of manifest.sections) {
    if (!section.schema?.properties) continue
    const sData = resolved[section.id]
    if (!sData || typeof sData !== 'object') continue

    for (const [key, fieldSchema] of Object.entries(section.schema.properties) as [string, any][]) {
      if (fieldSchema.uiWidget === 'collectionPicker' && Array.isArray(sData[key])) {
        const refs = sData[key] as unknown[]
        // Only resolve if the array contains string IDs (not already-hydrated objects)
        if (refs.length > 0 && typeof refs[0] === 'string') {
          const hydrated = (refs as string[])
            .map((id) => index.get(id))
            .filter((item): item is CollectionItem => !!item)
          resolved[section.id] = { ...resolved[section.id], [key]: hydrated }
        }
      }
    }
  }

  return resolved
}

/**
 * Dehydrate: convert full objects back to ID references for storage.
 * Used when saving to DB (site_data should be sparse).
 */
export function dehydrateReferences(
  sectionData: Record<string, any>,
  manifest: TemplateManifest
): Record<string, any> {
  if (!hasCollections(manifest)) return sectionData
  const dehydrated = { ...sectionData }

  for (const section of manifest.sections) {
    if (!section.schema?.properties) continue
    const sData = dehydrated[section.id]
    if (!sData || typeof sData !== 'object') continue

    for (const [key, fieldSchema] of Object.entries(section.schema.properties) as [string, any][]) {
      if (fieldSchema.uiWidget === 'collectionPicker' && Array.isArray(sData[key])) {
        const items = sData[key]
        if (items.length > 0 && typeof items[0] === 'object' && items[0].id) {
          dehydrated[section.id] = {
            ...dehydrated[section.id],
            [key]: items.map((item: any) => item.id),
          }
        }
      }
    }
  }

  return dehydrated
}
