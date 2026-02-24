import type { ManifestSection, SectionStyleControls } from '@/types'

/**
 * Extract default styles for a specific field from manifest styleControls.
 * Returns a Record<cssProperty, defaultValue> e.g. { textAlign: "center", fontWeight: "400" }
 */
export function getFieldDefaults(
  styleControls: SectionStyleControls | undefined,
  field: string
): Record<string, string> {
  const controls = field === '__section'
    ? styleControls?.section
    : styleControls?.fields?.[field]
  if (!controls) return {}

  const defaults: Record<string, string> = {}
  for (const ctrl of controls) {
    if (ctrl.default != null) {
      defaults[ctrl.property] = ctrl.default
      if (ctrl.linked) {
        defaults[ctrl.linked] = ctrl.default
      }
    }
  }
  return defaults
}

/**
 * Extract ALL default styles for a section (all fields + section-level).
 * Returns { fieldName: { cssProp: value }, __section: { cssProp: value } }
 */
export function getSectionDefaults(
  section: ManifestSection
): Record<string, Record<string, string>> {
  const sc = section.styleControls
  if (!sc) return {}

  const result: Record<string, Record<string, string>> = {}

  if (sc.fields) {
    for (const field of Object.keys(sc.fields)) {
      const defaults = getFieldDefaults(sc, field)
      if (Object.keys(defaults).length > 0) {
        result[field] = defaults
      }
    }
  }

  const sectionDefaults = getFieldDefaults(sc, '__section')
  if (Object.keys(sectionDefaults).length > 0) {
    result['__section'] = sectionDefaults
  }

  return result
}

/**
 * Resolve all styles for a section: defaults + overrides for every field.
 * Used when sending full-update to iframe.
 */
export function resolveAllSectionStyles(
  section: ManifestSection,
  sectionData: Record<string, any>
): Record<string, Record<string, string>> {
  const defaults = getSectionDefaults(section)
  const resolved: Record<string, Record<string, string>> = {}

  // Deduplicate fields that have either defaults or overrides
  const seen: Record<string, true> = {}
  const allFields: string[] = []
  for (const k of Object.keys(defaults)) {
    if (!seen[k]) { seen[k] = true; allFields.push(k) }
  }
  for (const k of Object.keys(sectionData)) {
    if (k.endsWith('__style')) {
      const field = k.slice(0, -7)
      if (!seen[field]) { seen[field] = true; allFields.push(field) }
    }
  }

  for (const field of allFields) {
    const fieldDefaults = defaults[field] ?? {}
    const fieldOverrides = sectionData[`${field}__style`] as Record<string, string> | undefined
    resolved[field] = { ...fieldDefaults, ...fieldOverrides }
  }

  return resolved
}
