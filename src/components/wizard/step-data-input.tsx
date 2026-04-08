'use client'

import { useEffect, useRef, useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { useAiProviderStore } from '@/stores/ai-provider-store'
import { Button } from '@/components/ui/button'
import { Spinner, Heading } from '@/components/primitives'
import { TextInput, TextArea } from '@/components/forms'
import { Skeleton } from '@/components/ui'
import { WarningCallout } from '@/components/feedback/WarningCallout'

const MAX_CHARS = 50_000
const WARN_CHARS = 45_000

const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ForwardArrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 6h8M7 3l3 3-3 3" />
  </svg>
)

/** Shared footer row: back button on the left, custom actions on the right */
function WizardFooter({
  onBack,
  backDisabled,
  children,
}: {
  onBack: () => void
  backDisabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button
        variant="ghost"
        size="lg"
        onClick={onBack}
        disabled={backDisabled}
        className="gap-1.5"
      >
        <BackArrow />
        Back
      </Button>
      {children}
    </div>
  )
}

export function StepDataInput({
  isAiConfigured = false,
  isGeminiConfigured = false,
}: {
  isAiConfigured?: boolean
  isGeminiConfigured?: boolean
}) {
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const projectName = useWizardStore((s) => s.projectName)
  const setProjectName = useWizardStore((s) => s.setProjectName)
  const rawText = useWizardStore((s) => s.rawText)
  const setRawText = useWizardStore((s) => s.setRawText)
  const loadParseResult = useWizardStore((s) => s.loadParseResult)
  const loadManualDefaults = useWizardStore((s) => s.loadManualDefaults)
  const setStep = useWizardStore((s) => s.setStep)
  const { provider } = useAiProviderStore()

  const [stage, setStage] = useState<'name' | 'description'>(projectName ? 'description' : 'name')
  const [localName, setLocalName] = useState(projectName)
  const [nameError, setNameError] = useState('')
  const [nameCheckLoading, setNameCheckLoading] = useState(false)
  const nameCheckAbortRef = useRef<AbortController | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Scroll to top of main content when sub-step changes
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stage])

  const charCount = rawText.length
  const isOverLimit = charCount > MAX_CHARS
  const isNearLimit = charCount > WARN_CHARS && !isOverLimit
  // Parse is enabled only if the currently-selected provider is configured
  const isCurrentProviderConfigured = provider === 'gemini' ? isGeminiConfigured : isAiConfigured
  const canParse = isCurrentProviderConfigured && rawText.trim().length > 0 && !isOverLimit && !isLoading

  async function handleNameContinue() {
    const trimmed = localName.trim()
    if (!trimmed) {
      setNameError('Project name is required')
      return
    }

    nameCheckAbortRef.current?.abort()
    const controller = new AbortController()
    nameCheckAbortRef.current = controller
    setNameCheckLoading(true)
    setNameError('')

    try {
      const res = await fetch(
        `/api/projects/check-name?name=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      )
      if (res.ok) {
        const json = await res.json()
        if (json.exists) {
          setNameError(
            json.type === 'deployment'
              ? 'A deployed project with this name already exists'
              : 'A draft with this name already exists'
          )
          return
        }
      }
    } catch {
      // Network error — allow proceeding
    } finally {
      setNameCheckLoading(false)
    }

    setProjectName(trimmed)
    setStage('description')
  }

  async function handleParse() {
    if (!selectedTemplate || !canParse) return
    setIsLoading(true)
    setError(null)

    const controller = new AbortController()
    abortControllerRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, rawText, provider }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }
      loadParseResult(json.sectionData, json._sections)
    } catch (e: any) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        setError('This is taking longer than expected. Please try again.')
      } else {
        setError('Network error. Please check your connection and try again.')
      }
    } finally {
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  function handleBack() {
    abortControllerRef.current?.abort()
    setStage('name')
  }

  function handleFillManually() {
    if (!selectedTemplate) return
    loadManualDefaults(selectedTemplate)
  }

  const sections = selectedTemplate?.manifest?.sections ?? []

  // ── Stage 1: Project Name ──────────────────────────────────────────────────
  if (stage === 'name') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Heading variant="h2" as="h1">Name your project</Heading>
          <p className="text-muted-foreground mt-1 text-sm">
            Give this property a name — you can always change it later.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <TextInput
              variant="underline"
              type="text"
              value={localName}
              onChange={(e) => { setLocalName(e.target.value); setNameError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameContinue() }}
              placeholder="Luxury Heights Mumbai"
              autoFocus
              error={!!nameError}
              className="text-xl focus:border-foreground"
            />
            {nameError && <p className="mt-1.5 text-xs text-error">{nameError}</p>}
          </div>

          <WizardFooter onBack={() => setStep(1)}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleNameContinue}
              disabled={nameCheckLoading}
              className="gap-2"
            >
              Continue
              <ForwardArrow />
            </Button>
          </WizardFooter>
        </div>
      </div>
    )
  }

  // ── Stage 2: Property Description ─────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Heading variant="h2" as="h1">Property Intelligence</Heading>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste any property description, brochure text, or listing details — Claude will extract and organise it.
        </p>
      </div>

      <TextArea
        variant="underline"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste your property text here…&#10;&#10;e.g. 3 BHK luxury apartment in Bandra West, Mumbai. 1850 sq ft. Sea views. ₹4.5 crore. Amenities: rooftop pool, gym, concierge…"
        disabled={isLoading}
        error={isOverLimit}
        warn={isNearLimit}
        charCount={{ current: charCount, max: MAX_CHARS, warn: WARN_CHARS }}
        className="min-h-[280px] focus:border-foreground disabled:opacity-50 mb-1"
      />

      {error && (
        <WarningCallout variant="error" title="Error" description={error} className="mb-6" />
      )}

      {isLoading && (
        <div className="mb-6 space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Spinner size="xs" variant="muted" />
            Extracting property data…
          </p>
          {sections.slice(0, 5).map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-2.5 w-full mb-1.5" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          ))}
        </div>
      )}

      <WizardFooter onBack={handleBack}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="lg" onClick={handleFillManually} disabled={isLoading}>
            Fill manually
          </Button>
          <div className="relative group">
            <Button
              variant="primary"
              size="lg"
              onClick={handleParse}
              disabled={!canParse}
            >
              Parse with AI
            </Button>
            {!isCurrentProviderConfigured && (
              <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block z-10">
                <div className="bg-popover border border-border text-popover-foreground text-xs rounded-md px-3 py-2 whitespace-nowrap shadow-md">
                  {provider === 'gemini' ? 'Gemini' : 'Claude'} is not configured
                </div>
              </div>
            )}
          </div>
        </div>
      </WizardFooter>
    </div>
  )
}
