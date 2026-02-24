import Link from 'next/link'
import type { DraftCardData } from '@/types'
import { ROUTES, DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'
import { formatRelativeTime } from '@/lib/utils/dashboard'

const STEP_LABELS: Record<number, string> = {
  1: 'Template Selection',
  2: 'Data Input',
  3: 'Editor',
  4: 'Deploy',
}

export function DraftCard({
  draft,
  index,
}: {
  draft: DraftCardData
  index: number
}) {
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
        <div className="relative aspect-[4/3] overflow-hidden bg-surface border-2 border-dashed border-gray-200 dark:border-white/10 transition-all duration-500 group-hover:border-solid group-hover:border-accent dark:group-hover:border-accent flex flex-col items-center justify-center gap-3">
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

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-500 group-hover:bg-black/40">
            <span className="translate-y-2 font-serif text-lg text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              Resume Editing &rarr;
            </span>
          </div>
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
