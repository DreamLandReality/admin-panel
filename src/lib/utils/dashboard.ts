import type { DeploymentCardData, DeploymentStatus, SiteData, StatItemData } from '@/types'

// ─── Stats Computation ───────────────────────────────────────────────────────

/** Aggregate deployment counts for the header stat bar. */
export function computeStats(deployments: DeploymentCardData[]): StatItemData[] {
  const total = deployments.length
  const live = deployments.filter(d => d.status === 'live').length
  const drafts = deployments.filter(d => d.status === 'draft').length
  const failed = deployments.filter(d => d.status === 'failed').length

  return [
    { label: 'Total', value: total },
    { label: 'Live', value: live, colorClass: live > 0 ? 'text-success' : undefined },
    { label: 'Drafts', value: drafts },
    { label: 'Failed', value: failed, colorClass: failed > 0 ? 'text-error' : undefined },
  ]
}

// ─── Thumbnail Fallback Chain ────────────────────────────────────────────────

/**
 * Resolve a display image for a deployment card.
 * Priority: Puppeteer screenshot → SEO/OG image from site_data → card placeholder.
 */
export function getThumbnailSrc(deployment: DeploymentCardData): string | null {
  // Tier 1: Platform screenshot
  if (deployment.screenshot_url) {
    return deployment.screenshot_url
  }

  // Tier 2: SEO/OG image from site_data
  const seo = deployment.site_data?.seo as Record<string, unknown> | undefined
  const seoImage = seo?.image
  if (seoImage && typeof seoImage === 'string' && seoImage.length > 0) {
    return seoImage
  }

  return null
}

// ─── Data Extractors ─────────────────────────────────────────────────────────

export function getLocation(siteData: SiteData | null): string {
  if (!siteData) return 'Location not set'
  const hero = siteData.hero as Record<string, unknown> | undefined
  const property = siteData.property as Record<string, unknown> | undefined
  const seo = siteData.seo as Record<string, unknown> | undefined
  return (
    (hero?.location as string | undefined) ??
    (property?.location as string | undefined) ??
    (seo?.location as string | undefined) ??
    'Location not set'
  )
}

export function getPropertyType(siteData: SiteData | null): string {
  if (!siteData) return 'Property'
  const property = siteData.property as Record<string, unknown> | undefined
  const hero = siteData.hero as Record<string, unknown> | undefined
  return (
    (property?.type as string | undefined) ??
    (hero?.propertyType as string | undefined) ??
    'Property'
  )
}

// ─── Image Filter Classes ────────────────────────────────────────────────────

export function getImageFilterClass(status: DeploymentStatus): string {
  if (status === 'live') return ''
  if (status === 'failed') return 'grayscale opacity-60'
  return 'opacity-80'
}

// ─── Relative Time Formatter ─────────────────────────────────────────────────

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365.25 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30.44 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** Format an ISO date string as a human-relative string, e.g. "3 days ago". */
export function formatRelativeTime(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now()

  for (const { unit, ms } of UNITS) {
    const value = Math.round(diff / ms)
    if (Math.abs(value) >= 1) {
      return rtf.format(value, unit)
    }
  }

  return 'just now'
}
