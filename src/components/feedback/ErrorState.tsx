import { AlertCircle } from 'lucide-react'
import { IconContainer } from '@/components/primitives'

export interface ErrorStateProps {
  heading?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  heading = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-1 items-center justify-center p-8 ${className ?? ''}`}>
      <div className="max-w-md text-center space-y-4">
        <IconContainer size="lg" variant="error" className="mx-auto">
          <AlertCircle className="h-6 w-6 text-error" />
        </IconContainer>
        <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-white/10 text-foreground text-sm font-medium hover:bg-white/15 transition-colors"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
