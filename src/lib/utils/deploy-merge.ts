// Merge user edits into a manifest for deployment.
// The merged manifest is the single artifact pushed to GitHub.

import type { TemplateManifest } from '@/types'

export function mergeUserDataIntoManifest(
  manifest: TemplateManifest,
  sectionData: Record<string, any>,
  collectionData: Record<string, any[]>,
  sectionsRegistry: Record<string, { enabled: boolean }>
): TemplateManifest {
  const merged: TemplateManifest = JSON.parse(JSON.stringify(manifest))

  for (const section of merged.sections) {
    if (sectionData[section.id] !== undefined) {
      section.data = sectionData[section.id]
    }
    if (sectionsRegistry[section.id] !== undefined) {
      ;(section as any).enabled = sectionsRegistry[section.id].enabled
    }
  }

  if (merged.collections) {
    for (const collection of merged.collections) {
      if (collectionData[collection.id] !== undefined) {
        collection.data = collectionData[collection.id]
      }
    }
  }

  return merged
}
