/**
 * Build Field Maps Utility
 * 
 * Walks the template manifest and extracts editability and constraint metadata
 * for all fields across all sections. Supports nested objects and dot-notation paths.
 * 
 * Used by wizard-store to populate editabilityMap and constraintsMap on template load.
 */

import type { TemplateManifest, FieldSchema, FieldConstraints } from '@/types'

export interface FieldMaps {
  editabilityMap: Record<string, Record<string, boolean>>
  constraintsMap: Record<string, Record<string, FieldConstraints>>
}

/**
 * Recursively walk a schema and extract field metadata.
 * Builds dot-notation paths for nested objects (e.g. "location.address").
 */
function walkSchema(
  properties: Record<string, FieldSchema> | undefined,
  prefix: string,
  editabilityMap: Record<string, boolean>,
  constraintsMap: Record<string, FieldConstraints>
): void {
  if (!properties) return

  for (const [key, fieldSchema] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key

    // Default editable to true if omitted (backward compatible)
    const editable = fieldSchema.editable !== false
    editabilityMap[fieldPath] = editable

    // Store constraints if present
    if (fieldSchema.constraints) {
      constraintsMap[fieldPath] = fieldSchema.constraints
    }

    // Recurse into nested objects
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      walkSchema(fieldSchema.properties, fieldPath, editabilityMap, constraintsMap)
    }

    // For arrays with object items, walk the item schema
    if (fieldSchema.type === 'array' && fieldSchema.items?.properties) {
      // Array items use index-based paths at runtime (e.g. "gallery.0.src")
      // but we store the base path pattern for constraint lookup
      walkSchema(fieldSchema.items.properties, `${fieldPath}.*`, editabilityMap, constraintsMap)
    }
  }
}

/**
 * Build editability and constraints maps from a template manifest.
 * 
 * Returns two maps keyed by sectionId:
 * - editabilityMap: sectionId → fieldPath → boolean (whether field can be edited)
 * - constraintsMap: sectionId → fieldPath → FieldConstraints (validation rules)
 * 
 * @param manifest - The template manifest containing sections and their schemas
 * @returns FieldMaps object with both maps
 */
export function buildFieldMaps(manifest: TemplateManifest | null | undefined): FieldMaps {
  const editabilityMap: Record<string, Record<string, boolean>> = {}
  const constraintsMap: Record<string, Record<string, FieldConstraints>> = {}

  if (!manifest?.sections) {
    return { editabilityMap, constraintsMap }
  }

  for (const section of manifest.sections) {
    const sectionEditability: Record<string, boolean> = {}
    const sectionConstraints: Record<string, FieldConstraints> = {}

    // Walk the section schema
    if (section.schema?.properties) {
      walkSchema(section.schema.properties, '', sectionEditability, sectionConstraints)
    }

    editabilityMap[section.id] = sectionEditability
    constraintsMap[section.id] = sectionConstraints
  }

  // Also process collections (they have schemas too)
  if (manifest.collections) {
    for (const collection of manifest.collections) {
      const collectionEditability: Record<string, boolean> = {}
      const collectionConstraints: Record<string, FieldConstraints> = {}

      if (collection.schema?.properties) {
        walkSchema(collection.schema.properties, '', collectionEditability, collectionConstraints)
      }

      editabilityMap[collection.id] = collectionEditability
      constraintsMap[collection.id] = collectionConstraints
    }
  }

  return { editabilityMap, constraintsMap }
}

/**
 * Apply constraints to a value before storing it.
 * Never rejects — always returns a valid constrained value.
 * 
 * @param value - The raw value to constrain
 * @param constraints - The constraints to apply
 * @param fieldType - The field type (string, number, etc.)
 * @returns The constrained value
 */
export function applyConstraints(
  value: any,
  constraints: FieldConstraints | undefined,
  fieldType: string
): any {
  if (!constraints) return value

  // String constraints
  if (fieldType === 'string' && typeof value === 'string') {
    let result = value

    // Max length: trim to maxLength
    if (constraints.maxLength !== undefined && result.length > constraints.maxLength) {
      result = result.slice(0, constraints.maxLength)
    }

    // Pattern validation (optional - could log warning but still accept)
    if (constraints.pattern && !new RegExp(constraints.pattern).test(result)) {
      console.warn(`[constraints] Value "${result}" does not match pattern ${constraints.pattern}`)
    }

    return result
  }

  // Number constraints
  if (fieldType === 'number' && typeof value === 'number') {
    let result = value

    // Clamp to min/max
    if (constraints.min !== undefined && result < constraints.min) {
      result = constraints.min
    }
    if (constraints.max !== undefined && result > constraints.max) {
      result = constraints.max
    }

    return result
  }

  // Array constraints (checked at add/remove time, not here)
  // This function is for scalar values

  return value
}
