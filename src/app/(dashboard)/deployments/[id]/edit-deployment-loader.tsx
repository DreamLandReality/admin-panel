'use client'

import { useEffect, useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { EditorShell } from '@/components/editor/editor-shell'
import { formatRelativeTime } from '@/lib/utils/dashboard'
import type { Deployment, Template, Draft } from '@/types'

export function EditDeploymentLoader({
  deployment,
  template,
  editDraft,
}: {
  deployment: Deployment
  template: Template
  editDraft: Draft | null
}) {
  const { loadFromDeployment, loadFromDraft } = useWizardStore()

  // null = user hasn't chosen yet (only relevant when editDraft exists)
  // true  = load from draft, false = load fresh from deployment site_data
  const [resumeChoice, setResumeChoice] = useState<boolean | null>(
    editDraft ? null : false
  )

  // Gates EditorShell render — must be true before the editor mounts.
  // Without this, EditorShell renders on the first pass before useEffect
  // runs loadFromDeployment, showing an empty/stale editor.
  const [ready, setReady] = useState(false)

  // Template with the frozen manifest snapshot — used for both load paths
  // so the editor always reflects the deployed structure, not the current live template.
  const templateWithFrozenManifest: Template = {
    ...template,
    manifest: deployment.template_manifest ?? template.manifest,
  }

  useEffect(() => {
    if (resumeChoice === null) return // waiting for user choice

    if (resumeChoice && editDraft) {
      loadFromDraft(editDraft, templateWithFrozenManifest)
    } else {
      loadFromDeployment(deployment, template) // loadFromDeployment does its own override internally
    }
    setReady(true)
  }, [resumeChoice]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show draft-resume banner before rendering the editor
  if (resumeChoice === null && editDraft) {
    return (
      <div className="dark fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="border border-white/10 bg-white/5 rounded-2xl p-8 max-w-sm w-full mx-4 space-y-5">
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/5 mx-auto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-400/70">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>

          <div className="text-center space-y-1.5">
            <h2 className="font-serif text-lg text-foreground">In-Progress Edits Found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have unsaved edits for{' '}
              <span className="text-foreground">{deployment.project_name}</span>{' '}
              from {formatRelativeTime(editDraft.updated_at)}.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setResumeChoice(true)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Resume In-Progress Edits
            </button>
            <button
              onClick={() => setResumeChoice(false)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              Start Fresh from Published Version
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Waiting for store to be populated before mounting the editor
  if (!ready) return null

  return <EditorShell />
}
