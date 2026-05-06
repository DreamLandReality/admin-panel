import { ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight } from '@/components/icons'
import { cn } from '@/lib/utils/cn'

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}

export function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border mt-0">
      <p className="text-micro font-medium uppercase tracking-label text-foreground-muted/60 tabular-nums">
        {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={12} strokeWidth={2} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="h-7 w-7 flex items-center justify-center text-micro text-foreground-muted/40">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                'h-7 min-w-[28px] px-1 rounded-md text-label font-semibold uppercase tracking-label transition-colors',
                p === page
                  ? 'bg-foreground text-background'
                  : 'border border-border text-foreground-muted hover:text-foreground hover:border-border-hover'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
