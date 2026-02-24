import Link from 'next/link'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import type { DeploymentCardData } from '@/types'
import { ROUTES, DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  getThumbnailSrc,
  getLocation,
  getPropertyType,
  getImageFilterClass,
  formatRelativeTime,
} from '@/lib/utils/dashboard'
import type { SiteData } from '@/types'

// ─── Deployment Card ────────────────────────────────────────────────────────

export function DeploymentCard({
  deployment,
  index,
  href,
}: {
  deployment: DeploymentCardData
  index: number
  href?: string
}) {
  const thumbnailSrc = getThumbnailSrc(deployment)
  const siteData = deployment.site_data as SiteData | null
  const location = getLocation(siteData)
  const propertyType = getPropertyType(siteData)
  const relativeTime = formatRelativeTime(deployment.updated_at)
  const imageFilter = getImageFilterClass(deployment.status)
  const showUnpublishedDot =
    deployment.has_unpublished_changes && deployment.status === 'live'

  return (
    <Link href={href ?? ROUTES.deployment(deployment.id)} className="group block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        {/* Thumbnail Container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-surface shadow-soft transition-shadow duration-700 group-hover:shadow-float">
          {/* Thumbnail Image */}
          {thumbnailSrc.startsWith('data:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailSrc}
              alt={`${deployment.project_name} website preview`}
              className={`h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105 ${imageFilter}`}
            />
          ) : (
            <Image
              src={thumbnailSrc}
              alt={`${deployment.project_name} website preview`}
              fill
              className={`object-cover transition-transform duration-1000 group-hover:scale-105 ${imageFilter}`}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          )}

          {/* Status Badge + Unpublished Dot */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
            <StatusBadge status={deployment.status} />
            {showUnpublishedDot && (
              <span
                className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                title="Unpublished changes"
                aria-label="This deployment has unpublished changes"
              />
            )}
          </div>

          {/* Hover Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-500 group-hover:bg-black/40">
            <span className="translate-y-2 font-serif text-lg text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              Open Studio &rarr;
            </span>
          </div>
        </div>

        {/* Card Text Content */}
        <div className="mt-4 space-y-1">
          <h3 className="truncate font-serif text-lg font-medium text-foreground transition-colors duration-300 group-hover:text-accent">
            {deployment.project_name}
          </h3>
          <p className="truncate text-sm text-foreground-muted">
            {location}
          </p>
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <span>{propertyType}</span>
            <span className="text-border">&middot;</span>
            <span>{relativeTime}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Add New Card ───────────────────────────────────────────────────────────

export function AddNewCard({ index }: { index: number }) {
  return (
    <Link href={ROUTES.newDeployment} className="group block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-3 overflow-hidden border-2 border-dashed border-gray-200 bg-white transition-all duration-500 group-hover:border-solid group-hover:border-accent dark:border-white/10 dark:bg-white/[0.02] dark:group-hover:border-accent">
          {/* Plus Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-200 transition-all duration-500 group-hover:scale-110 group-hover:border-accent dark:border-white/10 dark:group-hover:border-accent">
            <Plus className="h-6 w-6 text-gray-300 transition-colors duration-500 group-hover:text-accent dark:text-white/20" />
          </div>

          {/* Label */}
          <p className="font-serif text-sm italic text-gray-400 transition-colors duration-500 group-hover:text-accent dark:text-white/30">
            New Commission
          </p>
        </div>
      </div>
    </Link>
  )
}
