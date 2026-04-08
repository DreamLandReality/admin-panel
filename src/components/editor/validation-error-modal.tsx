'use client'

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
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  blob_url: {
    label: 'Not uploaded',
    color: 'text-orange-400',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      </svg>
    ),
  },
  missing_data: {
    label: 'Missing data',
    color: 'text-error',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  default_image: {
    label: 'Default image',
    color: 'text-amber-400',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-error">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
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
