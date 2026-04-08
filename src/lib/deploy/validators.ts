import type { SiteData, TemplateManifest, ValidationError } from '@/types'

/**
 * Walk every value in an object/array tree and collect string leaves.
 * Returns an array of [path, value] pairs for each string found.
 */
function walkStrings(node: unknown, path = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => walkStrings(item, `${path}[${i}]`))
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) =>
      walkStrings(v, path ? `${path}.${k}` : k)
    )
  }
  return []
}

/**
 * Recursively find all fields in a manifest section schema with a given uiWidget.
 */
function findWidgetFields(schema: any, widget: string, prefix = ''): string[] {
  if (!schema || typeof schema !== 'object') return []
  const found: string[] = []

  if (schema.properties) {
    for (const [key, field] of Object.entries(schema.properties) as [string, any][]) {
      const fieldPath = prefix ? `${prefix}.${key}` : key
      if (field.uiWidget === widget) {
        found.push(fieldPath)
      }
      if (field.properties) {
        found.push(...findWidgetFields(field, widget, fieldPath))
      }
      if (field.items) {
        found.push(...findWidgetFields(field.items, widget, `${fieldPath}[]`))
      }
    }
  }

  if (schema.items?.properties) {
    found.push(...findWidgetFields(schema.items, widget, prefix))
  }

  return found
}

/**
 * Resolve a dot-notation path into a value from an object.
 * Returns undefined if the path doesn't resolve.
 */
function getByPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined
    return (acc as any)[key]
  }, obj)
}

export function validateDeployReady(
  siteData: SiteData,
  manifest: TemplateManifest,
  projectName: string
): { valid: boolean; errors: ValidationError[]; warnings: string[] } {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  // ── 1. Project name ────────────────────────────────────────────────────────
  if (!projectName || projectName.trim() === '') {
    errors.push({
      field: 'projectName',
      message: 'Project name is required',
      type: 'missing_required',
    })
  }

  // ── 2. No blob: URLs anywhere in site data ─────────────────────────────────
  const { _sections, _collections, ...sectionDataOnly } = siteData as any
  const allStrings = walkStrings(sectionDataOnly)

  for (const [path, value] of allStrings) {
    if (value.startsWith('blob:')) {
      errors.push({
        field: path,
        message: `Image at "${path}" has not been uploaded (blob URL detected). Save the draft first.`,
        type: 'blob_url',
      })
    }
  }

  // Also check collections
  if (_collections) {
    const collectionStrings = walkStrings(_collections, '_collections')
    for (const [path, value] of collectionStrings) {
      if (value.startsWith('blob:')) {
        errors.push({
          field: path,
          message: `Image in collection at "${path}" has not been uploaded (blob URL detected). Save the draft first.`,
          type: 'blob_url',
        })
      }
    }
  }

  // ── 3. Required sections must have data ───────────────────────────────────
  for (const section of manifest.sections) {
    if (!section.required) continue

    // Check if the section is enabled (defaults to true if not set)
    const sectionEnabled = _sections?.[section.id]?.enabled ?? true
    if (!sectionEnabled) continue

    const data = (siteData as any)[section.id]
    if (data === undefined || data === null) {
      errors.push({
        field: section.id,
        message: `Required section "${section.name}" has no data`,
        type: 'missing_data',
      })
      continue
    }

    // ── 4. Image fields must not be empty ────────────────────────────────────
    // Only hard-error if the top-level key is in the section's required[] array.
    // Nested / optional image fields become warnings instead.
    const schemaRequired: string[] = section.schema?.required ?? []
    const imageFields = findWidgetFields(section.schema, 'imageUpload')
    for (const fieldPath of imageFields) {
      const value = getByPath(data, fieldPath)
      if (!value || value === '') {
        const topLevelKey = fieldPath.split('.')[0]
        if (schemaRequired.includes(topLevelKey) && !fieldPath.includes('.')) {
          // Field is directly required at the top level
          errors.push({
            field: `${section.id}.${fieldPath}`,
            message: `Image field "${fieldPath}" in section "${section.name}" is empty`,
            type: 'missing_required',
          })
        } else {
          // Optional image — warn but don't block deploy
          warnings.push(`Image "${fieldPath}" in "${section.name}" is empty. Consider adding one.`)
        }
      }
    }

    // ── 5. collectionPicker fields must reference a non-empty collection ──────
    if (section.schema?.properties) {
      for (const [, fieldSchema] of Object.entries(section.schema.properties) as [string, any][]) {
        if (fieldSchema.uiWidget === 'collectionPicker') {
          const collectionId = fieldSchema.collectionId
          if (collectionId && _collections) {
            const items = _collections[collectionId]
            if (!Array.isArray(items) || items.length === 0) {
              errors.push({
                field: `_collections.${collectionId}`,
                message: `Collection "${collectionId}" used by "${section.name}" is empty. Add at least one item.`,
                type: 'missing_data',
              })
            }
          }
        }
      }
    }
  }

  // ── 6. Warnings: images still using template defaults (contain /templates/) ─
  const defaultImagePaths: string[] = []
  for (const [path, value] of allStrings) {
    if (
      typeof value === 'string' &&
      value.includes('/templates/') &&
      (value.includes('.jpg') || value.includes('.png') || value.includes('.webp') || value.includes('.jpeg'))
    ) {
      defaultImagePaths.push(path)
    }
  }
  if (defaultImagePaths.length > 0) {
    warnings.push(
      `${defaultImagePaths.length} image${defaultImagePaths.length > 1 ? 's' : ''} still use${defaultImagePaths.length === 1 ? 's' : ''} template defaults. Consider uploading custom images.`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
