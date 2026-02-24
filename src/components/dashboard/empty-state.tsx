import Link from 'next/link'
import { LayoutGrid, ArrowRight } from 'lucide-react'
import { ROUTES } from '@/lib/constants'

interface EmptyStateProps {
  icon?: React.ReactNode
  heading?: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
}

export function EmptyState({
  icon,
  heading = 'Your portfolio is empty',
  description = 'Begin your first architectural masterpiece. Our AI-powered studio will guide you through every detail.',
  ctaLabel = 'Initialize Project',
  ctaHref = ROUTES.newDeployment,
}: EmptyStateProps = {}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Icon Container */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-border/40">
        {icon ?? <LayoutGrid className="h-8 w-8 text-foreground-muted" />}
      </div>

      {/* Heading */}
      <h2 className="mb-3 font-serif text-2xl font-light text-foreground">
        {heading}
      </h2>

      {/* Description */}
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-foreground-muted">
        {description}
      </p>

      {/* CTA Button – dotted outline */}
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="group inline-flex items-center gap-2.5 border-2 border-dashed border-foreground-muted/40 px-8 py-3.5 text-sm font-medium tracking-wide text-foreground-muted transition-all duration-300 hover:border-accent hover:text-accent"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
