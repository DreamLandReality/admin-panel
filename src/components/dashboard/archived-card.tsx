'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import type { DeploymentCardData } from '@/types'
import { AnimatedCard } from '@/components/ui/animated-card'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { getThumbnailSrc, formatRelativeTime } from '@/lib/utils/dashboard'
import { deploymentService } from '@/services/deployment'

export function ArchivedCard({
  deployment,
  index,
}: {
  deployment: DeploymentCardData
  index: number
}) {
  const router = useRouter()
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const thumbnailSrc = getThumbnailSrc(deployment)
  const relativeTime = formatRelativeTime(deployment.updated_at)

  return (
    <>
      <AnimatedCard index={index}>
        <div className="group relative rounded-xl bg-card overflow-hidden">
          {/* Thumbnail */}
          <div className="aspect-card bg-muted relative overflow-hidden">
            {!imgLoaded && <div className="absolute inset-0 z-10 animate-shimmer" />}
            {thumbnailSrc.startsWith('data:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc}
                alt={`${deployment.project_name} preview`}
                onLoad={() => setImgLoaded(true)}
                className={cn(
                  'w-full h-full object-cover grayscale opacity-50 transition-opacity duration-500',
                  imgLoaded ? 'opacity-50' : 'opacity-0'
                )}
              />
            ) : (
              <Image
                src={thumbnailSrc}
                alt={`${deployment.project_name} preview`}
                fill
                onLoad={() => setImgLoaded(true)}
                className={cn(
                  'object-cover grayscale opacity-50 transition-opacity duration-500',
                  imgLoaded ? 'opacity-50' : 'opacity-0'
                )}
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
            )}

            {/* Archived badge */}
            <div className="absolute left-2.5 top-2.5 z-10">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white/60 text-[10px] font-medium uppercase tracking-wider">
                Archived
              </span>
            </div>

            {/* Restore button */}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowRestoreConfirm(true)
              }}
              title="Restore site"
              aria-label="Restore site"
              className="absolute top-2.5 right-2.5 z-20 flex h-7 items-center gap-1.5 px-2.5 rounded-lg bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground/80 hover:text-white backdrop-blur-sm text-[10px] font-medium uppercase tracking-wider"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Restore
            </button>
          </div>

          {/* Info */}
          <div className="px-3 pt-2.5 pb-3 bg-card">
            {deployment.templates?.slug && (
              <p className="text-label uppercase tracking-label text-muted-foreground/50 mb-0.5">
                {deployment.templates.slug}
              </p>
            )}
            <p className="text-sm font-medium text-foreground/50 leading-snug truncate mb-1.5">
              {deployment.project_name}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-label-lg text-muted-foreground/40">Archived {relativeTime}</span>
            </div>
          </div>
        </div>
      </AnimatedCard>

      <ConfirmModal
        open={showRestoreConfirm}
        title="Restore site"
        description={`"${deployment.project_name}" will be redeployed. All content is preserved — it will get a new URL when live.`}
        confirmLabel={restoring ? 'Restoring…' : 'Restore Site'}
        cancelLabel="Cancel"
        variant="default"
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={async () => {
          setRestoring(true)
          try {
            const result = await deploymentService.restore(deployment.id)
            if (result.ok) {
              router.push(`/deployments/${result.data.deploymentId}`)
            }
          } finally {
            setRestoring(false)
            setShowRestoreConfirm(false)
          }
        }}
      />
    </>
  )
}
