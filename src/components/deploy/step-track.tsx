import { cn } from '@/lib/utils/cn'
import { Skeleton } from '@/components/ui'
import { DEPLOY_STEP_SHORT_LABELS } from './deploy-steps'
import { StepDot } from './step-dot'
import type { DeployStepState } from '@/types'

export function StepTrack({ steps }: { steps: DeployStepState[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <StepDot status={step.status} />
            {i < steps.length - 1 && (
              <div className={cn(
                'h-px flex-1 mx-1 transition-colors duration-300',
                step.status === 'done' ? 'bg-success/25' : 'bg-white/[0.07]',
              )} />
            )}
          </div>
        ))}
      </div>
      <div className="flex">
        {steps.map((step) => (
          <div key={step.id} className="flex-1 flex justify-center">
            <span className={cn(
              'text-[10px] tracking-wide transition-colors duration-200',
              step.status === 'done' && 'text-success/50',
              step.status === 'running' && 'text-warning/80 font-medium',
              step.status === 'error' && 'text-error/70',
              step.status === 'pending' && 'text-muted-foreground/30',
            )}>
              {DEPLOY_STEP_SHORT_LABELS[step.id]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StepTrackSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
            {i < 5 && <Skeleton className="h-px flex-1 mx-1" />}
          </div>
        ))}
      </div>
      <div className="flex">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex justify-center">
            <Skeleton className="h-2.5 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
