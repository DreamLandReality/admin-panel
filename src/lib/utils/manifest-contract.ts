import type { ManifestLeadSource, ManifestPage, ManifestSection, SharedGateAction, SharedGateConfig, TemplateManifest } from '@/types'

type SectionsRegistry = Record<string, { enabled: boolean; showInNav?: boolean }>

export type ResolvedLeadSource = {
  id: string
  label: string
  kind: string
  sectionId?: string
  gateId?: string
  known: boolean
}

function forEachStateTypeDefault(
  manifest: TemplateManifest | null | undefined,
  apply: (sectionId: string, field: string, defaultValue: unknown) => void
): void {
  for (const [statePath, stateType] of Object.entries(manifest?.stateTypes ?? {})) {
    const dotIndex = statePath.indexOf('.')
    if (dotIndex === -1) continue

    const sectionId = statePath.slice(0, dotIndex)
    const field = statePath.slice(dotIndex + 1)
    const defaultValue = stateType.default
    if (defaultValue !== undefined) {
      apply(sectionId, field, defaultValue)
    }
  }
}

export function seedSectionDataFromManifest<T extends Record<string, unknown>>(
  sectionData: T,
  manifest: TemplateManifest | null | undefined
): T {
  const result: Record<string, unknown> = { ...sectionData }

  for (const section of manifest?.sections ?? []) {
    if (!section.data) continue

    if (!(section.id in result)) {
      result[section.id] = section.data
      continue
    }

    const existing = result[section.id]
    if (existing === null || typeof existing !== 'object' || Array.isArray(existing)) continue

    const defaults = section.data as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing }
    for (const [key, defaultVal] of Object.entries(defaults)) {
      if (merged[key] === undefined || merged[key] === null) {
        merged[key] = defaultVal
      }
    }
    result[section.id] = merged
  }

  forEachStateTypeDefault(manifest, (sectionId, field, defaultValue) => {
    const existing = result[sectionId]
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      const existingObject = existing as Record<string, unknown>
      if (existingObject[field] === undefined || existingObject[field] === null) {
        result[sectionId] = { ...existingObject, [field]: defaultValue }
      }
    }
  })

  return result as T
}

export function seedManifestStateDefaults(manifest: TemplateManifest): void {
  forEachStateTypeDefault(manifest, (sectionId, field, defaultValue) => {
    const section = manifest.sections.find((s) => s.id === sectionId)
    if (!section) return

    const data = section.data as Record<string, unknown> | undefined
    if (!data || typeof data !== 'object' || Array.isArray(data)) return
    if (data[field] === undefined) {
      data[field] = defaultValue
    }
  })
}

export function normalizeManifestGates(manifest: TemplateManifest): void {
  const legacyGate = (manifest as unknown as { gate?: SharedGateConfig }).gate
  if (!Array.isArray(manifest.gates) && legacyGate && typeof legacyGate === 'object') {
    manifest.gates = [{ ...legacyGate, id: legacyGate.id ?? 'lead-capture' }]
  }
  delete (manifest as unknown as { gate?: unknown }).gate
}

export function getManifestDefaultPageId(
  manifest: Pick<TemplateManifest, 'pages'> | null | undefined
): string {
  const pages = manifest?.pages ?? []
  const staticPages = pages.filter((page) => !page.dynamic)
  return (
    staticPages.find((page) => page.path === '/')?.id ??
    staticPages[0]?.id ??
    pages[0]?.id ??
    ''
  )
}

export function getManifestDefaultPage(
  manifest: Pick<TemplateManifest, 'pages'> | null | undefined
): ManifestPage | undefined {
  const defaultPageId = getManifestDefaultPageId(manifest)
  return manifest?.pages?.find((page) => page.id === defaultPageId)
}

export function canShowSectionInNav(
  section: Pick<ManifestSection, 'id'> | null | undefined,
  manifest: Pick<TemplateManifest, 'pages'> | null | undefined
): boolean {
  if (!section) return false
  const defaultPage = getManifestDefaultPage(manifest)
  const pageSectionIds = defaultPage?.sections ?? []
  if (pageSectionIds.length === 0) return false
  return pageSectionIds.includes(section.id) && pageSectionIds[0] !== section.id
}

export function getLeadSources(
  manifest: Pick<TemplateManifest, 'leadSources'> | null | undefined
): Record<string, ManifestLeadSource> {
  return manifest?.leadSources ?? {}
}

function labelFromRawSource(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown'
}

export function resolveLeadSource(
  manifest: Pick<TemplateManifest, 'leadSources'> | null | undefined,
  formType: string | null | undefined
): ResolvedLeadSource {
  const id = formType?.trim() || 'unknown'
  const source = getLeadSources(manifest)[id]
  if (source) {
    return {
      id,
      label: source.label,
      kind: source.kind,
      sectionId: source.sectionId,
      gateId: source.gateId,
      known: true,
    }
  }

  return {
    id,
    label: `Unknown: ${labelFromRawSource(id)}`,
    kind: 'unknown',
    known: false,
  }
}

export function validateLeadSourceContract(manifest: TemplateManifest): string[] {
  const errors: string[] = []
  const sectionIds = new Set((manifest.sections ?? []).map((section) => section.id))
  const gateIds = new Set((manifest.gates ?? []).map((gate) => gate.id))

  for (const [sourceId, source] of Object.entries(manifest.leadSources ?? {})) {
    if (!source.label || !source.kind || !source.sectionId) {
      errors.push(`Lead source "${sourceId}" must declare label, kind, and sectionId.`)
      continue
    }

    if (!sectionIds.has(source.sectionId)) {
      errors.push(`Lead source "${sourceId}" references missing section "${source.sectionId}".`)
    }

    if (source.gateId && !gateIds.has(source.gateId)) {
      errors.push(`Lead source "${sourceId}" references missing gate "${source.gateId}".`)
    }
  }

  return errors
}

export function isManifestSectionEnabled(
  sectionId: string | undefined,
  sections: SectionsRegistry | undefined
): boolean {
  if (!sectionId || !sections || !(sectionId in sections)) return true
  return sections[sectionId]?.enabled !== false
}

export function filterGateActionsForSections(
  actions: SharedGateAction[] | undefined,
  sections: SectionsRegistry | undefined,
  actionOwnership?: Record<string, string[]>
): SharedGateAction[] {
  if (!Array.isArray(actions)) return []
  if (!sections) return actions

  return actions.filter((action) => {
    const ownerSectionIds = actionOwnership?.[action.id]
    if (Array.isArray(ownerSectionIds) && ownerSectionIds.length > 0) {
      return ownerSectionIds.some((sectionId) => isManifestSectionEnabled(sectionId, sections))
    }
    if (action.sectionId) return isManifestSectionEnabled(action.sectionId, sections)
    if (Array.isArray(action.sectionIds) && action.sectionIds.length > 0) {
      return action.sectionIds.some((sectionId) => isManifestSectionEnabled(sectionId, sections))
    }
    return true
  })
}
