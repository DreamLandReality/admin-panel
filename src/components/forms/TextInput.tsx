import { cn } from '@/lib/utils/cn'
import React from 'react'

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'panel' | 'underline' | 'default'
  error?: boolean
}

const variantMap = {
  panel: 'panel-input',
  underline: 'w-full rounded-xl border border-border-subtle bg-background/80 px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:border-border-hover focus:outline-none focus:ring-2 focus:ring-accent/15 transition-[border-color,box-shadow,background-color]',
  default: 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-hover transition-colors',
} as const

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ variant = 'default', error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          variantMap[variant],
          error && 'border-error',
          className,
        )}
        {...props}
      />
    )
  },
)
TextInput.displayName = 'TextInput'
