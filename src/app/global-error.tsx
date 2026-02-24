'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background text-white font-sans">
        <div className="max-w-md text-center space-y-4 p-8">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-neutral-400">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
