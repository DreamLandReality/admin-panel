import { cn } from '@/lib/utils/cn'

const columnMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
} as const

const gapMap = {
  sm: 'gap-3',
  md: 'gap-5',
  lg: 'gap-8',
} as const

export interface CardGridProps {
  children: React.ReactNode
  columns?: keyof typeof columnMap
  gap?: keyof typeof gapMap
  className?: string
}

export function CardGrid({ children, columns = 4, gap = 'md', className }: CardGridProps) {
  return (
    <div className={cn('grid', columnMap[columns], gapMap[gap], className)}>
      {children}
    </div>
  )
}
