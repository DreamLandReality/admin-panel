import { cn } from '@/lib/utils/cn'

const variantMap = {
  default: 'h-px bg-border',
  subtle: 'h-px bg-white/5',
  muted: 'h-px bg-black/[0.06] dark:bg-white/[0.04]',
  error: 'h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent',
  'error-strong': 'h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent',
} as const

export interface DividerProps {
  variant?: keyof typeof variantMap
  className?: string
}

export function Divider({ variant = 'default', className }: DividerProps) {
  return <div className={cn(variantMap[variant], className)} />
}
