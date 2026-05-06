'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface PanelFieldProps {
  label: string
  children: ReactNode
  className?: string
  labelClassName?: string
}

export function PanelField({
  label,
  children,
  className,
  labelClassName,
}: PanelFieldProps) {
  return (
    <div className={className}>
      <label
        className={cn(
          'block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5',
          labelClassName,
        )}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
