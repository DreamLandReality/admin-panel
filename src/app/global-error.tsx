'use client'
import { useEffect } from 'react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { log } from '@/lib/log'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    log.error('[GlobalError]', error)
  }, [error])

  return (
    <html>
      <body className="bg-background text-foreground font-primary antialiased">
        <ErrorState onRetry={reset} />
      </body>
    </html>
  )
}
