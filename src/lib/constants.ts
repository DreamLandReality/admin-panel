import type { DeploymentStatus } from '@/types'

// ─── Status Configuration ────────────────────────────────────────────────────

export type DisplayStatus = DeploymentStatus | 'unpublished'

export const STATUS_CONFIG: Record<
  DisplayStatus,
  {
    label: string
    variant: 'success' | 'warning' | 'danger' | 'info' | 'default'
    isActive?: boolean
  }
> = {
  live: { label: 'Live', variant: 'success' },
  draft: { label: 'Draft', variant: 'default' },
  deploying: { label: 'Deploying', variant: 'warning', isActive: true },
  building: { label: 'Building', variant: 'warning', isActive: true },
  failed: { label: 'Failed', variant: 'danger' },
  archived: { label: 'Archived', variant: 'default' },
  unpublished: { label: 'Unpublished', variant: 'warning' },
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const ROUTES = {
  home: '/',
  login: '/login',
  newDeployment: '/deployments/new',
  templates: '/templates',
  newTemplate: '/templates/new',
  resumeDraft: (id: string) => `/deployments/new?draft=${id}` as const,
  enquiry: '/enquiry',
  deployment: (id: string) => `/deployments/${id}` as const,
  editDeployment: (id: string) => `/deployments/${id}/edit` as const,
  template: (slug: string) => `/templates/${slug}` as const,
} as const

// ─── Template Categories ─────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  'luxury',
  'modern',
  'investment',
  'villa',
  'affordable',
] as const

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const DASHBOARD_CARD_STAGGER_MS = 80
export const DASHBOARD_MAX_STAGGER_CARDS = 7

// ─── Icon Sizes ───────────────────────────────────────────────────────────────

export const ICON_SIZE = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const

// ─── Section ID Conventions ──────────────────────────────────────────────────

/**
 * Well-known section roles. Templates MAY use these IDs but are not required to.
 * All admin-panel logic that needs to find a section by role should use the
 * generic helpers below, which walk the manifest schema to detect purpose
 * rather than relying on hardcoded IDs.
 *
 * @deprecated Prefer schema-based detection over ID matching. These constants
 * remain only as fallback hints for backwards compatibility.
 */
export const SECTION_IDS = {
  SEO: 'seo',
  HERO: 'hero',
  NAVIGATION: 'navigation',
  FOOTER: 'footer',
  CONTACT_FORM: 'contact-form',
} as const

// ─── Schema-Based Section Helpers ────────────────────────────────────────────

/**
 * Detect the form/contact section by looking for `submissionEndpoint` or `siteToken`
 * fields in the schema — any section that declares these is a contact form.
 */
export function findContactFormSections(sections: Array<{ id: string; schema?: any }>): string[] {
  return sections
    .filter(s => {
      const props = s.schema?.properties ?? {}
      return props.submissionEndpoint !== undefined || props.siteToken !== undefined
    })
    .map(s => s.id)
}

/**
 * Detect sections that should be skipped from AI content extraction.
 * A section is skipped if ALL its editable fields have `aiIgnore: true`,
 * or if the section is a well-known non-content section (navigation, footer).
 *
 * NOTE: SEO is NOT skipped — it has extractable fields (title, description,
 * keywords, structuredData) that benefit from AI population.
 */
export function findAiSkipSections(sections: Array<{ id: string; schema?: any }>): Set<string> {
  const skip = new Set<string>()
  for (const section of sections) {
    const props = section.schema?.properties ?? {}
    const fields = Object.values(props) as any[]
    // Skip if no editable fields, or all fields are aiIgnore
    if (fields.length === 0 || fields.every((f: any) => f.aiIgnore === true)) {
      skip.add(section.id)
    }
  }
  return skip
}

/**
 * Find the first image URL in a section's data by checking its imageSlots
 * declaration (from the manifest schema) or falling back to field names
 * that contain 'image' or 'photo'.
 */
export function findFirstImageInSection(section: { data?: Record<string, unknown>; imageSlots?: string[] }): string | null {
  if (!section.data) return null

  // Check declared imageSlots first
  if (section.imageSlots) {
    for (const slot of section.imageSlots) {
      const val = section.data[slot]
      if (typeof val === 'string' && val.length > 0) return val
    }
  }

  // Fallback: walk fields for image-like names
  for (const [key, val] of Object.entries(section.data)) {
    if (
      typeof val === 'string' &&
      val.length > 0 &&
      (key.toLowerCase().includes('image') || key.toLowerCase().includes('photo'))
    ) {
      return val
    }
  }

  return null
}
