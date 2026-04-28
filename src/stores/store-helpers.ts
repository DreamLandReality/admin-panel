import type { PendingImage, SectionRegistry } from '@/types'
import type { Selection } from './store-types'

export const defaultSelection: Selection = {
  mode: null,
  sectionId: null,
  field: null,
  elementType: null,
  content: null,
  itemIndex: null,
}

export function setNested(obj: Record<string, any>, parts: string[], value: any): Record<string, any> {
  if (parts.length === 1) return { ...obj, [parts[0]]: value }
  const key = parts[0]
  return {
    ...obj,
    [key]: setNested(
      obj[key] != null && typeof obj[key] === 'object' ? obj[key] : {},
      parts.slice(1),
      value
    ),
  }
}

export function setNestedMutable(obj: Record<string, any>, parts: string[], value: any) {
  let cursor = obj
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {}
    cursor = cursor[parts[i]]
  }
  cursor[parts[parts.length - 1]] = value
}

export function seedSectionsRegistry(
  registry: Record<string, SectionRegistry>,
  manifest: any
): Record<string, SectionRegistry> {
  const result = { ...registry }
  for (const section of manifest?.sections ?? []) {
    if (!(section.id in result)) {
      result[section.id] = { enabled: section.enabled !== false, showInNav: section.showInNav === true }
    } else if (result[section.id].showInNav === undefined) {
      result[section.id] = { ...result[section.id], showInNav: section.showInNav === true }
    }
  }
  return result
}

export function buildSectionsRegistry(manifest: any): Record<string, SectionRegistry> {
  const sections: Record<string, SectionRegistry> = {}
  manifest?.sections?.forEach((section: any) => {
    sections[section.id] = { enabled: section.enabled !== false, showInNav: section.showInNav === true }
  })
  return sections
}

export function buildCollectionData(manifest: any): Record<string, any[]> {
  const collectionData: Record<string, any[]> = {}
  for (const collection of manifest?.collections ?? []) {
    collectionData[collection.id] = collection.data ?? []
  }
  return collectionData
}

export function migrateLegacyCollectionReferences(
  sectionData: Record<string, any>,
  collectionData: Record<string, any[]>,
  manifest: any
) {
  for (const section of manifest?.sections ?? []) {
    const current = sectionData[section.id]
    if (!current || typeof current !== 'object') continue
    for (const [key, fieldSchema] of Object.entries(section.schema?.properties ?? {}) as [string, any][]) {
      if (fieldSchema.uiWidget === 'collectionPicker' && fieldSchema.collectionId && Array.isArray(current[key])) {
        const items = current[key]
        if (items.length > 0 && typeof items[0] === 'object') {
          collectionData[fieldSchema.collectionId] = items.map((item: any, index: number) => ({
            id: item.id ?? `${fieldSchema.collectionId}_${index + 1}`,
            ...item,
          }))
          sectionData[section.id] = {
            ...current,
            [key]: collectionData[fieldSchema.collectionId].map((item: any) => item.id),
          }
        }
      }
    }
  }
}

export function seedMissingSectionData(sectionData: Record<string, any>, manifest: any) {
  for (const section of manifest?.sections ?? []) {
    if (!(section.id in sectionData) && section.data) {
      sectionData[section.id] = section.data
    }
  }
}

export function revokeAllBlobs(blobUrls: Record<string, string>, pendingImages: Record<string, PendingImage>) {
  for (const url of Object.values(blobUrls)) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url) } catch { /* non-fatal */ }
    }
  }
  for (const pending of Object.values(pendingImages)) {
    if (pending.blobUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(pending.blobUrl) } catch { /* non-fatal */ }
    }
  }
}
