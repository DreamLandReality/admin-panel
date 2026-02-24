import type { DeploymentStatus } from '@/types'
import { STATUS_CONFIG } from '@/lib/constants'
import { Badge } from '@/components/ui'

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const config = STATUS_CONFIG[status]

  return (
    <Badge variant={config.variant}>
      {config.isActive && (
        <span className="relative mr-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </Badge>
  )
}
