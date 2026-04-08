'use client'

import { useEffect, useRef } from 'react'
import { BaseModal } from '@/components/ui/base-modal'
import { Button } from '@/components/ui/button'
import { Divider, Heading } from '@/components/primitives'

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

  return (
    <BaseModal open={open} onClose={onCancel}>
      {/* Top accent line for danger */}
      {variant === 'danger' && (
        <Divider variant="error" />
      )}

      <div className="px-7 pt-7 pb-6">
        <Heading variant="modal-title" className="mb-2">
          {title}
        </Heading>
        <p className="text-body-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <Divider variant="muted" className="mx-7" />

      <div className="px-7 py-5 flex items-center justify-end gap-4">
        <Button ref={cancelRef} variant="ghost" size="md" onClick={onCancel} className="text-foreground border border-white/20 hover:bg-surface-active">
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'secondary'}
          size="md"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </BaseModal>
  )
}
