'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { ActiveStepDetail } from '@/components/deploy/active-step-detail'
import { makeDeploySteps } from '@/components/deploy/deploy-steps'
import { StepTrack, StepTrackSkeleton } from '@/components/deploy/step-track'
import { Skeleton } from '@/components/ui'
import { useDeploymentQuery } from '@/hooks/queries/use-deployments-query'
import { useStartDeploymentMutation } from '@/hooks/mutations/use-deployment-mutation'
import { useDeploymentStreamQuery } from '@/hooks/mutations/use-deployment-stream'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CopyIcon,
  SpinnerCircleIcon,
  XIcon,
} from '@/components/icons'
import type { Deployment, DeployStepState, SiteData } from '@/types'
import { useDeployTransitionStore } from '@/stores/deploy-transition-store'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeployProgressPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const deploymentId = params.id

  const [projectName, setProjectName] = useState<string>('')
  const [isRedeploy, setIsRedeploy] = useState(false)
  const [steps, setSteps] = useState<DeployStepState[]>([])
  const [siteUrl, setSiteUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [buildLogs, setBuildLogs] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDashboardNav, setIsDashboardNav] = useState(false)
  const [isEditNav, setIsEditNav] = useState(false)
  const [isVisitNav, setIsVisitNav] = useState(false)
  const [deployData, setDeployData] = useState<{
    project_name: string
    template_id: string
    site_data: unknown
  } | null>(null)

  const streamConnectKeyRef = useRef<string | null>(null)

  const isDeploying = !isLoading && !isComplete && !isFailed
  const deploymentQuery = useDeploymentQuery(deploymentId, {
    refetchInterval: isPolling ? 5_000 : false,
  })
  const deploymentStartMutation = useStartDeploymentMutation()

  // Clear the root-layout transition overlay as soon as this page mounts
  useEffect(() => {
    useDeployTransitionStore.getState().setTransitioning(false)
  }, [])
  const activeStep = steps.find((s) => s.status === 'running') ?? steps.find((s) => s.status === 'error')

  // ── Poll DB for current status (SSE fallback) ─────────────────────────────

  function startPolling() {
    setIsPolling(true)
  }

  const applyDeploymentSnapshot = useCallback((dep: Deployment, shouldMarkPollingStep: boolean) => {
    const redeploy = !!dep.github_repo
    const baseSteps = makeDeploySteps(redeploy)
    setProjectName(dep.project_name ?? '')
    setIsRedeploy(redeploy)
    setDeployData({
      project_name: dep.project_name ?? '',
      template_id: dep.template_id,
      site_data: dep.site_data,
    })

    if (dep.status === 'live') {
      setSiteUrl(dep.stable_url ?? dep.live_url)
      setIsComplete(true)
      setIsFailed(false)
      setIsPolling(false)
      setSteps(baseSteps.map((s) => ({ ...s, status: 'done' })))
      return
    }

    if (dep.status === 'failed') {
      setErrorMsg(dep.error_message ?? 'Deployment failed')
      setBuildLogs(dep.build_logs ?? null)
      setIsFailed(true)
      setIsPolling(false)
      setSteps((prev) => prev.length > 0 ? prev : baseSteps)
      return
    }

    setIsComplete(false)
    setIsFailed(false)
    setSteps((prev) => {
      const currentSteps = prev.length > 0 ? prev : baseSteps
      if (!shouldMarkPollingStep || currentSteps.some((s) => s.status === 'running')) {
        return currentSteps
      }
      const firstPending = currentSteps.findIndex((s) => s.status === 'pending')
      if (firstPending === -1) return currentSteps
      return currentSteps.map((s, i) =>
        i === firstPending ? { ...s, status: 'running', message: 'In progress…' } : s
      )
    })
  }, [])

  const {
    connect: connectDeploymentStream,
    cancel: cancelDeploymentStream,
  } = useDeploymentStreamQuery({
    onEvent: (event) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === event.step
            ? { ...s, status: event.status, message: event.message }
            : s
        )
      )

      if (event.step === 'cf_build' && event.status === 'done') {
        setSiteUrl(event.data?.siteUrl ?? null)
        setIsComplete(true)
        setIsPolling(false)
      }
      if (event.status === 'error') {
        setErrorMsg(event.message)
        setIsFailed(true)
        setIsPolling(false)
      }
    },
    onFallback: startPolling,
  })

  // ── SSE consumer ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (deploymentQuery.isError) {
      setErrorMsg(deploymentQuery.error?.message ?? 'Failed to load deployment status')
      setIsFailed(true)
      setIsLoading(false)
      return
    }

    const dep = deploymentQuery.data?.deployment
    if (!dep) return

    applyDeploymentSnapshot(dep, isPolling)
    setIsLoading(false)
  }, [
    applyDeploymentSnapshot,
    deploymentQuery.data,
    deploymentQuery.error?.message,
    deploymentQuery.isError,
    isPolling,
  ])

  useEffect(() => {
    if (isLoading || isComplete || isFailed) return
    const streamKey = `${deploymentId}:${retryKey}`
    if (streamConnectKeyRef.current === streamKey) return

    streamConnectKeyRef.current = streamKey
    void connectDeploymentStream(deploymentId)
  }, [connectDeploymentStream, deploymentId, isComplete, isFailed, isLoading, retryKey])

  useEffect(() => () => cancelDeploymentStream(), [cancelDeploymentStream])

  function handleCopy() {
    if (!siteUrl) return
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRetry() {
    if (!deployData) {
      router.push(`/deployments/${deploymentId}`)
      return
    }
    setIsRetrying(true)
    try {
      const result = await deploymentStartMutation.mutateAsync({
        projectName: deployData.project_name,
        templateId: deployData.template_id,
        siteData: deployData.site_data as SiteData,
        deploymentId,
      })
      if (!result.ok) {
        setErrorMsg(result.error.message || 'Retry failed. Please try again.')
        return
      }
      // Reset to deploying state and reconnect the stream for this retry.
      setIsFailed(false)
      setIsComplete(false)
      setErrorMsg(null)
      setBuildLogs(null)
      setIsLoading(false)
      setSteps(makeDeploySteps(isRedeploy))
      setRetryKey((k) => k + 1)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Retry failed. Please try again.')
    } finally {
      setIsRetrying(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dark fixed inset-0 bg-background flex flex-col">

      {/* ── Top bar ── */}
      <div className="h-12 border-b border-white/[0.07] flex items-center px-5 flex-shrink-0 gap-2.5">
        {!isDeploying ? (
          <button
            onClick={() => { setIsDashboardNav(true); router.push('/') }}
            disabled={isDashboardNav}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground active:opacity-60 transition-all duration-100 disabled:opacity-40"
          >
            {isDashboardNav ? (
              <SpinnerCircleIcon width={12} height={12} strokeWidth={1.5} className="animate-spin text-muted-foreground/60" />
            ) : (
              <ChevronLeftIcon width={13} height={13} strokeWidth={1.4} />
            )}
            Dashboard
          </button>
        ) : (
          <span className="text-sm text-muted-foreground/60">
            {isRedeploy ? 'Publishing…' : 'Deploying…'}
          </span>
        )}
        <div className="w-px h-3.5 bg-white/[0.08]" />
        <span className="text-sm text-muted-foreground/70 truncate">{projectName || 'Deployment'}</span>
        {isDeploying && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground/40">
            <div className="w-1.5 h-1.5 rounded-full bg-success/60 animate-pulse" />
            Safe to leave
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">

          {/* ── Status header ── */}
          <div className="text-center space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="w-10 h-10 rounded-full mx-auto" />
                <Skeleton className="h-5 w-44 mx-auto mt-3" />
                <Skeleton className="h-3.5 w-36 mx-auto" />
              </>
            ) : isComplete ? (
              <>
                <div className="w-10 h-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto">
                  <CheckIcon width={18} height={18} strokeWidth={2} className="text-success" />
                </div>
                <h1 className="font-primary text-2xl text-foreground">Site is Live</h1>
                <p className="text-sm text-muted-foreground/70">Built and deployed successfully.</p>
              </>
            ) : isFailed ? (
              <>
                <div className="w-10 h-10 rounded-full bg-error/10 border border-error/20 flex items-center justify-center mx-auto">
                  <XIcon width={18} height={18} strokeWidth={2} className="text-error" />
                </div>
                <h1 className="font-primary text-2xl text-foreground">Deployment Failed</h1>
                <p className="text-sm text-muted-foreground/70">Something went wrong during deployment.</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <SpinnerCircleIcon width={18} height={18} strokeWidth={1.5} className="animate-spin text-foreground/40" />
                </div>
                <h1 className="font-primary text-2xl text-foreground">
                  {isRedeploy ? 'Publishing Changes' : 'Deploying Your Site'}
                </h1>
              </>
            )}
          </div>

          {/* ── Step track ── */}
          {isLoading ? (
            <StepTrackSkeleton />
          ) : steps.length > 0 ? (
            <StepTrack steps={steps} />
          ) : null}

          {/* ── Active step detail (deploying) ── */}
          {isDeploying && (
            <ActiveStepDetail
              activeStep={activeStep}
              isPolling={isPolling}
              showPollingSpinner
            />
          )}

          {/* ── Success: live URL with copy ── */}
          {isComplete && siteUrl && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70  break-all flex-1">{siteUrl}</p>
              <button
                onClick={handleCopy}
                title="Copy URL"
                className={cn(
                  'flex-shrink-0 p-1 rounded transition-all duration-100 active:scale-90',
                  copied
                    ? 'text-success'
                    : 'text-muted-foreground/50 hover:text-foreground hover:bg-white/5',
                )}
              >
                {copied ? (
                  <CheckIcon width={13} height={13} strokeWidth={2} />
                ) : (
                  <CopyIcon width={13} height={13} strokeWidth={1.5} />
                )}
              </button>
            </div>
          )}

          {/* ── Failure: error message + collapsible build logs ── */}
          {isFailed && (
            <div className="space-y-2">
              {errorMsg && (
                <div className="border border-error/20 bg-error/[0.06] rounded-lg p-3">
                  <p className="text-xs text-error/80 break-words leading-relaxed">{errorMsg}</p>
                </div>
              )}
              {buildLogs && (
                <div className="border border-white/[0.07] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setLogsExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-muted-foreground/50 hover:text-foreground/70 hover:bg-white/[0.03] active:bg-white/5 transition-all duration-100"
                  >
                    <span>Build logs</span>
                    <ChevronDownIcon
                      width={11}
                      height={11}
                      strokeWidth={1.5}
                      className={cn('transition-transform duration-150', logsExpanded && 'rotate-180')}
                    />
                  </button>
                  {logsExpanded && (
                    <pre className="text-xs text-muted-foreground/60 bg-white/[0.02] p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words border-t border-white/[0.07]">
                      {buildLogs}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Sticky footer ── */}
      {(isComplete || isFailed) && (
        <div className="flex-shrink-0 border-t border-white/[0.07] bg-background/90 backdrop-blur-sm px-5 py-3.5">
          <div className="flex gap-2.5 max-w-sm mx-auto">
            {isComplete ? (
              <>
                {siteUrl && (
                  <button
                    onClick={() => { setIsVisitNav(true); window.open(siteUrl, '_blank') }}
                    disabled={isVisitNav}
                    className="flex-1 h-9 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 active:scale-[0.97] active:opacity-80 transition-all duration-100 disabled:opacity-50"
                  >
                    Visit Site
                  </button>
                )}
                <button
                  onClick={() => { setIsEditNav(true); router.push(`/deployments/${deploymentId}`) }}
                  disabled={isEditNav}
                  className="flex-1 h-9 rounded-lg border border-white/10 text-foreground/80 text-sm hover:bg-white/5 hover:text-foreground active:scale-[0.97] active:opacity-70 transition-all duration-100 disabled:opacity-40"
                >
                  {isEditNav ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <SpinnerCircleIcon width={11} height={11} strokeWidth={1.5} className="animate-spin" />
                      Loading…
                    </span>
                  ) : 'Edit Site'}
                </button>
                <button
                  onClick={() => { setIsDashboardNav(true); router.push('/') }}
                  disabled={isDashboardNav}
                  className="h-9 px-3.5 rounded-lg text-muted-foreground/60 text-sm hover:text-foreground/80 active:scale-[0.97] active:opacity-60 transition-all duration-100 disabled:opacity-30"
                >
                  {isDashboardNav ? (
                    <SpinnerCircleIcon width={11} height={11} strokeWidth={1.5} className="animate-spin" />
                  ) : 'Dashboard'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="flex-1 h-9 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 active:scale-[0.97] active:opacity-80 transition-all duration-100 disabled:opacity-50"
                >
                  {isRetrying ? (
                    <span className="flex items-center justify-center gap-2">
                      <SpinnerCircleIcon width={12} height={12} strokeWidth={1.5} className="animate-spin" />
                      Retrying…
                    </span>
                  ) : 'Try Again'}
                </button>
                <button
                  onClick={() => { setIsDashboardNav(true); router.push('/') }}
                  disabled={isDashboardNav}
                  className="flex-1 h-9 rounded-lg border border-white/10 text-foreground/70 text-sm hover:bg-white/5 hover:text-foreground active:scale-[0.97] active:opacity-70 transition-all duration-100 disabled:opacity-40"
                >
                  {isDashboardNav ? (
                    <span className="flex items-center justify-center gap-2">
                      <SpinnerCircleIcon width={11} height={11} strokeWidth={1.5} className="animate-spin" />
                      Loading…
                    </span>
                  ) : 'Dashboard'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
