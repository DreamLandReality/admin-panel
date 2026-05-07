'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeploymentCardData } from '@/types'
import { AnimatedCard } from '@/components/ui/animated-card'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { RotateCcwIcon } from '@/components/icons'
import { getThumbnailSrc, formatRelativeTime } from '@/lib/utils/dashboard'
import { deploymentService } from '@/services/deployment'
import { DeploymentThumbnail } from './deployment-thumbnail'

export function ArchivedCard({
  deployment,
  index,
}: {
  deployment: DeploymentCardData
  index: number
}) {
  const router = useRouter()
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const thumbnailSrc = getThumbnailSrc(deployment)
  const relativeTime = formatRelativeTime(deployment.updated_at)

  return (
    <>
      <AnimatedCard index={index}>
        <div className="group relative rounded-xl border border-border bg-card overflow-hidden">
          {/* Thumbnail */}
          <div className="aspect-square bg-muted relative overflow-hidden">
            <DeploymentThumbnail
              src={thumbnailSrc}
              alt={`${deployment.project_name} preview`}
              imageClassName="object-cover grayscale opacity-50 transition-opacity duration-500"
              placeholderClassName="text-muted-foreground/40 grayscale"
            />

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
              <RotateCcwIcon width={11} height={11} strokeWidth={1.75} />
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
