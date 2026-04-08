'use client'
import { cn } from '@/lib/utils/cn'

export interface ButtonGroupOption<T extends string = string> {
  value: T
  label: React.ReactNode
  title?: string
}

export interface ButtonGroupProps<T extends string = string> {
  options: ButtonGroupOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

const sizeMap = {
  sm: 'h-7',
  md: 'h-8',
} as const

export function ButtonGroup<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: ButtonGroupProps<T>) {
  return (
    <div className={cn('flex gap-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 min-w-0 rounded px-2.5 text-xs flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            sizeMap[size],
            value === opt.value
              ? 'bg-foreground text-background font-medium'
              : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-active',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
