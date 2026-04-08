import { cn } from '@/lib/utils/cn'
import React from 'react'

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'panel' | 'underline' | 'default'
  error?: boolean
}

const variantMap = {
  panel: 'panel-input',
  underline: 'w-full border-0 border-b bg-transparent px-0 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors',
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
