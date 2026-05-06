import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

const badgeVariants: Record<string, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
  default: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
  accent: 'bg-accent/10 border border-accent/20 text-accent',
}

export function Badge({
  children,
  variant = 'default',
  dot = false,
  ping = false,
  className,
}: {
  children: ReactNode
  variant?: keyof typeof badgeVariants
  dot?: boolean
  ping?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-label-lg font-medium tracking-wide',
        badgeVariants[variant] ?? badgeVariants.default,
        className,
      )}
    >
      {dot && (
        <span className="relative mr-1.5 flex h-2 w-2">
          {ping && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}
