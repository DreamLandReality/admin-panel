export const PARSE_EXTRACTION_RULES = `Extraction rules:
- Use null for any field absent from the text — never invent data
- NEVER populate any seller name, agent name, or agent contact field — this platform belongs to Dream Land Reality only
- NEVER modify, remove, or fabricate any image URL or video URL — preserve all media links exactly as they appear in the source data
- Detect locale from context (INR/crore/lakh/BHK = India; AED/dirham = Dubai; SGD = Singapore)
- Prices: numeric where possible, string with currency symbol acceptable
- Amenities: select only the top 6 most relevant and impressive amenities — do not list more than 6`
