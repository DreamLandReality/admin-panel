import { Skeleton } from '@/components/ui'

// Shown automatically by Next.js while the server component (page.tsx) fetches data.
// Mirrors DeploymentCard exactly: rounded-xl card with thumbnail + info section inside.

export default function DashboardLoading() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-card">
          <Skeleton className="aspect-card w-full" />
          <div className="px-3 pt-2.5 pb-3">
            <Skeleton className="h-4 w-full mb-1.5" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
