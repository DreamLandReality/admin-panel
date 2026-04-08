import { Spinner } from '@/components/primitives'
import { cn } from '@/lib/utils/cn'

export interface LoadingStateProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingState({ label, size = 'md', className }: LoadingStateProps) {
  const spinnerSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Spinner size={spinnerSize} variant="muted" />
      {label && (
        <p className="text-label uppercase tracking-label text-muted-foreground">{label}</p>
      )}
    </div>
  )
}
