import type { ManifestSection } from '@/types'
import { findAiSkipSections } from '@/lib/constants'

// Remove fields marked aiIgnore: true — recurses into nested objects and syncs required arrays
function filterAiIgnore(props: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value?.aiIgnore) continue
    if (value?.properties) {
      const cleanedProps = filterAiIgnore(value.properties)
      const cleanedRequired = (value.required as string[] | undefined)?.filter((k: string) => k in cleanedProps)
      filtered[key] = {
        ...value,
        properties: cleanedProps,
        ...(cleanedRequired?.length ? { required: cleanedRequired } : { required: undefined }),
      }
    } else {
      filtered[key] = value
    }
  }
  return filtered
}

export function buildToolSchema(sections: ManifestSection[]) {
  const skipSections = findAiSkipSections(sections as any[])
  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const section of sections) {
    if (skipSections.has(section.id)) continue

    const schema = section.schema as any
    const isArray = section.dataType === 'array' || (schema?.type === 'array' && schema.items)

    if (isArray && schema.items) {
      const filteredItemProps = filterAiIgnore(schema.items.properties ?? {})
      const filteredItemRequired = (schema.items.required as string[] | undefined)
        ?.filter((k: string) => k in filteredItemProps)
      properties[section.id] = {
        type: 'array',
        description: section.description,
        items: {
          type: 'object',
          properties: filteredItemProps,
          ...(filteredItemRequired?.length && { required: filteredItemRequired }),
        },
      }
    } else {
      const filteredProps = filterAiIgnore(schema?.properties ?? {})
      const filteredRequired = (schema?.required as string[] | undefined)
        ?.filter((k: string) => k in filteredProps)
      properties[section.id] = {
        type: 'object',
        description: section.description,
        properties: filteredProps,
        ...(filteredRequired?.length && { required: filteredRequired }),
      }
    }

    if (section.required) required.push(section.id)
  }

  return {
    name: 'save_property_data',
    description: 'Save structured property data extracted from input.',
    input_schema: { type: 'object' as const, properties, required },
  }
}
