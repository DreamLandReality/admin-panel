'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { ActiveStepDetail } from '@/components/deploy/active-step-detail'
import { makeDeploySteps } from '@/components/deploy/deploy-steps'
import { StepTrack } from '@/components/deploy/step-track'
import { ValidationErrorModal } from '@/components/editor/validation-error-modal'
import { useWizardStore } from '@/stores/wizard-store'
import { useEditorStore } from '@/stores/editor-store'
import { useDeployTransitionStore } from '@/stores/deploy-transition-store'
import { uploadPendingImages, replaceBlobUrls } from '@/lib/utils/upload-pending-images'
import { validateDeployReady } from '@/lib/deploy/validators'
import { useDeploymentQuery, useActiveDeploymentGateQuery } from '@/hooks/queries/use-deployments-query'
import {
  useCancelDeploymentMutation,
  useStartDeploymentMutation,
} from '@/hooks/mutations/use-deployment-mutation'
import { useDeploymentStreamQuery } from '@/hooks/mutations/use-deployment-stream'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CopyIcon,
  SpinnerCircleIcon,
  XIcon,
} from '@/components/icons'
import type { DeployStepState, SiteData } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function previewSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'property-site'
}

function getCurrentSiteData(): SiteData {
  const store = useEditorStore.getState()
  return {
    _sections: store.sectionsRegistry,
    ...store.sectionData,
    ...(Object.keys(store.collectionData).length > 0
      ? { _collections: store.collectionData }
      : {}),
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

type DeployView = 'confirm' | 'preparing' | 'deploying' | 'success' | 'failed'

export default function DeployPage() {
  const router = useRouter()

  // ── Zustand selectors: subscribe only to render-critical fields ──
  const projectName = useWizardStore((s) => s.projectName)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const wizardDeploymentId = useWizardStore((s) => s.deploymentId)

  const [view, setView] = useState<DeployView>('confirm')
  const [steps, setSteps] = useState<DeployStepState[]>([])
  const [finalDeploymentId, setFinalDeploymentId] = useState<string | null>(null)
  const [siteUrl, setSiteUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [buildLogs, setBuildLogs] = useState<string | null>(null)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [isDeployPending, setIsDeployPending] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDashboardNav, setIsDashboardNav] = useState(false)
  const [isEditNav, setIsEditNav] = useState(false)
  const [isVisitNav, setIsVisitNav] = useState(false)
  const [pollingDeploymentId, setPollingDeploymentId] = useState<string | null>(null)
  const [validationState, setValidationState] = useState<ReturnType<typeof validateDeployReady> | null>(null)

  const zombieCancelAttemptRef = useRef<string | null>(null)

  const isRedeploy = wizardDeploymentId !== null
  const siteSlug = previewSlug(projectName ?? '')
  const activeStep = steps.find((s) => s.status === 'running') ?? steps.find((s) => s.status === 'error')
  const doneCount = steps.filter((s) => s.status === 'done').length
  const deployWarnings = useMemo(() => {
    if (!selectedTemplate) return []
    return validateDeployReady(
      getCurrentSiteData(),
      selectedTemplate.manifest,
      projectName ?? ''
    ).warnings
  }, [selectedTemplate, projectName])
  const productionReadinessWarnings = deployWarnings.filter((warning) => warning.startsWith('Production readiness:'))
  const gateAssetWarnings = deployWarnings.filter((warning) => warning.includes('download_unavailable'))
  const { data: activeGate, refetch: reloadActiveGate } = useActiveDeploymentGateQuery()
  const { mutate: cancelActiveDeployment } = useCancelDeploymentMutation()
  const deploymentStartMutation = useStartDeploymentMutation()
  const pollingDeploymentQuery = useDeploymentQuery(pollingDeploymentId, {
    enabled: isPolling,
    refetchInterval: isPolling ? 5_000 : false,
  })

  useEffect(() => {
    useDeployTransitionStore.getState().setTransitioning(false)
    if (!selectedTemplate) router.replace('/')
  }, [router, selectedTemplate])

  useEffect(() => {
    if (view !== 'confirm') return
    const gate = activeGate
    const deployment = gate?.deployment
    if (!deployment) return

    if (gate.isLikelyStuck) {
      if (zombieCancelAttemptRef.current === deployment.id) return
      zombieCancelAttemptRef.current = deployment.id
      cancelActiveDeployment(deployment.id)
      return
    }

    router.replace(`/deployments/${deployment.id}/progress`)
  }, [activeGate, cancelActiveDeployment, router, view])

  // ── Polling fallback ────────────────────────────────────────────────────────

  function startPolling(deployId: string) {
    setPollingDeploymentId(deployId)
    setIsPolling(true)
  }

  useEffect(() => {
    if (!isPolling) return
    const dep = pollingDeploymentQuery.data?.deployment
    if (!dep) return

    if (dep.status === 'live') {
      setSiteUrl(dep.stable_url ?? dep.live_url)
      setView('success')
      setIsPolling(false)
      setPollingDeploymentId(null)
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })))
      return
    }

    if (dep.status === 'failed') {
      setErrorMsg(dep.error_message ?? 'Deployment failed')
      setBuildLogs(dep.build_logs ?? null)
      setView('failed')
      setIsPolling(false)
      setPollingDeploymentId(null)
      return
    }

    if (dep.status === 'building' || dep.status === 'deploying') {
      setSteps((prev) => {
        if (prev.some((s) => s.status === 'running')) return prev
        const idx = prev.findIndex((s) => s.status === 'pending')
        if (idx === -1) return prev
        return prev.map((s, i) => i === idx ? { ...s, status: 'running', message: 'In progress…' } : s)
      })
    }
  }, [isPolling, pollingDeploymentQuery.data])

  const deploymentStream = useDeploymentStreamQuery({
    onEvent: (event) => {
      setSteps((prev) =>
        prev.map((s) => s.id === event.step ? { ...s, status: event.status, message: event.message } : s)
      )
      if (event.step === 'cf_build' && event.status === 'done') {
        setSiteUrl(event.data?.siteUrl ?? null)
        setView('success')
        setIsPolling(false)
        setPollingDeploymentId(null)
      }
      if (event.status === 'error') {
        setErrorMsg(event.message)
        setView('failed')
        setIsPolling(false)
        setPollingDeploymentId(null)
      }
    },
    onFallback: startPolling,
  })

  // ── SSE stream ──────────────────────────────────────────────────────────────

  async function connectSSE(deployId: string) {
    await deploymentStream.connect(deployId)
  }

  // ── Deploy action ───────────────────────────────────────────────────────────

  async function handleDeploy() {
    setIsDeployPending(true)
    try {
      const editorStore = useEditorStore.getState()
      const wizardStore = useWizardStore.getState()
      const selectedTemplate = wizardStore.selectedTemplate
      if (!selectedTemplate) {
        throw new Error('Select a template before deploying.')
      }

      const preflight = validateDeployReady(
        getCurrentSiteData(),
        selectedTemplate.manifest,
        wizardStore.projectName ?? ''
      )
      if (!preflight.valid) {
        setValidationState(preflight)
        setView('confirm')
        setIsDeployPending(false)
        return
      }

      setView('preparing')
      const { urlMap, failed } = await uploadPendingImages(editorStore.pendingImages)
      if (failed.length > 0) {
        throw new Error(`${failed.length} image(s) failed to upload. Please try again.`)
      }
      const finalSectionData = replaceBlobUrls(editorStore.sectionData, urlMap)
      const finalCollectionData = replaceBlobUrls(editorStore.collectionData, urlMap)

      const site_data = {
        _sections: editorStore.sectionsRegistry,
        ...finalSectionData,
        ...(Object.keys(finalCollectionData).length > 0 ? { _collections: finalCollectionData } : {}),
      }

      const deployResult = await deploymentStartMutation.mutateAsync({
        projectName: wizardStore.projectName ?? '',
        templateId: wizardStore.selectedTemplate?.id ?? '',
        siteData: site_data,
        deploymentId: wizardStore.deploymentId,
      })

      if (!deployResult.ok) {
        if (deployResult.error.status === 429) {
          // Still rate-limited (very rare now with zombie auto-cancel) —
          // redirect to the active deployment's progress page
          try {
            const activeResult = await reloadActiveGate()
            if (activeResult.data?.deployment) {
              router.replace(`/deployments/${activeResult.data.deployment.id}/progress`)
              setIsDeployPending(false)
              return
            }
          } catch { /* ignore */ }
          // Fallback if we can't determine the active deployment
          setErrorMsg('A deployment is already in progress. Please wait and try again.')
          setView('failed')
          setIsDeployPending(false)
          return
        }
        setErrorMsg(deployResult.error.message)
        setView('failed')
        setIsDeployPending(false)
        useWizardStore.getState().reset()
        return
      }

      const newDeployId = deployResult.data.deploymentId
      setFinalDeploymentId(newDeployId)
      setSteps(makeDeploySteps(isRedeploy))
      setView('deploying')
      setIsDeployPending(false)
      useWizardStore.getState().reset()
      await connectSSE(newDeployId)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error. Please try again.')
      setView('failed')
      setIsDeployPending(false)
      useWizardStore.getState().reset()
    }
  }

  function handleCopy() {
    if (!siteUrl) return
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dark fixed inset-0 flex flex-col bg-deploy-page">
      <ValidationErrorModal
        open={!!validationState}
        onClose={() => setValidationState(null)}
        errors={validationState?.errors ?? []}
        warnings={validationState?.warnings ?? []}
      />

      {/* ── Back link — only on confirm ── */}
      {view === 'confirm' && (
        <div className="flex-shrink-0 px-6 pt-6 pb-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-foreground/80 active:opacity-50 transition-all duration-100"
          >
            <ChevronLeftIcon width={13} height={13} strokeWidth={1.4} />
            Back to editor
          </button>
        </div>
      )}

      {/* ── Centered content ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">

          {/* ──────────────── CONFIRM ──────────────── */}
          {view === 'confirm' && (
            <div className="space-y-5">
              <div className="text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center mx-auto">
                  <span className="font-serif text-xl text-foreground/50">
                    {(projectName ?? 'P').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="font-serif text-2xl text-foreground">{projectName || 'Untitled'}</h1>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    {isRedeploy ? 'Ready to publish your changes' : 'Ready to go live'}
                  </p>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  {isRedeploy
                    ? 'Your changes will be rebuilt and the live site will be updated.'
                    : 'A new GitHub repository and Cloudflare Pages site will be created.'}
                </p>
                <div className="border-t border-white/[0.06] pt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground/50">Project</span>
                    <span className="text-foreground/90 font-medium truncate">{projectName || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground/50">Template</span>
                    <span className="text-foreground/80 truncate">{selectedTemplate?.name ?? '—'}</span>
                  </div>
                  {!isRedeploy && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground/50">URL slug</span>
                      <span className="text-foreground/80 font-mono text-xs truncate">{siteSlug}</span>
                    </div>
                  )}
                </div>
              </div>

              {productionReadinessWarnings.length > 0 && (
                <div className="bg-warning/[0.06] border border-warning/15 rounded-lg px-3 py-2.5 space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-warning/80">
                    Production readiness
                  </p>
                  <ul className="space-y-1.5">
                    {productionReadinessWarnings.map((warning, index) => (
                      <li key={`${warning}-${index}`} className="text-xs text-warning/70 leading-relaxed">
                        {warning.replace(/^Production readiness:\s*/, '')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {gateAssetWarnings.length > 0 && (
                <div className="bg-warning/[0.06] border border-warning/15 rounded-lg px-3 py-2.5 space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-warning/80">
                    Gate asset warning
                  </p>
                  <ul className="space-y-1.5">
                    {gateAssetWarnings.map((warning, index) => (
                      <li key={`${warning}-${index}`} className="text-xs text-warning/70 leading-relaxed">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={isDeployPending}
                className="w-full h-10 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 active:scale-[0.98] active:opacity-80 transition-all duration-100 disabled:opacity-50"
              >
                {isDeployPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerCircleIcon width={13} height={13} strokeWidth={1.5} className="animate-spin" />
                    Starting…
                  </span>
                ) : (isRedeploy ? 'Publish Changes' : 'Deploy Site')}
              </button>
            </div>
          )}

          {/* ──────────────── PREPARING ──────────────── */}
          {view === 'preparing' && (
            <div className="text-center space-y-4">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                <SpinnerCircleIcon width={18} height={18} strokeWidth={1.5} className="animate-spin text-foreground/40" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-foreground/90">Preparing…</p>
                <p className="text-xs text-muted-foreground/50">Uploading assets and queuing build</p>
              </div>
            </div>
          )}

          {/* ──────────────── DEPLOYING ──────────────── */}
          {view === 'deploying' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <SpinnerCircleIcon width={18} height={18} strokeWidth={1.5} className="animate-spin text-foreground/40" />
                </div>
                <h1 className="font-serif text-2xl text-foreground">
                  {isRedeploy ? 'Publishing Changes' : 'Deploying Your Site'}
                </h1>
              </div>

              {steps.length > 0 && <StepTrack steps={steps} />}

              <ActiveStepDetail
                activeStep={activeStep}
                isPolling={isPolling}
                footer={`${doneCount} of ${steps.length} steps · 1–3 min`}
              />
            </div>
          )}

          {/* ──────────────── SUCCESS ──────────────── */}
          {view === 'success' && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto">
                  <CheckIcon width={18} height={18} strokeWidth={2} className="text-success" />
                </div>
                <h1 className="font-serif text-2xl text-foreground">Your Site is Live</h1>
                <p className="text-sm text-muted-foreground/60">Built and deployed successfully.</p>
              </div>
              {steps.length > 0 && <StepTrack steps={steps} />}
              {siteUrl && (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground/70 font-mono break-all flex-1">{siteUrl}</p>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex-shrink-0 p-1 rounded transition-all duration-100 active:scale-90',
                      copied ? 'text-success' : 'text-muted-foreground/50 hover:text-foreground hover:bg-white/5',
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
            </div>
          )}

          {/* ──────────────── FAILED ──────────────── */}
          {view === 'failed' && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-error/10 border border-error/20 flex items-center justify-center mx-auto">
                  <XIcon width={18} height={18} strokeWidth={2} className="text-error" />
                </div>
                <h1 className="font-serif text-2xl text-foreground">Deployment Failed</h1>
                <p className="text-sm text-muted-foreground/60">Something went wrong during deployment.</p>
              </div>

              {steps.length > 0 && <StepTrack steps={steps} />}

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
            </div>
          )}

        </div>
      </div>

      {/* ── Sticky footer — success / failure actions ── */}
      {(view === 'success' || view === 'failed') && (
        <div className="flex-shrink-0 border-t border-white/[0.07] bg-background/90 backdrop-blur-sm px-5 py-3.5">
          <div className="flex gap-2.5 max-w-sm mx-auto">
            {view === 'success' ? (
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
                  onClick={() => { setIsEditNav(true); if (finalDeploymentId) router.push(`/deployments/${finalDeploymentId}`) }}
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
                  onClick={() => {
                    setIsRetrying(true)
                    if (finalDeploymentId) {
                      router.push(`/deployments/${finalDeploymentId}`)
                    } else {
                      router.back()
                    }
                  }}
                  disabled={isRetrying}
                  className="flex-1 h-9 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 active:scale-[0.97] active:opacity-80 transition-all duration-100 disabled:opacity-50"
                >
                  {isRetrying ? (
                    <span className="flex items-center justify-center gap-2">
                      <SpinnerCircleIcon width={12} height={12} strokeWidth={1.5} className="animate-spin" />
                      Loading…
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
