'use client'
import { cn } from '@/lib/utils/cn'

const sizeMap = {
  xs: 'w-3 h-3 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
} as const

const variantMap = {
  default: 'border-foreground/20 border-t-foreground',
  inverse: 'border-foreground-inverse/30 border-t-foreground-inverse',
  muted: 'border-muted-foreground/30 border-t-muted-foreground',
  accent: 'border-warning/30 border-t-warning',
  error: 'border-error/20 border-t-error',
  light: 'border-white/15 border-t-white/60',
} as const

export interface SpinnerProps {
  size?: keyof typeof sizeMap
  variant?: keyof typeof variantMap
  className?: string
}

export function Spinner({ size = 'sm', variant = 'default', className }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full animate-spin shrink-0',
        sizeMap[size],
        variantMap[variant],
        className,
      )}
    />
  )
}
