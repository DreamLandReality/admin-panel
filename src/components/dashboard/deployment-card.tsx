import Link from 'next/link'
import type { DeploymentCardData } from '@/types'
import { ROUTES } from '@/lib/constants'
import { StatusBadge } from '@/components/shared/status-badge'
import { DeleteSiteAction } from '@/components/shared/delete-site-action'
import { AnimatedCard } from '@/components/ui/animated-card'
import { ExternalLinkIcon } from '@/components/icons'
import { DeploymentThumbnail } from './deployment-thumbnail'
import {
  getThumbnailSrc,
  getImageFilterClass,
  formatRelativeTime,
} from '@/lib/utils/dashboard'

export function DeploymentCard({
  deployment,
  index,
  canEdit = true,
  canDelete = true,
}: {
  deployment: DeploymentCardData
  index: number
  canEdit?: boolean
  canDelete?: boolean
}) {
  const thumbnailSrc = getThumbnailSrc(deployment)
  const relativeTime = formatRelativeTime(deployment.updated_at)
  const imageFilter = getImageFilterClass(deployment.status)

  const hasUnpublished = deployment.status === 'live' && deployment.has_unpublished_changes

  return (
    <AnimatedCard index={index}>
      <div className={canEdit ? 'group relative rounded-xl border border-border bg-card overflow-hidden cursor-pointer' : 'group relative rounded-xl border border-border bg-card overflow-hidden'}>
        {/* Full-card link */}
        {canEdit && (
          <Link
            href={ROUTES.editor(deployment.id)}
            className="absolute inset-0 z-10"
            aria-label={`Edit ${deployment.project_name}`}
          />
        )}

        {/* Thumbnail */}
        <div className="aspect-square bg-muted relative overflow-hidden">
          <DeploymentThumbnail
            src={thumbnailSrc}
            alt={`${deployment.project_name} preview`}
            imageClassName={`object-cover transition-all duration-500 group-hover:scale-105 ${imageFilter}`}
          />

          {/* Status badge */}
          <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
            <StatusBadge status={deployment.status} />
          </div>

          {/* View Live button */}
          {(deployment.stable_url ?? deployment.live_url) && (
            <a
              href={(deployment.stable_url ?? deployment.live_url) as string}
              target="_blank"
              rel="noopener noreferrer"
              title="View live site"
              aria-label="View live site"
              className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 hover:text-white backdrop-blur-sm cursor-pointer"
            >
              <ExternalLinkIcon width={12} height={12} strokeWidth={1.5} />
            </a>
          )}

          {/* Delete button — only for live deployments */}
          {canDelete && deployment.status === 'live' && (
            <DeleteSiteAction
              deploymentId={deployment.id}
              projectName={deployment.project_name}
              className="absolute top-2.5 right-10 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-error opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 hover:text-error/80 backdrop-blur-sm cursor-pointer"
            />
          )}

          {/* Unpublished changes strip — bottom of image */}
          {canEdit && hasUnpublished && (
            <div className="absolute bottom-0 inset-x-0 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-warning/10 backdrop-blur-sm border-t border-warning/20 pointer-events-none">
              <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
              <span className="text-label font-medium uppercase tracking-label text-warning">Has unpublished changes</span>
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
