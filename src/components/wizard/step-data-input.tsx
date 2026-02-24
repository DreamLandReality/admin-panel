'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { Skeleton } from '@/components/ui'

const MAX_CHARS = 50_000
const WARN_CHARS = 45_000

export function StepDataInput() {
  const { selectedTemplate, projectName, setProjectName, rawText, setRawText, loadParseResult, loadManualDefaults, setStep } =
    useWizardStore()

  // If project name is already set (e.g. resumed from draft), skip the name stage
  const [stage, setStage] = useState<'name' | 'description'>(projectName ? 'description' : 'name')
  const [localName, setLocalName] = useState(projectName)
  const [nameError, setNameError] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const charCount = rawText.length
  const isOverLimit = charCount > MAX_CHARS
  const isNearLimit = charCount > WARN_CHARS && !isOverLimit
  const canParse = rawText.trim().length > 0 && !isOverLimit && !isLoading

  function handleNameContinue() {
    const trimmed = localName.trim()
    if (!trimmed) {
      setNameError('Project name is required')
      return
    }
    setProjectName(trimmed)
    setNameError('')
    setStage('description')
  }

  async function handleParse() {
    if (!selectedTemplate || !canParse) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, rawText }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }

      loadParseResult(json.sectionData, json._sections)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
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
          <h1 className="text-2xl font-semibold text-foreground">Name your project</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Give this property a name — you can always change it later.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <input
              type="text"
              value={localName}
              onChange={(e) => { setLocalName(e.target.value); setNameError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameContinue() }}
              placeholder="Luxury Heights Mumbai"
              autoFocus
              className={cn(
                'w-full border-0 border-b bg-transparent px-0 py-3 text-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors',
                nameError ? 'border-red-500' : 'border-border focus:border-foreground'
              )}
            />
            {nameError && (
              <p className="mt-1.5 text-xs text-red-400">{nameError}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>

            <button
              onClick={handleNameContinue}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-2"
            >
              Continue
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 6h8M7 3l3 3-3 3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Stage 2: Property Description ─────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Property Intelligence</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste any property description, brochure text, or listing details — Claude will extract and organise it.
        </p>
      </div>

      {/* Textarea */}
      <div className="relative mb-1">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste your property text here…&#10;&#10;e.g. 3 BHK luxury apartment in Bandra West, Mumbai. 1850 sq ft. Sea views. ₹4.5 crore. Amenities: rooftop pool, gym, concierge…"
          disabled={isLoading}
          className={cn(
            'w-full min-h-[280px] resize-none rounded-none border-0 border-b bg-transparent px-0 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground transition-colors disabled:opacity-50',
            isOverLimit ? 'border-red-500' : isNearLimit ? 'border-amber-500' : 'border-border'
          )}
        />
      </div>

      {/* Character counter */}
      <div className="flex justify-end mb-6">
        <span
          className={cn(
            'text-xs tabular-nums',
            isOverLimit ? 'text-red-500 font-medium' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'
          )}
        >
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          {isOverLimit && ' — over limit'}
          {isNearLimit && ' — approaching limit'}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/5 px-4 py-3">
          <svg className="mt-0.5 shrink-0 text-red-500" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 4v3.5M7 10h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <div className="flex gap-3 mt-1.5 text-xs text-red-600 dark:text-red-500">
              <button onClick={() => { setError(null); handleParse() }} className="hover:underline">Try Again</button>
              <span>·</span>
              <button onClick={handleFillManually} className="hover:underline">Fill Manually Instead</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mb-6 space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-3 h-3 border border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
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

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStage('name')}
          disabled={isLoading}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleFillManually}
            disabled={isLoading}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Fill manually
          </button>

          <button
            onClick={handleParse}
            disabled={!canParse}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
              canParse
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-foreground/10 text-muted-foreground cursor-not-allowed'
            )}
          >
            Parse with AI
          </button>
        </div>
      </div>
    </div>
  )
}
