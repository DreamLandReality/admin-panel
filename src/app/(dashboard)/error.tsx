'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-red-400">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v5M10 13.5v.5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred in the dashboard.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-white/10 text-foreground text-sm font-medium hover:bg-white/15 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
