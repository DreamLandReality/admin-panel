'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { StepTemplatePicker } from '@/components/wizard/step-template-picker'
import { StepDataInput } from '@/components/wizard/step-data-input'
import { EditorShell } from '@/components/editor/editor-shell'
import { SyncHeaderContent } from '@/components/shared/sync-header-content'
import { useWizardStore } from '@/stores/wizard-store'
import type { Template } from '@/types'

export default function NewDeploymentPage() {
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draft')

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(!!draftId)
  const { currentStep, reset, loadFromDraft } = useWizardStore()

  useEffect(() => {
    const controller = new AbortController()

    async function init() {
      // Always fetch templates
      const templatesRes = await fetch('/api/templates', { signal: controller.signal })
      const templatesData = await templatesRes.json()
      const allTemplates: Template[] = templatesData.data ?? []
      setTemplates(allTemplates)

      if (draftId) {
        // Resume from draft
        try {
          const draftRes = await fetch(`/api/drafts/${draftId}`, { signal: controller.signal })
          const draftData = await draftRes.json()

          if (draftRes.ok && draftData.data) {
            const draft = draftData.data
            // Find matching template
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
        // Fresh wizard
        reset()
      }

      setLoading(false)
    }

    init().catch((err) => {
      if (err.name !== 'AbortError') console.error(err)
    })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    )
  }

  // Step 3: Editor takes over the full screen (fixed overlay)
  if (currentStep === 3) {
    return <EditorShell />
  }

  // Steps 1, 2 & 4: standard wizard layout
  return (
    <>
      {/* Push step counter to main header */}
      <SyncHeaderContent>
        <div className="text-center min-w-[52px]">
          <p className="font-serif text-3xl font-light tabular-nums leading-none text-foreground">
            {currentStep}<span className="text-foreground-muted">/3</span>
          </p>
          <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-foreground-muted">
            Step
          </p>
        </div>
      </SyncHeaderContent>

      <WizardShell currentStep={currentStep}>
        {currentStep === 1 && (
          <StepTemplatePicker templates={templates} />
        )}
        {currentStep === 2 && <StepDataInput />}
      </WizardShell>
    </>
  )
}
