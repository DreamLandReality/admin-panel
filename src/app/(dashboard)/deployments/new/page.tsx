'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { StepTemplatePicker } from '@/components/wizard/step-template-picker'
import { StepDataInput } from '@/components/wizard/step-data-input'
import { SyncHeaderContent } from '@/components/shared/sync-header-content'
import { Skeleton } from '@/components/ui'
import { useWizardStore } from '@/stores/wizard-store'
import { ROUTES } from '@/lib/constants'
import type { Template } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveDeploy {
  id: string
  project_name: string
  status: 'deploying' | 'building'
  updated_at: string
  github_repo: string | null
}

// ── Active deployment gate ─────────────────────────────────────────────────────

function minutesAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
}

interface GateProps {
  deployment: ActiveDeploy
  isLikelyStuck: boolean
  onCancelSuccess: () => void
}

function ActiveDeploymentGate({ deployment, isLikelyStuck, onCancelSuccess }: GateProps) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const age = minutesAgo(deployment.updated_at)

  async function handleCancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/deployments/${deployment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', site_data: {} }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setCancelError(json.error ?? 'Could not cancel. Try again.')
        setCancelling(false)
        return
      }
      onCancelSuccess()
    } catch {
      setCancelError('Network error. Please try again.')
      setCancelling(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Icon ── */}
        <div className="flex justify-center">
          {isLikelyStuck ? (
            <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/25 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" className="text-amber-400/80">
                <path d="M10 6v4l2.5 2.5" />
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 2.5V1M10 19v-1.5M17.5 10H19M1 10h1.5" strokeWidth="1.2" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/25 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                strokeWidth="1.5" className="animate-spin text-amber-400/70"
                style={{ animationDuration: '1s' }}>
                <circle cx="10" cy="10" r="7" strokeDasharray="28 16" />
              </svg>
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
            ? 'bg-amber-400/5 border-amber-400/15 text-amber-400/70'
            : 'bg-surface border-border text-foreground-muted',
        )}>
          {isLikelyStuck ? (
            <>
              <span className="font-medium text-amber-400/90">Started {age} minute{age !== 1 ? 's' : ''} ago</span> and hasn&apos;t
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
                disabled={cancelling}
                className="flex-1 h-9 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-400/90 text-sm font-medium hover:bg-amber-400/20 active:scale-[0.97] active:opacity-80 transition-all duration-100 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Force Cancel & Start New'}
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
                disabled={cancelling}
                className="flex-1 h-9 rounded-lg border border-border text-foreground-muted text-sm hover:text-foreground hover:bg-surface-hover active:scale-[0.97] active:opacity-70 transition-all duration-100 disabled:opacity-40"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Deployment'}
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

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [isAiConfigured, setIsAiConfigured] = useState(false)
  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false)
  const [activeDeployment, setActiveDeployment] = useState<ActiveDeploy | null>(null)
  const [isLikelyStuck, setIsLikelyStuck] = useState(false)
  const currentStep = useWizardStore((s) => s.currentStep)
  const reset = useWizardStore((s) => s.reset)
  const loadFromDraft = useWizardStore((s) => s.loadFromDraft)

  // Keep a stable ref to init so we can call it again after cancellation
  const initRef = useRef<((signal: AbortSignal) => Promise<void>) | null>(null)

  const init = useCallback(async (signal: AbortSignal) => {
    setLoading(true)

    // ── Check for active deployment before loading the wizard ──────────────
    try {
      const activeRes = await fetch('/api/deployments/active', { signal })
      if (activeRes.ok) {
        const { deployment, isLikelyStuck: stuck } = await activeRes.json()
        if (deployment) {
          if (stuck) {
            // Zombie — auto-cancel it silently and continue loading the wizard
            try {
              await fetch(`/api/deployments/${deployment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', site_data: {} }),
                signal,
              })
              // Fall through to load the wizard normally
            } catch (err: any) {
              if (err.name === 'AbortError') return
              // Cancel failed — show the gate as a fallback
              setActiveDeployment(deployment)
              setIsLikelyStuck(stuck)
              setLoading(false)
              return
            }
          } else {
            // Genuine in-progress deployment — redirect straight to its progress page
            router.replace(`/deployments/${deployment.id}/progress`)
            return
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      // Network failure: fall through and let the 429 guard in /deploy handle it
    }

    setActiveDeployment(null)

    // ── Load templates and feature flags in parallel ───────────────────────
    const [templatesRes, configRes] = await Promise.all([
      fetch('/api/templates', { signal }),
      fetch('/api/config', { signal }),
    ])
    const templatesData = await templatesRes.json()
    const allTemplates: Template[] = templatesData.data ?? []
    setTemplates(allTemplates)

    if (configRes.ok) {
      const config = await configRes.json()
      setIsAiConfigured(!!config.isAiConfigured)
      setIsGeminiConfigured(!!config.isGeminiConfigured)
    }

    if (draftId) {
      try {
        const draftRes = await fetch(`/api/drafts/${draftId}`, { signal })
        const draftData = await draftRes.json()

        if (draftRes.ok && draftData.data) {
          const draft = draftData.data
          const template = allTemplates.find(
            (t) => t.id === draft.template_id || t.slug === draft.template_slug
          )
          if (template) {
            loadFromDraft(draft, template)
          } else {
            console.error('[Resume] Template not found for draft')
            reset()
          }
        } else {
          console.error('[Resume] Draft not found:', draftData.error)
          reset()
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[Resume] Failed:', err)
          reset()
        }
      }
    } else {
      reset()
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId])

  useEffect(() => {
    const controller = new AbortController()
    initRef.current = init
    init(controller.signal).catch((err) => {
      if (err.name !== 'AbortError') console.error(err)
    })
    return () => controller.abort()
  }, [init])

  function handleCancelSuccess() {
    const controller = new AbortController()
    init(controller.signal).catch(console.error)
  }

  // ── Step 3: navigate to isolated editor route ─────────────────────────
  useEffect(() => {
    if (!loading && !activeDeployment && currentStep === 3) {
      if (ROUTES.editorNew) {
        router.push(ROUTES.editorNew)
      }
    }
  }, [loading, activeDeployment, currentStep, router])

  if (!loading && !activeDeployment && currentStep === 3) return null

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden bg-card">
            <Skeleton className="aspect-card w-full" />
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
  if (activeDeployment) {
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
      <SyncHeaderContent>
        <div className="text-center min-w-[52px]">
          <p className="font-serif text-3xl font-light tabular-nums leading-none text-foreground">
            {currentStep}<span className="text-foreground-muted">/3</span>
          </p>
          <p className="mt-1.5 text-micro font-bold uppercase tracking-label text-foreground-muted">
            Step
          </p>
        </div>
      </SyncHeaderContent>

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
        <div key={i} className="rounded-xl overflow-hidden bg-card">
          <Skeleton className="aspect-card w-full" />
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
