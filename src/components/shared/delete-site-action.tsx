'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { ConfirmModal } from '@/components/shared/confirm-modal'

interface DeleteSiteActionProps {
  deploymentId: string
  projectName: string
  disabled?: boolean
  className?: string
  title?: string
  ariaLabel?: string
  description?: string
  children?: ReactNode
  onDeleted?: () => void
}

export function DeleteSiteAction({
  deploymentId,
  projectName,
  disabled = false,
  className,
  title = 'Delete site',
  ariaLabel = 'Delete site',
  description,
  children,
  onDeleted,
}: DeleteSiteActionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/deployments/${deploymentId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to delete site.')
      }

      setOpen(false)
      if (onDeleted) {
        onDeleted()
      } else {
        router.refresh()
      }
      toast.success('Site deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete site.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        disabled={disabled || deleting}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(className)}
      >
        {children ?? <Trash className="h-3.5 w-3.5" />}
      </button>

      <ConfirmModal
        open={open}
        title="Delete site"
        description={description ?? `"${projectName}" will be taken offline and moved to Archived. You can restore it at any time.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete Site'}
        cancelLabel="Keep Site"
        variant="danger"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}
