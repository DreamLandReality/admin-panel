'use client'

import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-background dark:bg-[#111111] border border-black/[0.08] dark:border-white/[0.06] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] max-w-sm w-full mx-4 animate-fade-in-up">
        {/* Top accent line for danger */}
        {variant === 'danger' && (
          <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
        )}

        <div className="px-7 pt-7 pb-6">
          {/* Title */}
          <h3 className="font-serif text-[18px] font-light tracking-tight text-foreground dark:text-white mb-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-[13px] text-foreground-muted dark:text-white/40 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-black/[0.06] dark:bg-white/[0.04] mx-7" />

        {/* Actions */}
        <div className="px-7 py-5 flex items-center justify-end gap-4">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="text-[13px] text-foreground-muted dark:text-white/40 hover:text-foreground dark:hover:text-white/80 transition-colors tracking-wide"
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            className={
              variant === 'danger'
                ? 'px-4 py-2 text-[13px] font-medium tracking-wide border transition-colors text-red-500 dark:text-red-400 border-red-500/20 dark:border-red-400/20 hover:bg-red-500/5 dark:hover:bg-red-400/5'
                : 'px-4 py-2 text-[13px] font-medium tracking-wide border border-black/10 dark:border-white/10 text-foreground dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
