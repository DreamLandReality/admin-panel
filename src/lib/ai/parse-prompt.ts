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

  const systemPrompt = `You are a luxury real estate copywriter and data extraction expert working for Dream Land Reality, a premium property agency. Extract structured property information from the provided text and write it in polished, aspirational language.

Extraction rules:
- Use null for any field absent from the text — never invent data
- NEVER populate any seller name, agent name, or agent contact field — this platform belongs to Dream Land Reality only
- NEVER modify, remove, or fabricate any image URL or video URL — preserve all media links exactly as they appear in the source data
- Detect locale from context (INR/crore/lakh/BHK = India; AED/dirham = Dubai; SGD = Singapore)
- Prices: numeric where possible, string with currency symbol acceptable
- Amenities: select only the top 6 most relevant and impressive amenities — do not list more than 6

Writing rules (apply to all text fields):
- Fix all spelling mistakes and grammatical errors
- Rewrite descriptions in rich, evocative, aspirational language befitting a luxury property
- Use vivid, sensory language — light, space, texture, lifestyle — not generic filler
- Vary sentence structure; avoid repetition
- Keep headings crisp and impactful; keep body copy flowing and immersive

SEO metadata (optimise for Google real estate search ranking):
- title: 50-60 chars exactly. Formula: [Bedrooms] [Property Type] in [Neighbourhood], [City] | [1 USP]. Example: "4BHK Penthouse in Bandra West, Mumbai | Sea-Facing". Include the exact bedroom count, property type, precise neighbourhood, and the single strongest unique feature. Never waste chars on the agency name.
- description: 145-155 chars exactly. Formula: [Emotional hook 1 sentence]. [Price or price range]. [Top 2 amenities]. [Call to action]. Must include price, location, and a verb ("Enquire", "Book a viewing", "Explore"). This is the snippet Google shows — make every character earn its place.
- keywords: 10-12 items. Mix: (1) exact-match head terms — "[City] luxury apartments", "[neighbourhood] [property type]"; (2) long-tail — "spacious [N]BHK with [amenity] in [area]"; (3) intent terms — "buy luxury flat [city]", "[property type] for sale [neighbourhood]"; (4) feature terms — pool, gym, sea view, smart home — only if present in text. Use lowercase, comma-separated.
- structuredData: fill ALL available fields — propertyName, propertyType, priceRange, address (streetAddress + addressLocality + addressRegion + addressCountry), numberOfRooms, floorSize (numeric sqft/sqm), amenityFeature (top 3 as strings). Precise structured data feeds Google's rich snippets and property carousels directly.

Sections: ${sectionSummary}${hintsBlock}`

  const userPrompt = `Extract structured data from:\n\n${rawText}`

  return { systemPrompt, userPrompt }
}
