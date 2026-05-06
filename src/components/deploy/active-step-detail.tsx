import { Spinner } from '@/components/primitives'
import type { DeployStepState } from '@/types'

interface ActiveStepDetailProps {
  activeStep: DeployStepState | undefined
  isPolling: boolean
  footer?: string
  showPollingSpinner?: boolean
}

export function ActiveStepDetail({
  activeStep,
  isPolling,
  footer,
  showPollingSpinner = false,
}: ActiveStepDetailProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-4 py-3 text-center space-y-1">
      {activeStep ? (
        <>
          <p className="text-sm font-medium text-foreground/90">{activeStep.label}</p>
          {activeStep.message && (
            <p className="text-xs text-muted-foreground/60">{activeStep.message}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground/60">Starting…</p>
      )}
      {isPolling && (
        <p className="text-xs text-muted-foreground/40 flex items-center justify-center gap-1.5 pt-0.5">
          {showPollingSpinner && <Spinner size="xs" variant="muted" />} Reconnecting…
        </p>
      )}
      {footer && (
        <p className="text-xs text-muted-foreground/30 pt-0.5">{footer}</p>
      )}
    </div>
  )
}
