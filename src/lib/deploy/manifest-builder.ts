import type { CollectionItem, SiteData, TemplateManifest } from '@/types'
import { findContactFormSections, findFirstImageInSection } from '@/lib/constants'

/**
 * Recursively strip any key ending with __style or __styles from data.
 * These are extracted separately into manifest.styleOverrides so the
 * Astro template can generate static CSS from them at build time.
 */
function stripStyleKeys(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(stripStyleKeys)
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>)
        .filter(([k]) => !k.endsWith('__style') && !k.endsWith('__styles'))
        .map(([k, v]) => [k, stripStyleKeys(v)])
    )
  }
  return data
}

/**
 * Extract __style keys from section data into a flat map.
 * Returns { sectionId: { fieldName: { cssProp: value } } }
 * where value can be a flat string or responsive object { mobile, tablet, desktop }.
 *
 * Also reads the parallel `${sectionId}__styles` wrapper key used by array-type
 * sections (style overrides are stored there to avoid writing named props on arrays).
 */
function extractStyleOverrides(
  sectionDataOnly: Record<string, unknown>
): Record<string, Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, Record<string, unknown>>> = {}

  for (const [key, value] of Object.entries(sectionDataOnly)) {
    // Skip meta keys and non-objects
    if (key.startsWith('_') || value == null || typeof value !== 'object') continue

    // Handle parallel __styles wrapper (array-type sections)
    if (key.endsWith('__styles') && !Array.isArray(value)) {
      const sectionId = key.slice(0, -8) // strip "__styles"
      const wrapper = value as Record<string, unknown>
      const sectionStyles: Record<string, Record<string, unknown>> = {}
      for (const [styleKey, styleVal] of Object.entries(wrapper)) {
        if (styleKey.endsWith('__style') && styleVal && typeof styleVal === 'object') {
          const field = styleKey.slice(0, -7) // strip "__style"
          sectionStyles[field] = styleVal as Record<string, unknown>
        }
      }
      if (Object.keys(sectionStyles).length > 0) {
        result[sectionId] = { ...(result[sectionId] ?? {}), ...sectionStyles }
      }
      continue
    }

    // Handle regular object sections — look for __style keys inside
    if (!Array.isArray(value)) {
      const sectionId = key
      const sectionObj = value as Record<string, unknown>
      const sectionStyles: Record<string, Record<string, unknown>> = {}
      for (const [fieldKey, fieldVal] of Object.entries(sectionObj)) {
        if (fieldKey.endsWith('__style') && fieldVal && typeof fieldVal === 'object') {
          const field = fieldKey.slice(0, -7) // strip "__style"
          sectionStyles[field] = fieldVal as Record<string, unknown>
        }
      }
      if (Object.keys(sectionStyles).length > 0) {
        result[sectionId] = { ...(result[sectionId] ?? {}), ...sectionStyles }
      }
    }
  }

  return result
}

/**
 * Build a deploy-ready template.manifest.json from:
 * - frozenManifest : the manifest snapshot stored on the deployment row
 * - siteData       : the user's edited section/collection data from the editor
 * - siteToken      : the deployment's unique contact-form token
 * - submissionEndpoint : Supabase Edge Function URL (or proxy) for form POST
 *
 * The returned object can be JSON.stringify'd and written directly to
 * template.manifest.json in the GitHub repo for Astro to consume at build time.
 */
export function buildDeployManifest(
  frozenManifest: TemplateManifest,
  siteData: SiteData,
  siteToken: string,
  submissionEndpoint: string,
  supabaseAnonKey?: string
): object {
  // Deep-clone so we never mutate the frozen manifest
  const manifest = JSON.parse(JSON.stringify(frozenManifest)) as TemplateManifest

  // Split meta-keys out of siteData
  const { _sections, _collections, ...sectionDataOnly } = siteData as Record<string, unknown> & {
    _sections?: Record<string, { enabled: boolean }>
    _collections?: Record<string, unknown[]>
  }

  // Detect which sections are contact forms (schema-based, not hardcoded ID)
  const contactFormIds = new Set(findContactFormSections(manifest.sections as any[]))

  // ── Sections ──────────────────────────────────────────────────────────────
  if (!Array.isArray(manifest.sections)) {
    throw new Error('Invalid manifest: sections must be an array')
  }
  for (const section of manifest.sections) {
    // Apply enabled state from _sections registry (default: true)
    ;(section as unknown as Record<string, unknown>).enabled = _sections?.[section.id]?.enabled ?? true

    // Replace section.data with user-edited data (strip style keys)
    if (sectionDataOnly[section.id] !== undefined) {
      section.data = stripStyleKeys(sectionDataOnly[section.id]) as Record<string, unknown>
    } else if (section.data) {
      section.data = stripStyleKeys(section.data) as Record<string, unknown>
    }

    // Inject contact-form runtime values into ANY section that declares
    // submissionEndpoint/siteToken fields (detected by schema, not by ID)
    if (contactFormIds.has(section.id) && section.data) {
      const contactData = section.data as Record<string, unknown>
      contactData.siteToken = siteToken
      contactData.submissionEndpoint = submissionEndpoint
      if (supabaseAnonKey) contactData.supabaseAnonKey = supabaseAnonKey
    }
  }

  // ── Auto-fill seo.image from first available section image if not set ─────
  const seoSection = manifest.sections.find(s =>
    s.id === 'seo' || (s.schema as any)?.properties?.canonicalUrl !== undefined
  )
  const seoData = seoSection?.data as Record<string, unknown> | undefined
  if (seoData && !seoData.image) {
    // Walk all non-SEO sections and pick the first image
    for (const section of manifest.sections) {
      if (section.id === seoSection?.id) continue
      const img = findFirstImageInSection(section as any)
      if (img) {
        seoData.image = img
        break
      }
    }
  }

  // ── Collections ───────────────────────────────────────────────────────────
  if (manifest.collections && _collections) {
    for (const collection of manifest.collections) {
      if (_collections[collection.id] !== undefined) {
        collection.data = _collections[collection.id] as CollectionItem[]
      }
    }
  }

  // ── Style overrides ─────────────────────────────────────────────────────
  // Extract __style keys into a separate top-level block so the Astro template
  // can generate static CSS from them at build time (responsive font sizes etc.)
  const styleOverrides = extractStyleOverrides(sectionDataOnly as Record<string, unknown>)
  if (Object.keys(styleOverrides).length > 0) {
    ;(manifest as any).styleOverrides = styleOverrides
  }

  return manifest
}
