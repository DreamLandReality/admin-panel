'use client'

import { useWizardStore } from '@/stores/wizard-store'
import { postToIframe } from '@/lib/utils/iframe'
import { SchemaFieldRenderer } from '../schema-field-renderer'
import type { ManifestSection } from '@/types'

// ─── SharedLabelsView ─────────────────────────────────────────────────────────

export function SharedLabelsView({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const { selection, sectionData, selectedTemplate, updateField } = useWizardStore()
  const { sectionId } = selection
  if (!sectionId) return null

  // sectionId format: "labels:{sharedSectionId}" or "labels:{sharedSectionId}:{groupId}"
  const withoutPrefix = sectionId.replace('labels:', '')
  const colonIdx = withoutPrefix.indexOf(':')
  const labelTarget = colonIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, colonIdx)
  const groupId = colonIdx === -1 ? undefined : withoutPrefix.slice(colonIdx + 1)
  const manifest = selectedTemplate?.manifest

  const dynPageDef = manifest?.pages?.find(
    (p: any) => p.dynamic && p.sharedSectionId === labelTarget
  )
  const sharedSectionId: string | undefined = dynPageDef?.sharedSectionId
  const detailSectionId: string = dynPageDef?.detailSectionId ?? dynPageDef?.sourceSection ?? labelTarget

  // Resolve full schema and data from the dedicated labels section
  const sectionDef = sharedSectionId
    ? manifest?.sections?.find((s: ManifestSection) => s.id === sharedSectionId)
    : undefined
  const fullSchema: any = sectionDef?.schema
  const labelsData: Record<string, any> = sharedSectionId
    ? ((sectionData[sharedSectionId] as Record<string, any>) ?? {})
    : {}

  // Filter schema to the active group's fields (if a groupId is present)
  const activeGroup = groupId
    ? (dynPageDef?.sharedFieldGroups ?? []).find((g: any) => g.id === groupId)
    : undefined
  const labelsSchema = activeGroup && fullSchema?.properties
    ? { ...fullSchema, properties: Object.fromEntries(Object.entries(fullSchema.properties).filter(([k]) => activeGroup.fields.includes(k))) }
    : fullSchema

  if (!labelsSchema?.properties) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          No shared label fields configured for this page type.
        </p>
      </div>
    )
  }

  function handleChange(field: string, value: any) {
    if (sharedSectionId) {
      updateField(sharedSectionId, field, value)
    }
    postToIframe(iframeRef, { type: 'field-update', sectionId: detailSectionId, field, value })
  }

  const headerTitle = activeGroup?.label ?? 'Detail Page Labels'

  return (
    <div>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-editor-surface border-b border-white/5">
        <p className="text-label-lg uppercase tracking-label text-muted-foreground">
          {headerTitle}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          Appears on all {dynPageDef?.name?.toLowerCase() ?? 'detail'} pages
        </p>
      </div>
      <div className="px-4 space-y-3 pb-4 pt-3">
        <SchemaFieldRenderer
          properties={labelsSchema.properties}
          data={labelsData}
          onChange={handleChange}
          skipSystem={false}
        />
      </div>
    </div>
  )
}
