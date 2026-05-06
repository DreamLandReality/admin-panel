import { cn } from '@/lib/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-foreground/[0.07] dark:bg-white/[0.07]', className)}>
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  )
}
