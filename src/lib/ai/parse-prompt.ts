import type { ManifestSection } from '@/types'
import { findAiSkipSections } from '@/lib/constants'

function collectAiHints(sections: ManifestSection[]): string {
  const skipSections = findAiSkipSections(sections as any[])
  const hints: string[] = []
  for (const section of sections) {
    if (skipSections.has(section.id)) continue
    const schema = section.schema as any
    const props = schema?.type === 'array' ? schema.items?.properties : schema?.properties
    if (!props) continue
    for (const [field, def] of Object.entries(props as Record<string, any>)) {
      if (def?.aiHint) {
        hints.push(`- ${section.id}.${field}: ${def.aiHint}`)
      }
    }
  }
  return hints.join('\n')
}

export function buildParsePrompt(sections: ManifestSection[], rawText: string) {
  const skipSections = findAiSkipSections(sections as any[])
  const sectionSummary = sections
    .filter((s) => !skipSections.has(s.id))
    .map((s) => `${s.id} (${s.description})`)
    .join(', ')

  const fieldHints = collectAiHints(sections)
  const hintsBlock = fieldHints ? `\nField hints:\n${fieldHints}` : ''

  const systemPrompt = `You are a real estate data extraction expert. Extract all available property information from the provided text into the tool schema.

Rules:
- Use null for any field absent from the text — never invent data
- Detect locale from context (INR/crore/lakh/BHK = India; AED/dirham = Dubai; SGD = Singapore)
- For arrays, extract every item mentioned
- Generate SEO metadata:
  * title: 30-60 chars, include property type + location + key feature
  * description: 120-155 chars, compelling summary with price and top amenities
  * keywords: 5-8 items prioritizing property type, location, unique features
  * structuredData: fill propertyName, propertyType, priceRange, address fields from text
- Prices: numeric where possible, string with currency symbol acceptable

Sections: ${sectionSummary}${hintsBlock}`

  const userPrompt = `Extract structured data from:\n\n${rawText}`

  return { systemPrompt, userPrompt }
}
