/**
 * Extract the first usable image URL from editor section data.
 * Mirrors the fallback logic used by the deploy pipeline:
 *   screenshot_url: sd?.seo?.image || sd?.hero?.backgroundImage || null
 *
 * Only public http(s) URLs are returned — blob URLs are excluded since
 * they are temporary object URLs that become invalid after the session ends.
 */
export function extractDraftThumbnail(sectionData: Record<string, any>): string | null {
  if (!sectionData || typeof sectionData !== 'object') return null

  const hero = sectionData?.hero as any
  const seo  = sectionData?.seo  as any

  // Check priority fields first (same as deploy pipeline)
  const priority = [hero?.backgroundImage, seo?.image]
  for (const url of priority) {
    if (url && typeof url === 'string' && url.startsWith('http')) return url
  }

  // Walk all top-level sections looking for any image-like field
  for (const section of Object.values(sectionData)) {
    if (typeof section !== 'object' || section === null || Array.isArray(section)) continue
    for (const [key, val] of Object.entries(section as Record<string, unknown>)) {
      if (
        typeof val === 'string' &&
        val.startsWith('http') &&
        (key.toLowerCase().includes('image') ||
          key.toLowerCase().includes('photo') ||
          key.toLowerCase().includes('background'))
      ) {
        return val
      }
    }
  }

  return null
}
