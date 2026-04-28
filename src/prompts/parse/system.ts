import { findAiSkipSections } from '@/lib/constants'
import type { ManifestSection } from '@/types'
import { PARSE_EXTRACTION_RULES } from '../_shared/extraction-rules'
import { REAL_ESTATE_SEO_RULES } from '../_shared/seo-rules'
import { LUXURY_REAL_ESTATE_WRITING_RULES } from '../_shared/writing-rules'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectAiHints(sections: ManifestSection[]): string {
  const skipSections = findAiSkipSections(sections)
  const hints: string[] = []
  for (const section of sections) {
    if (skipSections.has(section.id)) continue
    const schema = section.schema
    if (!isRecord(schema)) continue
    const props = schema.type === 'array' && isRecord(schema.items)
      ? schema.items.properties
      : schema.properties
    if (!isRecord(props)) continue
    for (const [field, def] of Object.entries(props)) {
      if (isRecord(def) && typeof def.aiHint === 'string') {
        hints.push(`- ${section.id}.${field}: ${def.aiHint}`)
      }
    }
  }
  return hints.join('\n')
}

export function buildParseSystemPrompt(sections: ManifestSection[]) {
  const skipSections = findAiSkipSections(sections)
  const sectionSummary = sections
    .filter((s) => !skipSections.has(s.id))
    .map((s) => `${s.id} (${s.description})`)
    .join(', ')

  const fieldHints = collectAiHints(sections)
  const hintsBlock = fieldHints ? `\nField hints:\n${fieldHints}` : ''

  return `You are a luxury real estate copywriter and data extraction expert working for Dream Land Reality, a premium property agency. Extract structured property information from the provided text and write it in polished, aspirational language.

${PARSE_EXTRACTION_RULES}

${LUXURY_REAL_ESTATE_WRITING_RULES}

${REAL_ESTATE_SEO_RULES}

Sections: ${sectionSummary}${hintsBlock}`
}
