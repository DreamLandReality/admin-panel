'use client'
import { cn } from '@/lib/utils/cn'
import React from 'react'

export interface DropdownProps {
  trigger: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  align?: 'left' | 'right'
  className?: string
  children: React.ReactNode
}

export function Dropdown({ trigger, open, onOpenChange, align = 'left', className, children }: DropdownProps) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 bg-editor-dropdown border border-white/10 rounded-lg shadow-xl z-dropdown py-1 min-w-full',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({
  onClick,
  active,
  children,
  className,
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 text-xs transition-colors',
        active
          ? 'bg-white/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
        className,
      )}
    >
      {children}
    </button>
  )
}
