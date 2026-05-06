import type { FieldSchema, SectionSchema } from '@/types'
import { isRecord } from '@/lib/api/contracts'

export type FieldValue = unknown
export type FieldData = Record<string, unknown>
export type FieldProperties = Record<string, FieldSchema>
export { isRecord }

export function findEmbeddedArrayKey(schema: SectionSchema | undefined): string | null {
  if (schema?.type !== 'object' || !schema.properties) return null

  return Object.keys(schema.properties).find((key) => {
    const property = schema.properties?.[key]
    return property?.type === 'array' && property.items?.type === 'object' && property.uiWidget !== 'repeater'
  }) ?? null
}

export function getObjectFieldProperties(
  schema: SectionSchema | undefined,
  embeddedArrayKey: string | null
): FieldProperties {
  if (!embeddedArrayKey || !schema?.properties) return {}

  return Object.fromEntries(
    Object.entries(schema.properties).filter(([key]) => key !== embeddedArrayKey)
  )
}

export function getArrayItems(data: unknown, embeddedArrayKey: string | null): FieldData[] {
  const rawItems = embeddedArrayKey && isRecord(data)
    ? data[embeddedArrayKey]
    : data

  return Array.isArray(rawItems) ? rawItems as FieldData[] : []
}

export function getArrayItemProperties(
  schema: SectionSchema | undefined,
  embeddedArrayKey: string | null
): FieldProperties | undefined {
  if (!schema) return undefined
  if (embeddedArrayKey) {
    return schema.properties?.[embeddedArrayKey]?.items?.properties
  }
  return schema.items?.properties
}

export function getArrayItemLabel(item: FieldData, index: number): string {
  const label = item.title ?? item.label ?? item.name
  return typeof label === 'string' && label.length > 0 ? label : `Item ${index + 1}`
}

export function createEmptyArrayItem(itemProperties: FieldProperties | undefined): FieldData {
  const newItem: FieldData = {}

  for (const [key, schema] of Object.entries(itemProperties ?? {})) {
    if (schema.type === 'number') newItem[key] = 0
    else if (schema.type === 'object') newItem[key] = {}
    else if (schema.type === 'array') newItem[key] = []
    else newItem[key] = ''
  }

  return newItem
}
