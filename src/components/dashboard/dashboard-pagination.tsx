import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'

interface DashboardPaginationProps {
  page: number
  total: number
  pageSize: number
}

function pageHref(page: number): string {
  return page <= 1 ? '/' : `/?page=${page}`
}

export function DashboardPagination({ page, total, pageSize }: DashboardPaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const canGoBack = page > 1
  const canGoForward = page < totalPages

  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <p className="text-micro font-medium uppercase tracking-label text-foreground-muted/60 tabular-nums">
        {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={pageHref(page - 1)}
          aria-disabled={!canGoBack}
          className={cn(
            'h-7 w-7 rounded-md border border-border flex items-center justify-center text-foreground-muted transition-colors',
            canGoBack
              ? 'hover:text-foreground hover:border-border-hover'
              : 'opacity-30 pointer-events-none'
          )}
        >
          <ChevronLeftIcon width={12} height={12} strokeWidth={2} />
        </Link>
        <span className="h-7 min-w-[56px] rounded-md border border-border px-2 text-label font-semibold uppercase tracking-label text-foreground-muted flex items-center justify-center tabular-nums">
          {page}/{totalPages}
        </span>
        <Link
          href={pageHref(page + 1)}
          aria-disabled={!canGoForward}
          className={cn(
            'h-7 w-7 rounded-md border border-border flex items-center justify-center text-foreground-muted transition-colors',
            canGoForward
              ? 'hover:text-foreground hover:border-border-hover'
              : 'opacity-30 pointer-events-none'
          )}
        >
          <ChevronRightIcon width={12} height={12} strokeWidth={2} />
        </Link>
      </div>
    </div>
  )
}
