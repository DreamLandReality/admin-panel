import { cn } from '@/lib/utils/cn'
import { CheckIcon, XIcon } from '@/components/icons'
import type { DeployStepState } from '@/types'

export function StepDot({ status }: { status: DeployStepState['status'] }) {
  return (
    <div className={cn(
      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200',
      status === 'done' && 'bg-success/15 border border-success/40',
      status === 'running' && 'bg-warning/15 border border-warning/50',
      status === 'error' && 'bg-error/15 border border-error/40',
      status === 'pending' && 'border border-white/10 bg-white/[0.03]',
    )}>
      {status === 'done' && (
        <CheckIcon width={12} height={12} strokeWidth={2} className="text-success" />
      )}
      {status === 'running' && (
        <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
      )}
      {status === 'error' && (
        <XIcon width={12} height={12} strokeWidth={2} className="text-error" />
      )}
      {status === 'pending' && (
        <div className="w-1 h-1 rounded-full bg-white/20" />
      )}
    </div>
  )
}
