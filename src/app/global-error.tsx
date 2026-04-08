'use client'
import { useEffect } from 'react'
import { ErrorState } from '@/components/feedback/ErrorState'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[GlobalError]', error)
    }
  }, [error])

  return (
    <html>
      <body className="bg-background text-foreground font-sans antialiased">
        <ErrorState onRetry={reset} />
      </body>
    </html>
  )
}
