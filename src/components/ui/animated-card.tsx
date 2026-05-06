import { cn } from '@/lib/utils/cn'
import { DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'

const DASHBOARD_CARD_DELAY_CLASSES = [
  '[animation-delay:0ms]',
  '[animation-delay:80ms]',
  '[animation-delay:160ms]',
  '[animation-delay:240ms]',
  '[animation-delay:320ms]',
  '[animation-delay:400ms]',
  '[animation-delay:480ms]',
  '[animation-delay:560ms]',
] as const

interface AnimatedCardProps {
  index: number
  className?: string
  children: React.ReactNode
}

export function AnimatedCard({ index, className, children }: AnimatedCardProps) {
  const delayClass = DASHBOARD_CARD_DELAY_CLASSES[Math.min(index, DASHBOARD_MAX_STAGGER_CARDS)]

  return (
    <div
      className={cn('opacity-0 animate-fade-in-up', delayClass, className)}
    >
      {children}
    </div>
  )
}
