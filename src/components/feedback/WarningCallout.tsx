import { cn } from '@/lib/utils/cn'

const variantMap = {
  warning: {
    container: 'border-amber-400/20 bg-amber-400/5',
    title: 'text-amber-400',
    body: 'text-amber-300/80',
  },
  error: {
    container: 'border-error/20 bg-error/10',
    title: 'text-error',
    body: 'text-error/80',
  },
  info: {
    container: 'border-info/20 bg-info/5',
    title: 'text-info',
    body: 'text-info/80',
  },
} as const

export interface WarningCalloutProps {
  title: string
  items?: string[]
  description?: string
  variant?: keyof typeof variantMap
  className?: string
}

export function WarningCallout({
  title,
  items,
  description,
  variant = 'warning',
  className,
}: WarningCalloutProps) {
  const v = variantMap[variant]
  return (
    <div className={cn('border rounded p-3 space-y-1.5', v.container, className)}>
      <p className={cn('text-xs font-medium', v.title)}>{title}</p>
      {description && <p className={cn('text-xs', v.body)}>{description}</p>}
      {items && items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className={cn('text-xs', v.body)}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
