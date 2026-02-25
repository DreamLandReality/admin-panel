import Link from 'next/link'
import Image from 'next/image'
import type { DraftCardData } from '@/types'
import { ROUTES, DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'
import { formatRelativeTime } from '@/lib/utils/dashboard'
import { StatusBadge } from '@/components/shared/status-badge'

const STEP_LABELS: Record<number, string> = {
  1: 'Template Selection',
  2: 'Data Input',
  3: 'Editor',
  4: 'Deploy',
}

// ─── Edit-site draft card (linked to an existing deployment) ─────────────────

function EditDraftCard({ draft, index }: { draft: DraftCardData; index: number }) {
  const relativeTime = formatRelativeTime(draft.updated_at)
  const dep = draft.deployments
  const projectName = dep?.project_name ?? 'Unknown Project'
  const thumbnailSrc = dep?.screenshot_url ?? ''
  const href = `${ROUTES.deployment(draft.deployment_id!)}?draft=${draft.id}`

  return (
    <Link href={href} className="group block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        {/* Thumbnail — matches deployment card aspect ratio */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-amber-400/20 bg-muted">
          {thumbnailSrc ? (
            <Image
              src={thumbnailSrc}
              alt={`${projectName} preview`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105 opacity-70"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-white/10">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
          )}

          {/* Amber "In Progress" overlay badge */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            {dep?.status && <StatusBadge status={dep.status} />}
            <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              In Progress
            </span>
          </div>
        </div>

        {/* Card text */}
        <div className="mt-3 space-y-1">
          <h3 className="truncate font-serif text-lg font-medium text-foreground transition-colors duration-300 group-hover:text-accent">
            {projectName}
          </h3>
          <p className="text-sm text-muted-foreground">Editing live site</p>
          <p className="text-xs text-muted-foreground">{relativeTime}</p>
        </div>
      </div>
    </Link>
  )
}

// ─── New-site draft card (wizard in-progress) ────────────────────────────────

function NewDraftCard({ draft, index }: { draft: DraftCardData; index: number }) {
  const relativeTime = formatRelativeTime(draft.updated_at)
  const stepLabel = STEP_LABELS[draft.current_step] ?? `Step ${draft.current_step}`

  return (
    <Link href={ROUTES.resumeDraft(draft.id)} className="group block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        {/* Card body */}
        <div className="relative aspect-[4/3] overflow-hidden bg-surface border-2 border-dashed border-gray-200 dark:border-white/10 transition-all duration-500 group-hover:border-solid group-hover:border-accent dark:group-hover:border-accent flex flex-col items-center justify-center gap-3 rounded-xl">
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-200 dark:border-white/10 transition-all duration-500 group-hover:scale-110 group-hover:border-accent dark:group-hover:border-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-gray-300 dark:text-white/20 transition-colors duration-500 group-hover:text-accent">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>

          {/* Step badge */}
          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-white/30 transition-colors group-hover:text-accent">
            {stepLabel}
          </span>
        </div>

        {/* Card text */}
        <div className="mt-4 space-y-1">
          <h3 className="truncate font-serif text-lg font-medium text-foreground transition-colors duration-300 group-hover:text-accent">
            {draft.project_name || 'Untitled Draft'}
          </h3>
          <p className="truncate text-sm text-foreground-muted">
            {draft.template_slug}
          </p>
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <span>{relativeTime}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Unified DraftCard ───────────────────────────────────────────────────────

export function DraftCard({
  draft,
  index,
}: {
  draft: DraftCardData
  index: number
}) {
  if (draft.deployment_id) {
    return <EditDraftCard draft={draft} index={index} />
  }
  return <NewDraftCard draft={draft} index={index} />
}
