import { Skeleton } from '@/components/ui'

const GRID = 'grid-cols-[6px_minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_130px_110px_40px]'

export default function EnquiryLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className={`grid gap-4 px-4 py-2 bg-surface-hover/40 border-b border-border items-center ${GRID}`}>
          <div />
          {['w-10', 'w-12', 'w-14', 'w-16', 'w-12', ''].map((w, i) => (
            <Skeleton key={i} className={`h-2.5 rounded ${w}`} />
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`grid gap-4 px-4 py-4 border-b border-border/50 last:border-0 items-center ${GRID}`}
          >
            <div className="flex justify-center">
              {i < 3 && <Skeleton className="w-1.5 h-1.5 rounded-full" />}
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-2.5 w-44 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-32 rounded" />
              <Skeleton className="h-2.5 w-20 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-24 rounded" />
              <Skeleton className="h-3.5 w-16 rounded-sm" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-20 rounded" />
              <Skeleton className="h-2.5 w-12 rounded" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
