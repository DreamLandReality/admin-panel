import { cn } from '@/lib/utils/cn'
import React from 'react'

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'panel' | 'underline' | 'default'
  error?: boolean
  warn?: boolean
  charCount?: { current: number; max: number; warn?: number }
}

const variantMap = {
  panel: 'panel-input resize-y min-h-[60px]',
  underline: 'w-full border-0 border-b bg-transparent px-0 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors resize-none',
  default: 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-hover transition-colors',
} as const

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ variant = 'default', error, warn, charCount, className, ...props }, ref) => {
    const isOverWarn = charCount && charCount.warn !== undefined && charCount.current >= charCount.warn
    const isOverMax = charCount && charCount.current >= charCount.max
    return (
      <div className="relative">
        <textarea
          ref={ref}
          className={cn(
            variantMap[variant],
            error && 'border-error',
            warn && 'border-warning',
            className,
          )}
          {...props}
        />
        {charCount && (
          <div className="flex justify-end mt-1">
            <span className={cn(
              'text-xs tabular-nums',
              isOverMax ? 'text-error font-medium' : isOverWarn ? 'text-warning' : 'text-muted-foreground',
            )}>
              {charCount.current.toLocaleString()} / {charCount.max.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    )
  },
)
TextArea.displayName = 'TextArea'
