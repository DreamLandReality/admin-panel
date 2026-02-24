import { cn } from '@/lib/utils/cn'

// ─── Badge ───────────────────────────────────────────────────────────────────

const badgeVariants: Record<string, string> = {
  success: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  default: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: keyof typeof badgeVariants
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide',
        badgeVariants[variant] ?? badgeVariants.default,
        className
      )}
    >
      {children}
    </span>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-foreground/5 dark:bg-white/5',
        className
      )}
    />
  )
}
