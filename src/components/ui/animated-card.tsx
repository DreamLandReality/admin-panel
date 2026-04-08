import { cn } from '@/lib/utils/cn'
import { DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'

interface AnimatedCardProps {
  index: number
  className?: string
  children: React.ReactNode
}

export function AnimatedCard({ index, className, children }: AnimatedCardProps) {
  return (
    <div
      className={cn('opacity-0 animate-fade-in-up', className)}
      style={{
        animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  )
}
