'use client'

import { cn } from '@/lib/utils/cn'
import { useEffect } from 'react'
import { Portal } from './portal'

interface BaseModalProps {
  open: boolean
  onClose?: () => void
  maxWidth?: 'sm' | 'md' | 'lg'
  rounded?: boolean
  children: React.ReactNode
}

const maxWidthCls = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function BaseModal({
  open,
  onClose,
  maxWidth = 'sm',
  rounded = true,
  children,
}: BaseModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-md"
          onClick={onClose}
        />
        {/* Dialog */}
        <div
          className={cn(
            'relative bg-background dark:bg-surface',
            'border border-border shadow-modal overflow-hidden',
            'w-full mx-4 animate-fade-in-up',
            rounded && 'rounded-2xl',
            maxWidthCls[maxWidth],
          )}
        >
          {children}
        </div>
      </div>
    </Portal>
  )
}
