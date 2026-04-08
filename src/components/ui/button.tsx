'use client'

import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/primitives'
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon' | 'amber'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const variantCls: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-foreground text-foreground-inverse hover:opacity-90',
  secondary:
    'border border-border-hover text-foreground hover:bg-surface-hover',
  danger:
    'bg-error text-white hover:opacity-90',
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
  icon:
    'h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border-hover hover:bg-surface-hover',
  amber:
    'border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20',
}

const sizeCls: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-body-sm rounded-lg',
  lg: 'px-5 py-2.5 text-sm rounded-lg',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isIcon = variant === 'icon'
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'font-medium transition-colors flex items-center justify-center gap-2',
          'disabled:opacity-40 disabled:pointer-events-none',
          variantCls[variant],
          !isIcon && sizeCls[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <Spinner
            size="xs"
            variant={
              variant === 'amber' ? 'accent'
              : variant === 'primary' ? 'inverse'
              : variant === 'danger' ? 'error'
              : 'default'
            }
          />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
