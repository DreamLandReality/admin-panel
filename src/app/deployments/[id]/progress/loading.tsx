// Covers the gap between editor unmounting and progress page mounting.
// Shows a proper skeleton matching the progress page layout instead of a blank screen.
export default function Loading() {
  return (
    <div className="dark fixed inset-0 bg-background flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-6">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-white/10" />
          <div className="h-4 w-28 rounded bg-white/10" />
        </div>
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>

      {/* ── Center content ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* Spinner */}
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />

        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-3 w-28 rounded bg-white/[0.06]" />
        </div>

        {/* Step track skeleton */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-white/10 bg-white/[0.03]" />
              {i < 5 && <div className="h-px w-6 bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Step labels skeleton */}
        <div className="flex items-center gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-10 rounded bg-white/[0.06]" />
          ))}
        </div>
      </div>
    </div>
  )
}
