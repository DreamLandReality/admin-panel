'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import type { DeploymentCardData } from '@/types'
import { ROUTES } from '@/lib/constants'
import { StatusBadge } from '@/components/shared/status-badge'
import { AnimatedCard } from '@/components/ui/animated-card'
import {
  getThumbnailSrc,
  getImageFilterClass,
  formatRelativeTime,
} from '@/lib/utils/dashboard'

export function DeploymentCard({
  deployment,
  index,
}: {
  deployment: DeploymentCardData
  index: number
}) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const thumbnailSrc = getThumbnailSrc(deployment)
  const relativeTime = formatRelativeTime(deployment.updated_at)
  const imageFilter = getImageFilterClass(deployment.status)

  const hasUnpublished = deployment.status === 'live' && deployment.has_unpublished_changes

  return (
    <AnimatedCard index={index}>
      <div className="group relative rounded-xl bg-card overflow-hidden cursor-pointer">
        {/* Full-card link */}
        <Link
          href={ROUTES.deployment(deployment.id)}
          className="absolute inset-0 z-10"
          aria-label={`Edit ${deployment.project_name}`}
        />

        {/* Thumbnail */}
        <div className="aspect-card bg-muted relative overflow-hidden">
          {!imgLoaded && (
            <div className="absolute inset-0 z-10 animate-shimmer" />
          )}
          {thumbnailSrc.startsWith('data:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailSrc}
              alt={`${deployment.project_name} preview`}
              onLoad={() => setImgLoaded(true)}
              className={cn(
                'w-full h-full object-cover transition-all duration-500 group-hover:scale-105',
                imageFilter,
                imgLoaded ? 'opacity-100' : 'opacity-0',
              )}
            />
          ) : (
            <Image
              src={thumbnailSrc}
              alt={`${deployment.project_name} preview`}
              fill
              onLoad={() => setImgLoaded(true)}
              className={cn(
                'object-cover transition-all duration-500 group-hover:scale-105',
                imageFilter,
                imgLoaded ? 'opacity-100' : 'opacity-0',
              )}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          )}

          {/* Status badge */}
          <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
            <StatusBadge status={deployment.status} />
          </div>

          {/* View Live button */}
          {(deployment.stable_url ?? deployment.live_url) && (
            <a
              href={(deployment.stable_url ?? deployment.live_url)!}
              target="_blank"
              rel="noopener noreferrer"
              title="View live site"
              aria-label="View live site"
              className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 hover:text-white backdrop-blur-sm"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" />
              </svg>
            </a>
          )}

          {/* Unpublished changes strip — bottom of image */}
          {hasUnpublished && (
            <div className="absolute bottom-0 inset-x-0 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 backdrop-blur-sm border-t border-amber-500/20 pointer-events-none">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-label font-medium uppercase tracking-label text-amber-400">Has unpublished changes</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 px-3 pt-2.5 pb-3 bg-card">
          {deployment.templates?.slug && (
            <p className="text-label uppercase tracking-label text-muted-foreground mb-0.5">
              {deployment.templates.slug}
            </p>
          )}
          <p className="text-sm font-medium text-foreground leading-snug truncate mb-1.5">
            {deployment.project_name}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-label-lg text-muted-foreground/70">{relativeTime}</span>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
}
