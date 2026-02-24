import type { DeploymentCardData, DeploymentStatus, SiteData, StatItemData } from '@/types'

// ─── Stats Computation ───────────────────────────────────────────────────────

export function computeStats(deployments: DeploymentCardData[]): StatItemData[] {
  const total = deployments.length
  const live = deployments.filter(d => d.status === 'live').length
  const drafts = deployments.filter(d => d.status === 'draft').length
  const failed = deployments.filter(d => d.status === 'failed').length

  return [
    { label: 'Total', value: total },
    { label: 'Live', value: live, colorClass: live > 0 ? 'text-green-700 dark:text-green-400' : undefined },
    { label: 'Drafts', value: drafts },
    { label: 'Failed', value: failed, colorClass: failed > 0 ? 'text-red-600 dark:text-red-400' : undefined },
  ]
}

// ─── Thumbnail Fallback Chain ────────────────────────────────────────────────

export function getThumbnailSrc(deployment: DeploymentCardData): string {
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

  // Tier 3: Generated gradient placeholder
  return generateGradientPlaceholder(deployment.id)
}

function generateGradientPlaceholder(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  const hue1 = Math.abs(hash) % 360
  const hue2 = (hue1 + 40) % 360

  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:hsl(${hue1},25%,85%)"/><stop offset="100%" style="stop-color:hsl(${hue2},30%,78%)"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/></svg>`
  )}`
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
