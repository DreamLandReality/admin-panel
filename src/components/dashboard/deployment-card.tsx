import Link from 'next/link'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DeploymentCardData, SiteData } from '@/types'
import { ROUTES, DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  getThumbnailSrc,
  getLocation,
  getPropertyType,
  getImageFilterClass,
  formatRelativeTime,
} from '@/lib/utils/dashboard'

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
    <Link href={href ?? ROUTES.deployment(deployment.id)} className="block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        <div className="group rounded-xl border border-border bg-card overflow-hidden cursor-pointer transition-all duration-150 hover:border-foreground/30">
          {/* Thumbnail — 4:5 aspect for screenshot */}
          <div className="aspect-[4/5] bg-muted relative overflow-hidden">
            {thumbnailSrc.startsWith('data:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc}
                alt={`${deployment.project_name} preview`}
                className={cn(
                  'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105',
                  imageFilter
                )}
              />
            ) : (
              <Image
                src={thumbnailSrc}
                alt={`${deployment.project_name} preview`}
                fill
                className={cn(
                  'object-cover transition-transform duration-300 group-hover:scale-105',
                  imageFilter
                )}
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
            )}

            {/* Status badge overlay */}
            <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5">
              <StatusBadge status={deployment.status} />
              {showUnpublishedDot && (
                <span
                  className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card"
                  title="Unpublished changes"
                />
              )}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors duration-300 group-hover:bg-foreground/10">
              <span className="translate-y-1 text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 bg-foreground/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                Open Studio
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="p-3">
            <p className="text-label uppercase tracking-label text-muted-foreground mb-0.5">{location}</p>
            <p className="text-sm font-medium text-foreground leading-snug truncate">{deployment.project_name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-muted-foreground">{propertyType}</span>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="text-[11px] text-muted-foreground">{relativeTime}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Add New Card ───────────────────────────────────────────────────────────

export function AddNewCard({ index }: { index: number }) {
  return (
    <Link href={ROUTES.newDeployment} className="block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        <div className="group rounded-xl border-2 border-dashed border-border overflow-hidden cursor-pointer transition-all duration-200 hover:border-foreground/30">
          {/* Match thumbnail area height */}
          <div className="aspect-[4/5] flex flex-col items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border transition-all duration-200 group-hover:border-foreground/30 group-hover:scale-110">
              <Plus className="h-5 w-5 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" />
            </div>
            <p className="text-xs text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
              New Commission
            </p>
          </div>

          {/* Match info area height */}
          <div className="p-3">
            <p className="text-label uppercase tracking-label text-transparent mb-0.5">&nbsp;</p>
            <p className="text-sm font-medium text-transparent">&nbsp;</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
