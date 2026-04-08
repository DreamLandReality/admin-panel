'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/primitives'
import { Skeleton } from '@/components/ui'
import { DEPLOY_STEP_LABELS } from '@/types'
import type { DeployStepState, DeployStepId, DeployEvent } from '@/types'
import { useDeployTransitionStore } from '@/stores/deploy-transition-store'

// ── Short labels for the horizontal dot track ─────────────────────────────────

const STEP_SHORT: Record<DeployStepId, string> = {
  upload_images: 'Images',
  create_repo: 'Repo',
  inject_manifest: 'Data',
  cloudflare_setup: 'Hosting',
  save_record: 'Save',
  cf_build: 'Build',
}

// ── Step ordering ─────────────────────────────────────────────────────────────

const FIRST_DEPLOY_STEPS: DeployStepId[] = [
  'upload_images', 'create_repo', 'inject_manifest',
  'cloudflare_setup', 'save_record', 'cf_build',
]
const REDEPLOY_STEPS: DeployStepId[] = [
  'upload_images', 'inject_manifest', 'save_record', 'cf_build',
]

function makeSteps(isRedeploy: boolean): DeployStepState[] {
  return (isRedeploy ? REDEPLOY_STEPS : FIRST_DEPLOY_STEPS).map((id) => ({
    id,
    label: DEPLOY_STEP_LABELS[id],
    status: 'pending',
  }))
}

// ── Individual dot in the horizontal track ────────────────────────────────────

function StepDot({ status }: { status: DeployStepState['status'] }) {
  return (
    <div className={cn(
      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200',
      status === 'done'    && 'bg-success/15 border border-success/40',
      status === 'running' && 'bg-amber-400/15 border border-amber-400/50',
      status === 'error'   && 'bg-error/15 border border-error/40',
      status === 'pending' && 'border border-white/10 bg-white/[0.03]',
    )}>
      {status === 'done' && (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" className="text-success">
          <path d="M2.5 7l3 3L11.5 4" />
        </svg>
      )}
      {status === 'running' && (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      )}
      {status === 'error' && (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" className="text-error">
          <path d="M3 3l8 8M11 3L3 11" />
        </svg>
      )}
      {status === 'pending' && (
        <div className="w-1 h-1 rounded-full bg-white/20" />
      )}
    </div>
  )
}

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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isDeploying = !isLoading && !isComplete && !isFailed

  // Clear the root-layout transition overlay as soon as this page mounts
  useEffect(() => {
    useDeployTransitionStore.getState().setTransitioning(false)
  }, [])
  const activeStep = steps.find((s) => s.status === 'running') ?? steps.find((s) => s.status === 'error')
  const doneCount = steps.filter((s) => s.status === 'done').length

  // ── Poll DB for current status (SSE fallback) ─────────────────────────────

  function startPolling() {
    if (pollRef.current) return
    setIsPolling(true)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deployments/${deploymentId}`)
        if (!res.ok) return
        const json = await res.json()
        const dep = json.data?.deployment
        if (!dep) return

        if (dep.status === 'live') {
          setSiteUrl(dep.stable_url ?? dep.live_url)
          setIsComplete(true)
          setIsFailed(false)
          setIsPolling(false)
          clearInterval(pollRef.current!)
          pollRef.current = null
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })))
        } else if (dep.status === 'failed') {
          setErrorMsg(dep.error_message ?? 'Deployment failed')
          setBuildLogs(dep.build_logs ?? null)
          setIsFailed(true)
          setIsPolling(false)
          clearInterval(pollRef.current!)
          pollRef.current = null
        } else if (dep.status === 'building' || dep.status === 'deploying') {
          setSteps((prev) => {
            if (prev.some((s) => s.status === 'running')) return prev
            const firstPending = prev.findIndex((s) => s.status === 'pending')
            if (firstPending === -1) return prev
            return prev.map((s, i) =>
              i === firstPending ? { ...s, status: 'running', message: 'In progress…' } : s
            )
          })
        }
      } catch {
        // Transient error — keep polling
      }
    }, 5_000)
  }

  // ── SSE consumer ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const res = await fetch(`/api/deployments/${deploymentId}`)
        if (!res.ok) {
          setErrorMsg('Deployment not found')
          setIsFailed(true)
          setIsLoading(false)
          return
        }
        const json = await res.json()
        const dep = json.data?.deployment
        if (!dep) {
          setErrorMsg('Deployment not found')
          setIsFailed(true)
          setIsLoading(false)
          return
        }

        const redeploy = !!dep.github_repo
        setProjectName(dep.project_name ?? '')
        setIsRedeploy(redeploy)
        setSteps(makeSteps(redeploy))
        setDeployData({
          project_name: dep.project_name ?? '',
          template_id: dep.template_id,
          site_data: dep.site_data,
        })

        if (dep.status === 'live') {
          setSiteUrl(dep.stable_url ?? dep.live_url)
          setIsComplete(true)
          setSteps(makeSteps(redeploy).map((s) => ({ ...s, status: 'done' })))
          setIsLoading(false)
          return
        }
        if (dep.status === 'failed') {
          setErrorMsg(dep.error_message ?? 'Deployment failed')
          setBuildLogs(dep.build_logs ?? null)
          setIsFailed(true)
          setIsLoading(false)
          return
        }
      } catch {
        setErrorMsg('Failed to load deployment status')
        setIsFailed(true)
        setIsLoading(false)
        return
      }

      setIsLoading(false)

      try {
        const res = await fetch(`/api/deploy/${deploymentId}/stream`)
        if (!res.ok || !res.body) {
          startPolling()
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            const line = chunk.replace(/^data:\s*/, '').trim()
            if (!line) continue
            try {
              const event = JSON.parse(line) as DeployEvent

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
              }
              if (event.status === 'error') {
                setErrorMsg(event.message)
                setIsFailed(true)
              }
            } catch {
              // Malformed SSE line — ignore
            }
          }
        }
      } catch {
        if (!cancelled) startPolling()
      }
    }

    init()

    return () => {
      cancelled = true
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId, retryKey])

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
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: deployData.project_name,
          templateId: deployData.template_id,
          siteData: deployData.site_data,
          deploymentId,
        }),
      })
      const json = await res.json().catch(() => ({ error: 'Unknown error' }))
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Retry failed. Please try again.')
        return
      }
      // Reset to deploying state and re-trigger the init effect via retryKey
      setIsFailed(false)
      setIsComplete(false)
      setErrorMsg(null)
      setBuildLogs(null)
      setIsLoading(true)
      setSteps([])
      setRetryKey((k) => k + 1)
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Retry failed. Please try again.')
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
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                strokeWidth="1.5" className="animate-spin text-muted-foreground/60" style={{ animationDuration: '1s' }}>
                <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                strokeWidth="1.4" strokeLinecap="round">
                <path d="M9 11L5 7l4-4" />
              </svg>
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
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" className="text-success">
                    <path d="M3 9l4 4L15 5" />
                  </svg>
                </div>
                <h1 className="font-serif text-2xl text-foreground">Site is Live</h1>
                <p className="text-sm text-muted-foreground/70">Built and deployed successfully.</p>
              </>
            ) : isFailed ? (
              <>
                <div className="w-10 h-10 rounded-full bg-error/10 border border-error/20 flex items-center justify-center mx-auto">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" className="text-error">
                    <path d="M3 3l12 12M15 3L3 15" />
                  </svg>
                </div>
                <h1 className="font-serif text-2xl text-foreground">Deployment Failed</h1>
                <p className="text-sm text-muted-foreground/70">Something went wrong during deployment.</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                    strokeWidth="1.5" className="animate-spin text-foreground/40"
                    style={{ animationDuration: '1s' }}>
                    <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
                  </svg>
                </div>
                <h1 className="font-serif text-2xl text-foreground">
                  {isRedeploy ? 'Publishing Changes' : 'Deploying Your Site'}
                </h1>
              </>
            )}
          </div>

          {/* ── Step track ── */}
          {isLoading ? (
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
          ) : steps.length > 0 ? (
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
                      step.status === 'done'    && 'text-success/50',
                      step.status === 'running' && 'text-amber-400/80 font-medium',
                      step.status === 'error'   && 'text-error/70',
                      step.status === 'pending' && 'text-muted-foreground/30',
                    )}>
                      {STEP_SHORT[step.id]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Active step detail (deploying) ── */}
          {isDeploying && (
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
                  <Spinner size="xs" variant="muted" /> Reconnecting…
                </p>
              )}

            </div>
          )}

          {/* ── Success: live URL with copy ── */}
          {isComplete && siteUrl && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground/70 font-mono break-all flex-1">{siteUrl}</p>
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
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 7l3 3 7-6" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
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
                    <svg
                      width="11" height="11" viewBox="0 0 12 12" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                      className={cn('transition-transform duration-150', logsExpanded && 'rotate-180')}
                    >
                      <path d="M2 4l4 4 4-4" />
                    </svg>
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
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                        strokeWidth="1.5" className="animate-spin" style={{ animationDuration: '1s' }}>
                        <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
                      </svg>
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
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                      strokeWidth="1.5" className="animate-spin" style={{ animationDuration: '1s' }}>
                      <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
                    </svg>
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
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                        strokeWidth="1.5" className="animate-spin" style={{ animationDuration: '1s' }}>
                        <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
                      </svg>
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
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                        strokeWidth="1.5" className="animate-spin" style={{ animationDuration: '1s' }}>
                        <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
                      </svg>
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
