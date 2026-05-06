import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { SortIcon } from './sort-icon'
import type { SortCol, SortDir } from './enquiry-types'

interface TableHeaderProps {
  children: ReactNode
  sortable?: boolean
  col?: SortCol
  active?: boolean
  dir?: SortDir
  onSort?: (col: SortCol) => void
  className?: string
}

export function TH({
  children, sortable, col, active, dir, onSort, className,
}: TableHeaderProps) {
  const inner = (
    <span className="flex items-center gap-1.5">
      {children}
      {sortable && col && <SortIcon active={!!active} dir={dir ?? 'desc'} />}
    </span>
  )
  if (sortable && col && onSort) {
    return (
      <button
        onClick={() => onSort(col)}
        className={cn(
          'text-left text-[9px] font-bold uppercase tracking-widest text-foreground-muted/55 hover:text-foreground-muted transition-colors',
          className
        )}
      >
        {inner}
      </button>
    )
  }
  return (
    <div className={cn('text-[9px] font-bold uppercase tracking-widest text-foreground-muted/55', className)}>
      {inner}
    </div>
  )
}
