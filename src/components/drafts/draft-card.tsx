'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { DraftCardData } from '@/types'
import { ROUTES } from '@/lib/constants'
import { formatRelativeTime } from '@/lib/utils/dashboard'
import { StatusBadge } from '@/components/shared/status-badge'
import { AnimatedCard } from '@/components/ui/animated-card'

const STEP_LABELS: Record<number, string> = {
  1: 'Step 1 / 3',
  2: 'Step 2 / 3',
  3: 'Step 3 / 3',
}

export function DraftCard({ draft, index }: { draft: DraftCardData; index: number }) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const isEditDraft = draft.deployment_id !== null
  const dep = draft.deployments

  const projectName = dep?.project_name ?? draft.project_name ?? 'Untitled Draft'
  const relativeTime = formatRelativeTime(draft.updated_at)
  const stepLabel = STEP_LABELS[draft.current_step] ?? `Step ${draft.current_step}`

  const thumbnailSrc =
    dep?.screenshot_url ||
    draft.screenshot_url ||
    draft.templates?.preview_url ||
    null

  const href = isEditDraft
    ? ROUTES.editor(draft.deployment_id!)
    : ROUTES.resumeDraft(draft.id)

  return (
    <AnimatedCard index={index}>
      <div className="group relative rounded-xl bg-card overflow-hidden cursor-pointer">
        {/* Full-card link */}
        <Link
          href={href}
          className="absolute inset-0 z-10"
          aria-label={`Resume ${projectName}`}
        />

        {/* Thumbnail — portrait aspect-card (4/5), matches DeploymentCard */}
        <div className="aspect-card bg-muted relative overflow-hidden">
          {thumbnailSrc ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 z-10 animate-shimmer" />
              )}
              {thumbnailSrc.startsWith('data:') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailSrc}
                  alt={`${projectName} preview`}
                  onLoad={() => setImgLoaded(true)}
                  className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 opacity-70 ${imgLoaded ? 'opacity-70' : 'opacity-0'}`}
                />
              ) : (
                <Image
                  src={thumbnailSrc}
                  alt={`${projectName} preview`}
                  fill
                  onLoad={() => setImgLoaded(true)}
                  className={`object-cover transition-all duration-500 group-hover:scale-105 opacity-70 ${imgLoaded ? 'opacity-70' : 'opacity-0'}`}
                  sizes="(max-width: 1280px) 50vw, 25vw"
                />
              )}
            </>
          ) : (
            /* No thumbnail yet — simple centered icon (matches TemplateCard fallback) */
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="6" y="6" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 28l8-8 6 6 4-4 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Badge overlay — top-left */}
          <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
            {isEditDraft ? (
              <>
                {dep?.status && <StatusBadge status={dep.status} />}
                <span className="flex items-center gap-1 text-label font-medium uppercase tracking-label text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  In Progress
                </span>
              </>
            ) : (
              <StatusBadge status="draft" />
            )}
          </div>

          {/* Step progress strip — bottom of image for new-commission drafts */}
          {!isEditDraft && (
            <div className="absolute bottom-0 inset-x-0 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/30 backdrop-blur-sm pointer-events-none">
              <span className="text-label font-medium uppercase tracking-label text-white/60">{stepLabel}</span>
            </div>
          )}
        </div>

        {/* Info — TemplateCard style: overline + name + meta */}
        <div className="p-3">
          <p className="text-label uppercase tracking-label text-muted-foreground mb-0.5">
            {draft.template_slug}
          </p>
          <p className="text-sm font-medium text-foreground leading-snug truncate">
            {projectName}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-label-lg text-muted-foreground">{relativeTime}</span>
          </div>
        </div>
      </div>
    </AnimatedCard>
  )
}
