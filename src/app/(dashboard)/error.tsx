'use client'
import { ErrorState } from '@/components/feedback/ErrorState'
export default function Error({ reset }: { reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
