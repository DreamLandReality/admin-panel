import { STATUS_CONFIG, type DisplayStatus } from '@/lib/constants'
import { Badge } from '@/components/ui'

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} dot={config.isActive} ping={config.isActive}>
      {config.label}
    </Badge>
  )
}
