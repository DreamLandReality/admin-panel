import { cn } from '@/lib/utils/cn'

const sizeMap = {
  sm: 'text-label uppercase tracking-label',
  md: 'text-label-lg uppercase tracking-label',
} as const

export interface LabelProps {
  size?: keyof typeof sizeMap
  children: React.ReactNode
  className?: string
  as?: 'label' | 'span' | 'p' | 'h3'
  htmlFor?: string
  muted?: boolean
}

export function Label({
  size = 'sm',
  children,
  className,
  as: Tag = 'label',
  htmlFor,
  muted = true,
}: LabelProps) {
  return (
    <Tag
      {...(htmlFor ? { htmlFor } : {})}
      className={cn(sizeMap[size], muted && 'text-muted-foreground', className)}
    >
      {children}
    </Tag>
  )
}
