import Link from 'next/link'
import { LayoutGrid, ArrowRight } from 'lucide-react'
import { IconContainer, Heading } from '@/components/primitives'
import { cn } from '@/lib/utils/cn'

const sizeConfig = {
  sm: {
    wrapper: 'flex flex-col items-center justify-center h-full gap-3 px-6 text-center',
    iconSize: 'sm' as const,
    heading: 'text-sm font-medium text-foreground',
    description: 'text-xs text-muted-foreground',
  },
  md: {
    wrapper: 'flex flex-col items-center justify-center py-24 text-center',
    iconSize: 'xl' as const,
    heading: 'mb-3 font-serif text-2xl font-light text-foreground',
    description: 'mb-8 max-w-sm text-sm leading-relaxed text-foreground-muted',
  },
  lg: {
    wrapper: 'flex flex-col items-center justify-center py-32 text-center',
    iconSize: 'xl' as const,
    heading: 'mb-3 font-serif text-3xl font-light text-foreground',
    description: 'mb-10 max-w-md text-base leading-relaxed text-foreground-muted',
  },
} as const

interface EmptyStateProps {
  icon?: React.ReactNode
  iconVariant?: 'default' | 'muted'
  heading?: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  onCtaClick?: () => void
  size?: keyof typeof sizeConfig
}

export function EmptyState({
  icon,
  iconVariant = 'muted',
  heading = 'Nothing here yet',
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  size = 'md',
}: EmptyStateProps = {}) {
  const cfg = sizeConfig[size]
  return (
    <div className={cfg.wrapper}>
      <IconContainer
        size={cfg.iconSize}
        variant={iconVariant}
        className={size !== 'sm' ? 'mb-6' : ''}
      >
        {icon ?? <LayoutGrid className={size === 'sm' ? 'h-4 w-4' : 'h-8 w-8'} />}
      </IconContainer>
      {size === 'sm'
        ? <h2 className={cfg.heading}>{heading}</h2>
        : <Heading variant="section" className={cn('mb-3', size === 'lg' && 'text-3xl')}>{heading}</Heading>
      }
      {description && <p className={cfg.description}>{description}</p>}
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="group inline-flex items-center gap-2.5 border-2 border-dashed border-foreground-muted/40 px-8 py-3.5 text-sm font-medium tracking-wide text-foreground-muted transition-all duration-300 hover:border-accent hover:text-accent"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
      {onCtaClick && ctaLabel && !ctaHref && (
        <button
          onClick={onCtaClick}
          className="group inline-flex items-center gap-2.5 border-2 border-dashed border-foreground-muted/40 px-8 py-3.5 text-sm font-medium tracking-wide text-foreground-muted transition-all duration-300 hover:border-accent hover:text-accent"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  )
}
