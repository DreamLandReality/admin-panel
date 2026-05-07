'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { log } from '@/lib/log'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { StepTemplatePicker } from '@/components/wizard/step-template-picker'
import { StepDataInput } from '@/components/wizard/step-data-input'
import { SyncHeaderStepCounter } from '@/components/shared/sync-header-step-counter'
import { Skeleton } from '@/components/ui'
import { useWizardStore } from '@/stores/wizard-store'
import { ROUTES } from '@/lib/constants'
import { useConfigQuery } from '@/hooks/queries/use-config-query'
import { useTemplatesQuery } from '@/hooks/queries/use-templates-query'
import { useDraftQuery } from '@/hooks/queries/use-drafts-query'
import { useActiveDeploymentGateQuery } from '@/hooks/queries/use-deployments-query'
import {
  useCancelDeploymentMutation,
} from '@/hooks/mutations/use-deployment-mutation'
import { ClockIcon, SpinnerCircleIcon } from '@/components/icons'
import type { ActiveDeployment } from '@/services/types'

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Active deployment gate ─────────────────────────────────────────────────────

function minutesAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
}

interface GateProps {
  deployment: ActiveDeployment
  isLikelyStuck: boolean
  onCancelSuccess: () => void
}

function ActiveDeploymentGate({ deployment, isLikelyStuck, onCancelSuccess }: GateProps) {
  const router = useRouter()
  const [cancelError, setCancelError] = useState<string | null>(null)
  const cancelDeployment = useCancelDeploymentMutation()
  const age = minutesAgo(deployment.updated_at)

  async function handleCancel() {
    setCancelError(null)
    try {
      await cancelDeployment.mutateAsync(deployment.id)
      onCancelSuccess()
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Network error. Please try again.')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Icon ── */}
        <div className="flex justify-center">
          {isLikelyStuck ? (
            <div className="w-12 h-12 rounded-full bg-warning/10 border border-warning/25 flex items-center justify-center">
              <ClockIcon width={20} height={20} strokeWidth={1.6} className="text-warning/80" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-warning/10 border border-warning/25 flex items-center justify-center">
              <SpinnerCircleIcon width={20} height={20} strokeWidth={1.5} className="animate-spin text-warning/70" />
            </div>
          )}
        </div>

        {/* ── Heading ── */}
        <div className="text-center space-y-1.5">
          <h2 className="font-serif text-xl text-foreground">
            {isLikelyStuck ? 'Deployment May Be Stuck' : 'Deployment In Progress'}
          </h2>
          <p className="text-sm text-foreground-muted font-medium truncate px-2">
            {deployment.project_name}
          </p>
        </div>

        {/* ── Body ── */}
        <div className={cn(
          'rounded-xl border px-4 py-3.5 text-sm leading-relaxed',
          isLikelyStuck
            ? 'bg-warning/5 border-warning/15 text-warning/70'
            : 'bg-surface border-border text-foreground-muted',
        )}>
          {isLikelyStuck ? (
            <>
              <span className="font-medium text-warning/90">Started {age} minute{age !== 1 ? 's' : ''} ago</span> and hasn&apos;t
              made recent progress. It may have failed silently without updating its status.
            </>
          ) : (
            <>
              A site is currently being deployed. Watch its progress or cancel it to start a new commission.
            </>
          )}
        </div>

        {/* ── Error ── */}
        {cancelError && (
          <p className="text-xs text-error text-center">{cancelError}</p>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3">
          {isLikelyStuck ? (
            <>
              <button
                onClick={handleCancel}
                disabled={cancelDeployment.isPending}
                className="flex-1 h-9 rounded-lg bg-warning/15 border border-warning/25 text-warning/90 text-sm font-medium hover:bg-warning/20 active:scale-[0.97] active:opacity-80 transition-all duration-100 disabled:opacity-50"
              >
                {cancelDeployment.isPending ? 'Cancelling…' : 'Force Cancel & Start New'}
              </button>
              <button
                onClick={() => router.push(`/deployments/${deployment.id}/progress`)}
                className="flex-1 h-9 rounded-lg border border-border text-foreground-muted text-sm hover:text-foreground hover:bg-surface-hover active:scale-[0.97] active:opacity-70 transition-all duration-100"
              >
                Watch Deployment
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => router.push(`/deployments/${deployment.id}/progress`)}
                className="flex-1 h-9 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 active:scale-[0.97] active:opacity-80 transition-all duration-100"
              >
                Watch Progress
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelDeployment.isPending}
                className="flex-1 h-9 rounded-lg border border-border text-foreground-muted text-sm hover:text-foreground hover:bg-surface-hover active:scale-[0.97] active:opacity-70 transition-all duration-100 disabled:opacity-40"
              >
                {cancelDeployment.isPending ? 'Cancelling…' : 'Cancel Deployment'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

function NewDeploymentPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const draftId = searchParams.get('draft')

  const currentStep = useWizardStore((s) => s.currentStep)
  const reset = useWizardStore((s) => s.reset)
  const loadFromDraft = useWizardStore((s) => s.loadFromDraft)

  const appConfigQuery = useConfigQuery()
  const templatesQuery = useTemplatesQuery()
  const draftQuery = useDraftQuery(draftId)
  const activeGateQuery = useActiveDeploymentGateQuery()
  const autoCancelDeployment = useCancelDeploymentMutation()
  const resetForNoDraftRef = useRef(false)
  const loadedDraftRef = useRef<string | null>(null)
  const autoCancelAttemptRef = useRef<string | null>(null)

  const activeDeployment = activeGateQuery.data?.deployment ?? null
  const isLikelyStuck = activeGateQuery.data?.isLikelyStuck ?? false
  const autoCancelSucceeded = !!activeDeployment && isLikelyStuck && autoCancelDeployment.isSuccess
  const showActiveDeploymentGate = !!activeDeployment && isLikelyStuck && autoCancelDeployment.isError
  const isRedirectingActiveDeployment = !!activeDeployment && !isLikelyStuck
  const isAutoCancelling = !!activeDeployment && isLikelyStuck && !autoCancelDeployment.isError && !autoCancelDeployment.isSuccess
  const canLoadWizard = activeGateQuery.isError || !activeDeployment || autoCancelSucceeded
  const templates = useMemo(
    () => canLoadWizard ? templatesQuery.data ?? [] : [],
    [canLoadWizard, templatesQuery.data]
  )
  const isAiConfigured = appConfigQuery.data?.isAiConfigured ?? false
  const isGeminiConfigured = appConfigQuery.data?.isGeminiConfigured ?? false
  const isWizardDataLoading =
    canLoadWizard &&
    (templatesQuery.isLoading || appConfigQuery.isLoading || (!!draftId && draftQuery.isLoading))
  const loading =
    activeGateQuery.isLoading ||
    isRedirectingActiveDeployment ||
    isAutoCancelling ||
    isWizardDataLoading

  useEffect(() => {
    resetForNoDraftRef.current = false
    loadedDraftRef.current = null
  }, [draftId])

  useEffect(() => {
    if (activeDeployment && !isLikelyStuck) {
      router.replace(`/deployments/${activeDeployment.id}/progress`)
    }
  }, [activeDeployment, isLikelyStuck, router])

  useEffect(() => {
    if (
      !activeDeployment ||
      !isLikelyStuck ||
      autoCancelDeployment.isPending ||
      autoCancelDeployment.isSuccess ||
      autoCancelDeployment.isError ||
      autoCancelAttemptRef.current === activeDeployment.id
    ) {
      return
    }
    autoCancelAttemptRef.current = activeDeployment.id
    autoCancelDeployment.mutate(activeDeployment.id)
  }, [activeDeployment, autoCancelDeployment, isLikelyStuck])

  useEffect(() => {
    if (!canLoadWizard || templatesQuery.isLoading || appConfigQuery.isLoading) return
    if (!draftId) {
      if (!resetForNoDraftRef.current) {
        reset()
        resetForNoDraftRef.current = true
      }
      return
    }
    if (draftQuery.isLoading || loadedDraftRef.current === draftId) return
    if (draftQuery.isError || !draftQuery.data) {
      log.error('[Resume] Draft not found:', draftQuery.error?.message ?? 'Unknown error')
      reset()
      loadedDraftRef.current = draftId
      return
    }
    const template = templates.find(
      (t) => t.id === draftQuery.data.template_id || t.slug === draftQuery.data.template_slug
    )
    if (template) {
      loadFromDraft(draftQuery.data, template)
    } else {
      log.error('[Resume] Template not found for draft')
      reset()
    }
    loadedDraftRef.current = draftId
  }, [
    appConfigQuery.isLoading,
    canLoadWizard,
    draftId,
    draftQuery.data,
    draftQuery.error,
    draftQuery.isError,
    draftQuery.isLoading,
    loadFromDraft,
    reset,
    templates,
    templatesQuery.isLoading,
  ])

  function handleCancelSuccess() {
    void activeGateQuery.refetch()
  }

  // ── Step 3: navigate to isolated editor route ─────────────────────────
  useEffect(() => {
    if (!loading && !showActiveDeploymentGate && currentStep === 3) {
      if (ROUTES.editorNew) {
        router.push(ROUTES.editorNew)
      }
    }
  }, [loading, showActiveDeploymentGate, currentStep, router])

  if (!loading && !showActiveDeploymentGate && currentStep === 3) return null

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden bg-card">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3">
              <Skeleton className="h-2.5 w-1/3 mb-1" />
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Active deployment gate ─────────────────────────────────────────────
  if (showActiveDeploymentGate && activeDeployment) {
    return (
      <ActiveDeploymentGate
        deployment={activeDeployment}
        isLikelyStuck={isLikelyStuck}
        onCancelSuccess={handleCancelSuccess}
      />
    )
  }

  // ── Steps 1, 2 & 4: standard wizard layout ─────────────────────────────
  return (
    <>
      <SyncHeaderStepCounter currentStep={currentStep} totalSteps={3} label="Step" />

      <WizardShell currentStep={currentStep}>
        {currentStep === 1 && (
          <StepTemplatePicker templates={templates} />
        )}
        {currentStep === 2 && <StepDataInput isAiConfigured={isAiConfigured} isGeminiConfigured={isGeminiConfigured} />}
      </WizardShell>
    </>
  )
}

export default function NewDeploymentPage() {
  return (
    <Suspense fallback={<div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border overflow-hidden bg-card">
          <Skeleton className="aspect-square w-full" />
          <div className="p-3">
            <Skeleton className="h-2.5 w-1/3 mb-1" />
            <Skeleton className="h-4 w-full mb-1.5" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>}>
      <NewDeploymentPageContent />
    </Suspense>
  )
}
