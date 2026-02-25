import Link from 'next/link'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DeploymentCardData, SiteData } from '@/types'
import { ROUTES, DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  getThumbnailSrc,
  getPropertyType,
  getImageFilterClass,
  formatRelativeTime,
} from '@/lib/utils/dashboard'

// ─── Deployment Card ────────────────────────────────────────────────────────

export function DeploymentCard({
  deployment,
  index,
  hasEditDraft = false,
}: {
  deployment: DeploymentCardData
  index: number
  hasEditDraft?: boolean
}) {
  const thumbnailSrc = getThumbnailSrc(deployment)
  const siteData = deployment.site_data as SiteData | null
  const propertyType = getPropertyType(siteData)
  const relativeTime = formatRelativeTime(deployment.updated_at)
  const imageFilter = getImageFilterClass(deployment.status)
  const showUnpublishedDot =
    deployment.has_unpublished_changes && deployment.status === 'live'

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {/*
        Card uses a relative container so the full-card Link can sit behind
        the "View Live" button which needs its own click target.
      */}
      <div className="group relative rounded-xl bg-card overflow-hidden cursor-pointer">
        {/* Full-card link → opens deployment in editor */}
        <Link
          href={ROUTES.deployment(deployment.id)}
          className="absolute inset-0 z-[11]"
          aria-label={`Edit ${deployment.project_name}`}
        />

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

          {/* Status badge — bottom-left */}
          <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
            <StatusBadge status={deployment.status} />
            {showUnpublishedDot && (
              <span
                className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card"
                title="Unpublished changes"
              />
            )}
          </div>

          {/* "View Live" button — top-right, only when live_url exists */}
          {deployment.live_url && (
            <a
              href={deployment.live_url}
              target="_blank"
              rel="noopener noreferrer"
              title="View live site"
              className="absolute top-2.5 right-2.5 z-[12] flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 hover:text-white backdrop-blur-sm"
            >
              {/* External link icon */}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" />
              </svg>
            </a>
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 px-3 pt-2.5 pb-3 bg-card">
          <p className="text-sm font-medium text-foreground leading-snug truncate mb-1.5">
            {deployment.project_name}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/70">{propertyType}</span>
            <span className="text-muted-foreground/30 text-[10px]">·</span>
            <span className="text-[11px] text-muted-foreground/70">{relativeTime}</span>
            {hasEditDraft && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-400/80">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                In Progress
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
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
        <div className="group rounded-xl overflow-hidden cursor-pointer border border-transparent hover:border-dashed hover:border-white/20 transition-colors duration-200">
          <div className="aspect-[4/5] flex flex-col items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110">
              <Plus className="h-5 w-5 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" />
            </div>
            <p className="text-xs text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
              New Commission
            </p>
          </div>

          {/* Spacer to match info area height */}
          <div className="p-3">
            <p className="text-label uppercase tracking-label text-transparent mb-0.5">&nbsp;</p>
            <p className="text-sm font-medium text-transparent">&nbsp;</p>
            <p className="text-[11px] text-transparent mt-1.5">&nbsp;</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
