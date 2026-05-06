'use client'

import {
  AlertCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  ImageFrameIcon,
  ShieldAlertIcon as ShieldAlert,
  UploadIcon,
} from '@/components/icons'
import { BaseModal } from '@/components/ui/base-modal'
import { Button } from '@/components/ui/button'
import { IconContainer, Divider, Heading } from '@/components/primitives'
import { WarningCallout } from '@/components/feedback/WarningCallout'
import type { ValidationError } from '@/types'

interface ValidationErrorModalProps {
  open: boolean
  onClose: () => void
  errors: ValidationError[]
  warnings?: string[]
}

const typeConfig: Record<
  ValidationError['type'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  missing_required: {
    label: 'Required',
    color: 'text-error',
    icon: <AlertCircleIcon size={13} strokeWidth={2} />,
  },
  blob_url: {
    label: 'Not uploaded',
    color: 'text-warning',
    icon: <UploadIcon size={13} strokeWidth={2} />,
  },
  missing_data: {
    label: 'Missing data',
    color: 'text-error',
    icon: <FileTextIcon size={13} strokeWidth={2} />,
  },
  default_image: {
    label: 'Default image',
    color: 'text-warning',
    icon: <ImageFrameIcon size={13} strokeWidth={2} />,
  },
  invalid_gate: {
    label: 'Gate config',
    color: 'text-error',
    icon: <ShieldAlert size={13} strokeWidth={2} />,
  },
}

export function ValidationErrorModal({ open, onClose, errors, warnings = [] }: ValidationErrorModalProps) {
  return (
    <BaseModal open={open} onClose={onClose}>
      {/* Red accent line */}
      <Divider variant="error-strong" />

      <div className="p-6 space-y-5">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <IconContainer size="md" variant="error">
            <AlertTriangleIcon width={18} height={18} strokeWidth={1.5} className="text-error" />
          </IconContainer>
          <div>
            <Heading variant="modal-title">
              Can&apos;t deploy yet
            </Heading>
            <p className="text-body-sm text-muted-foreground mt-1">
              Fix {errors.length} issue{errors.length !== 1 ? 's' : ''} before your site can go live.
            </p>
          </div>
        </div>

        {/* Error list */}
        <div className="space-y-2">
          {errors.map((err, i) => {
            const cfg = typeConfig[err.type]
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded p-3"
              >
                <span className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                <div className="min-w-0">
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${cfg.color} block mb-0.5`}>
                    {cfg.label}
                  </span>
                  <p className="text-xs text-foreground/80 leading-relaxed">{err.message}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Warnings (if any) */}
        {warnings.length > 0 && (
          <WarningCallout title="Also note" items={warnings} />
        )}

        {/* Action */}
        <Button variant="ghost" size="md" onClick={onClose} className="w-full text-foreground border border-white/20 hover:bg-surface-active">
          Fix Issues
        </Button>
      </div>
    </BaseModal>
  )
}
