import { cn } from '@/lib/utils/cn'

const sizeMap = {
  xs: 'w-6 h-6 rounded-md',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-full',
  lg: 'w-12 h-12 rounded-full',
  xl: 'w-20 h-20 rounded-full',
} as const

const variantMap = {
  default: 'bg-white/5 border border-white/10',
  muted: 'bg-border/40',
  surface: 'bg-foreground/[0.02] border border-border',
  success: 'bg-emerald-400/10 border border-emerald-400/20',
  error: 'bg-red-500/10 border border-red-500/20',
  warning: 'bg-amber-400/5 border border-amber-400/20',
  accent: 'bg-foreground border border-foreground',
} as const

export interface IconContainerProps {
  size?: keyof typeof sizeMap
  variant?: keyof typeof variantMap
  children: React.ReactNode
  className?: string
}

export function IconContainer({
  size = 'md',
  variant = 'default',
  children,
  className,
}: IconContainerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center flex-shrink-0',
        sizeMap[size],
        variantMap[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}
