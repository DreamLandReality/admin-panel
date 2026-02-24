import type { ManifestSection } from '@/types'

// Sections skipped from AI extraction — must match schema-to-tool.ts
const SKIP_SECTIONS = new Set(['seo', 'navigation', 'footer'])

function collectAiHints(sections: ManifestSection[]): string {
  const hints: string[] = []
  for (const section of sections) {
    if (SKIP_SECTIONS.has(section.id)) continue
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
  const sectionSummary = sections
    .filter((s) => !SKIP_SECTIONS.has(s.id))
    .map((s) => `${s.id} (${s.description})`)
    .join(', ')

  const fieldHints = collectAiHints(sections)
  const hintsBlock = fieldHints ? `\nField hints:\n${fieldHints}` : ''

  const systemPrompt = `You are a real estate data extraction expert. Extract all available property information from the provided text into the tool schema.

Rules:
- Use null for any field absent from the text — never invent data
- Detect locale from context (INR/crore/lakh/BHK = India; AED/dirham = Dubai; SGD = Singapore)
- For arrays, extract every item mentioned
- Generate SEO title (<60 chars), description (<155 chars), 5–8 keywords
- Prices: numeric where possible, string with currency symbol acceptable

Sections: ${sectionSummary}${hintsBlock}`

  const userPrompt = `Extract structured data from:\n\n${rawText}`

  return { systemPrompt, userPrompt }
}
