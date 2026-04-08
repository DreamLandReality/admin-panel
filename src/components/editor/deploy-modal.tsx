'use client'

import { BaseModal } from '@/components/ui/base-modal'
import { Button } from '@/components/ui/button'
import { IconContainer, Heading } from '@/components/primitives'
import { WarningCallout } from '@/components/feedback/WarningCallout'

interface DeployModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  projectName: string
  templateName: string
  siteSlug: string
  warnings: string[]
  isRedeploy: boolean
  isLoading?: boolean
}

export function DeployModal({
  open,
  onClose,
  onConfirm,
  projectName,
  templateName,
  siteSlug,
  warnings,
  isRedeploy,
  isLoading,
}: DeployModalProps) {
  return (
    <BaseModal open={open} onClose={onClose}>
      <div className="p-6 space-y-5">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <IconContainer size="md" variant="default">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </IconContainer>
          <div>
            <Heading variant="modal-title">
              {isRedeploy ? 'Publish Changes' : 'Deploy Site'}
            </Heading>
            <p className="text-body-sm text-muted-foreground mt-1">
              {isRedeploy
                ? 'Your changes will be rebuilt and the live site will be updated.'
                : 'A new GitHub repository and Cloudflare Pages site will be created.'}
            </p>
          </div>
        </div>

        {/* Site details */}
        <div className="bg-white/5 border border-white/10 rounded p-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Project</span>
            <span className="text-foreground font-medium truncate">{projectName || 'Untitled'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">URL slug</span>
            <span className="text-foreground font-mono text-xs truncate">{siteSlug}</span>
          </div>
          <p className="text-xs text-muted-foreground">Exact URL confirmed after deploy — a numeric suffix may be added if this name is taken.</p>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Template</span>
            <span className="text-foreground truncate">{templateName}</span>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <WarningCallout title="Heads up" items={warnings} />
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isLoading} className="flex-1 text-foreground border border-white/20 hover:bg-surface-active">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onConfirm}
            loading={isLoading}
            disabled={isLoading}
            className="flex-1"
          >
            {isRedeploy ? 'Publish Changes' : 'Deploy'}
          </Button>
        </div>
      </div>
    </BaseModal>
  )
}
