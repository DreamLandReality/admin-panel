'use client'

import { useEffect, useRef, useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { mergeUserDataIntoManifest } from '@/lib/utils/deploy-merge'
import { uploadPendingImages, replaceBlobUrls } from '@/lib/utils/upload-pending-images'
import { cn } from '@/lib/utils/cn'
import type { DeployEvent, DeployStepId } from '@/types'

const POLL_INTERVAL_MS = 8_000
const MAX_POLLS = 30 // 4 minutes max

// ─── Step definitions ────────────────────────────────────────────────────────

interface DeployStep {
  id: DeployStepId
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  message?: string
}

const INITIAL_STEPS: DeployStep[] = [
  { id: 'upload_images',    label: 'Uploading images to R2',      status: 'pending' },
  { id: 'create_repo',      label: 'Creating GitHub repository',  status: 'pending' },
  { id: 'inject_manifest',  label: 'Injecting site manifest',     status: 'pending' },
  { id: 'cloudflare_setup', label: 'Setting up Cloudflare Pages', status: 'pending' },
  { id: 'save_record',      label: 'Saving deployment record',    status: 'pending' },
  { id: 'cf_build',         label: 'Building site',               status: 'pending' },
]

// ─── Step status icons ───────────────────────────────────────────────────────

function StepIcon({ status }: { status: DeployStep['status'] }) {
  if (status === 'done') {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6l2.5 2.5 4.5-5" stroke="rgb(16 185 129)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (status === 'running') {
    return (
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        <span className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin block" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2l6 6M8 2l-6 6" stroke="rgb(239 68 68)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  // pending
  return (
    <div className="w-6 h-6 flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-border" />
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function StepDeploy() {
  const { selectedTemplate, sectionData, sectionsRegistry, collectionData, pendingImages, projectName, setStep } = useWizardStore()
  const [siteSlug, setSiteSlug] = useState('')
  const [phase, setPhase] = useState<'form' | 'progress' | 'success' | 'error'>('form')
  const [steps, setSteps] = useState<DeployStep[]>(INITIAL_STEPS.map(s => ({ ...s })))
  const [result, setResult] = useState<{ siteUrl?: string; repoUrl?: string; error?: string } | null>(null)
  const pollCountRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const templateSlug = selectedTemplate?.slug
  const isValid = siteSlug && /^[a-z0-9-]+$/.test(siteSlug) && templateSlug

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function updateStep(id: DeployStepId, status: DeployStep['status'], message?: string) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, message } : s))
  }

  function startPolling(slug: string, siteUrl: string, repoUrl: string) {
    pollCountRef.current = 0

    async function poll() {
      if (pollCountRef.current >= MAX_POLLS) {
        // Timed out — assume live
        updateStep('cf_build', 'done', 'Build complete')
        setResult({ siteUrl, repoUrl })
        setTimeout(() => setPhase('success'), 600)
        return
      }

      pollCountRef.current += 1

      try {
        const res = await fetch(`/api/deploy/status/${slug}`)
        const data = await res.json()

        if (data.status === 'live') {
          updateStep('cf_build', 'done', 'Build complete')
          setResult({ siteUrl, repoUrl })
          setTimeout(() => setPhase('success'), 600)
          return
        }

        if (data.status === 'failed') {
          updateStep('cf_build', 'error', 'Build failed')
          setResult({ error: 'Cloudflare build failed. Check your GitHub repo for build logs.' })
          setPhase('error')
          return
        }
      } catch {
        // Network blip — keep polling
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
  }

  // ─── Deploy handler ──────────────────────────────────────────────────────

  async function handleDeploy() {
    if (!isValid || !templateSlug) return

    // Reset steps and switch to progress screen
    setSteps(INITIAL_STEPS.map(s => ({ ...s })))
    setResult(null)
    setPhase('progress')

    try {
      // Step 1: Upload pending blob images to R2
      updateStep('upload_images', 'running')
      const urlMap = await uploadPendingImages(pendingImages)
      const finalSectionData = replaceBlobUrls(sectionData, urlMap)
      const finalCollectionData = replaceBlobUrls(collectionData, urlMap)
      updateStep('upload_images', 'done', urlMap.size > 0 ? `${urlMap.size} image(s) uploaded` : 'No images to upload')

      // Merge manifest
      const mergedManifest = mergeUserDataIntoManifest(
        selectedTemplate!.manifest,
        finalSectionData,
        finalCollectionData,
        sectionsRegistry
      )

      // Steps 2-5: Stream from deploy API
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateSlug,
          siteSlug,
          projectName: projectName || siteSlug,
          manifest: mergedManifest,
          siteData: { ...finalSectionData, _sections: sectionsRegistry },
        }),
      })

      // Non-stream error (auth, rate limit, validation)
      if (!res.ok && !res.body) {
        const errorData = await res.json().catch(() => ({ error: 'Deployment failed' }))
        throw new Error(errorData.error || 'Deployment failed')
      }

      // If the response is JSON (error before stream started)
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Deployment failed')
      }

      // Consume NDJSON stream
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop()! // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event: DeployEvent = JSON.parse(line)
            updateStep(event.step, event.status === 'done' ? 'done' : event.status === 'error' ? 'error' : 'running', event.message)

            if (event.status === 'error') {
              setResult({ error: event.message })
              setPhase('error')
              return
            }

            if (event.step === 'save_record' && event.status === 'done' && event.data) {
              // All stream steps done — start CF build polling
              updateStep('cf_build', 'running', 'Cloudflare is building your site...')
              startPolling(siteSlug, event.data.siteUrl!, event.data.repoUrl!)
            }
          } catch {
            // Malformed line — skip
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event: DeployEvent = JSON.parse(buffer)
          updateStep(event.step, event.status === 'done' ? 'done' : event.status === 'error' ? 'error' : 'running', event.message)
          if (event.status === 'error') {
            setResult({ error: event.message })
            setPhase('error')
          }
        } catch {
          // ignore
        }
      }

    } catch (err: any) {
      // Find the first running step and mark it as error
      setSteps(prev => {
        const updated = [...prev]
        const runningIdx = updated.findIndex(s => s.status === 'running')
        if (runningIdx >= 0) {
          updated[runningIdx] = { ...updated[runningIdx], status: 'error', message: err.message }
        }
        return updated
      })
      setResult({ error: err.message || 'Network error' })
      setPhase('error')
    }
  }

  // ─── Success screen ──────────────────────────────────────────────────────

  if (phase === 'success' && result) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-500">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-serif text-foreground mb-2">Site is Live</h2>
          <p className="text-sm text-muted-foreground">Your site has been built and deployed to the edge.</p>
        </div>
        <div className="space-y-3 text-sm">
          {result.siteUrl && (
            <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 border border-border rounded-lg hover:bg-muted/10 transition-colors">
              {result.siteUrl}
            </a>
          )}
          {result.repoUrl && (
            <a href={result.repoUrl} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 border border-border rounded-lg hover:bg-muted/10 transition-colors text-muted-foreground">
              GitHub Repository
            </a>
          )}
        </div>
      </div>
    )
  }

  // ─── Progress screen ─────────────────────────────────────────────────────

  if (phase === 'progress' || phase === 'error') {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-xl font-serif text-foreground mb-2">
            {phase === 'error' ? 'Deployment Failed' : 'Deploying Your Site'}
          </h2>
          <p className="text-sm text-muted-foreground">
            site-{siteSlug}.pages.dev
          </p>
        </div>

        {/* Step list */}
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-3">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <StepIcon status={step.status} />
                {i < steps.length - 1 && (
                  <div className={cn(
                    'w-px h-6',
                    step.status === 'done' ? 'bg-emerald-500/20' : 'bg-border/40'
                  )} />
                )}
              </div>

              {/* Label + message */}
              <div className="pb-6 min-w-0">
                <p className={cn(
                  'text-sm leading-6',
                  step.status === 'done' && 'text-foreground',
                  step.status === 'running' && 'text-foreground font-medium',
                  step.status === 'pending' && 'text-muted-foreground/60',
                  step.status === 'error' && 'text-red-400 font-medium',
                )}>
                  {step.label}
                </p>
                {step.message && step.status !== 'pending' && (
                  <p className={cn(
                    'text-xs mt-0.5',
                    step.status === 'error' ? 'text-red-400/70' : 'text-muted-foreground/60'
                  )}>
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error actions */}
        {phase === 'error' && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => { setPhase('form'); setResult(null) }}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleDeploy}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Polling info */}
        {phase === 'progress' && steps.find(s => s.id === 'cf_build')?.status === 'running' && (
          <p className="text-xs text-muted-foreground/50 text-center">
            Checking build status every 8 seconds
          </p>
        )}
      </div>
    )
  }

  // ─── Slug input form (initial screen) ────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif text-foreground mb-2">Deploy Your Site</h2>
        <p className="text-sm text-muted-foreground">
          Choose a unique slug for your site. This will be used in the URL.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project name (read-only, from Step 1) */}
        {projectName && (
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
              Project Name
            </label>
            <p className="px-3 py-2 bg-muted/10 border border-border rounded-lg text-sm text-foreground">
              {projectName}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
            Site Slug
          </label>
          <input
            type="text"
            value={siteSlug}
            onChange={(e) => setSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="luxury-heights-mumbai"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
          {siteSlug && (
            <p className="mt-1 text-xs text-muted-foreground">
              URL: https://site-{siteSlug}.pages.dev
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => setStep(3)}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to Editor
        </button>
        <button
          onClick={handleDeploy}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Deploy Now
        </button>
      </div>
    </div>
  )
}
