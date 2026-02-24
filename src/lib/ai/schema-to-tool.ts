import type { ManifestSection } from '@/types'

// Sections skipped from AI extraction — handled separately
const SKIP_SECTIONS = new Set(['seo', 'navigation', 'footer'])

// Remove fields marked aiIgnore: true from a properties map
function filterAiIgnore(props: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!value?.aiIgnore) filtered[key] = value
  }
  return filtered
}

export function buildToolSchema(sections: ManifestSection[]) {
  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const section of sections) {
    if (SKIP_SECTIONS.has(section.id)) continue

    const schema = section.schema as any
    const isArray = section.dataType === 'array' || (schema?.type === 'array' && schema.items)

    if (isArray && schema.items) {
      // Array section — wrap as array of items
      properties[section.id] = {
        type: 'array',
        description: section.description,
        items: {
          type: 'object',
          properties: filterAiIgnore(schema.items.properties ?? {}),
          ...(schema.items.required && { required: schema.items.required }),
        },
      }
    } else {
      // Object section — extract nested properties
      properties[section.id] = {
        type: 'object',
        description: section.description,
        properties: filterAiIgnore(schema?.properties ?? {}),
        ...(schema?.required && { required: schema.required }),
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
