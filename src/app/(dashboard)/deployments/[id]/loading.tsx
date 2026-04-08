import { Skeleton } from '@/components/ui'

// Editor-specific loading skeleton shown while the server component fetches
// deployment data. Prevents the shared dashboard loading.tsx (card grid)
// from appearing — which looks like the "New Commission" template picker.

export default function EditDeploymentLoading() {
  return (
    <div className="dark fixed inset-0 z-50 flex flex-col bg-background">
      {/* ── Top toolbar ─────────────────────────────────── */}
      <div className="flex h-12 items-center justify-between border-b border-border/40 px-4">
        {/* Left: back + divider + context label */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Skeleton className="h-7 w-14 rounded-md" />
          <div className="w-px h-4 bg-white/10" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        {/* Center: project name + saved badge */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-5 w-14 rounded" />
        </div>
        {/* Right: viewport icons + save + publish */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
          <div className="w-px h-4 bg-white/10" />
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      {/* ── Three-panel layout ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — layers list */}
        <div className="w-[184px] shrink-0 border-r border-border/40 flex flex-col">
          {/* "LAYERS" header + collapse button */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <Skeleton className="h-2.5 w-10 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          {/* Page dropdown row */}
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-3 rounded" />
          </div>
          {/* Section rows: icon + label + toggle */}
          <div className="px-2 space-y-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                <Skeleton className={`h-3 rounded flex-1`} style={{ width: `${55 + (i * 13) % 30}%` }} />
                <Skeleton className="h-4 w-7 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Center canvas */}
        <div className="flex flex-1 items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/60 uppercase tracking-widest">Loading</span>
          </div>
        </div>

        {/* Right panel — field editor */}
        <div className="w-[220px] shrink-0 border-l border-border/40 flex flex-col">
          {/* Section title */}
          <div className="px-4 pt-4 pb-3 border-b border-border/20">
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          {/* CONTENT label */}
          <div className="px-4 pt-3 pb-2">
            <Skeleton className="h-2.5 w-14 rounded" />
          </div>
          {/* Field pairs: small label + input */}
          <div className="px-3 space-y-3">
            {[16, 20, 20, 20].map((inputH, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2 w-20 rounded" />
                <Skeleton className={`h-${inputH === 20 ? 8 : 7} w-full rounded-md`} />
              </div>
            ))}
            {/* Dropdown field */}
            <div className="space-y-1.5">
              <Skeleton className="h-2 w-16 rounded" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            {/* Toggle row */}
            <div className="flex items-center justify-between py-1">
              <Skeleton className="h-2.5 w-24 rounded" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
            {/* Image preview placeholder */}
            <div className="space-y-1.5">
              <Skeleton className="h-2 w-10 rounded" />
              <Skeleton className="aspect-video w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
