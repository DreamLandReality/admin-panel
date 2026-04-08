import type { ManifestSection, SectionStyleControls } from '@/types'

/**
 * Extract default styles for a specific field from manifest styleControls.
 * Returns a Record<cssProperty, defaultValue> — responsive controls return
 * { desktop, tablet, mobile } objects instead of flat strings.
 */
export function getFieldDefaults(
  styleControls: SectionStyleControls | undefined,
  field: string
): Record<string, any> {
  const controls = field === '__section'
    ? styleControls?.section
    : styleControls?.fields?.[field]
  if (!controls) return {}

  const defaults: Record<string, any> = {}
  for (const ctrl of controls) {
    if (ctrl.default != null) {
      if (ctrl.responsive) {
        defaults[ctrl.property] = { desktop: ctrl.default, tablet: ctrl.default, mobile: ctrl.default }
      } else {
        defaults[ctrl.property] = ctrl.default
      }
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
): Record<string, Record<string, any>> {
  const sc = section.styleControls
  if (!sc) return {}

  const result: Record<string, Record<string, any>> = {}

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
): Record<string, Record<string, any>> {
  const defaults = getSectionDefaults(section)
  const resolved: Record<string, Record<string, any>> = {}

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
    const fieldOverrides = sectionData[`${field}__style`] as Record<string, any> | undefined
    resolved[field] = { ...fieldDefaults, ...fieldOverrides }
  }

  return resolved
}
