'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { uploadPendingImages, replaceBlobUrls } from '@/lib/utils/upload-pending-images'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { PreviewCanvas } from './preview-canvas'
import { RightPanel } from './right-panel'
import { LeftPanel } from './left-panel'
import { CollectionEditorPanel } from './collection-editor-panel'

const VIEWPORT_OPTIONS = [
  {
    value: 'desktop' as const,
    label: 'Desktop',
    icon: 'M3 4h18v12H3zM8 20h8M12 16v4',
  },
  {
    value: 'tablet' as const,
    label: 'Tablet',
    icon: 'M4 4h16v16H4zM10 18h4',
  },
  {
    value: 'mobile' as const,
    label: 'Mobile',
    icon: 'M7 2h10v20H7zM10 18h4',
  },
]

export function EditorShell() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const router = useRouter()
  const {
    selectedTemplate, isDirty, viewport, setViewport, setStep, panelMode,
    projectName, draftId, setDraftId, deploymentId, pendingImages,
    sectionData, sectionsRegistry, collectionData, activePage, rawText,
    isViewOnly,
  } = useWizardStore()

  const isEditMode = deploymentId !== null

  const [saving, setSaving] = useState(false)
  const [showBackModal, setShowBackModal] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)

  // Revoke all blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      const { blobUrls } = useWizardStore.getState()
      Object.values(blobUrls).forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
    }
  }, [])

  // Warn about unsaved changes on tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── Back navigation ────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (isViewOnly) {
      useWizardStore.getState().reset()
      return
    }
    if (isDirty) {
      setShowBackModal(true)
    } else if (isEditMode) {
      // Edit mode: reset store and go back to dashboard
      useWizardStore.getState().reset()
      router.push('/')
    } else {
      setStep(2)
    }
  }, [isViewOnly, isDirty, isEditMode, setStep, router])

  function handleDiscard() {
    setShowBackModal(false)
    const { blobUrls, pendingImages: pending } = useWizardStore.getState()
    Object.values(blobUrls).forEach((url) => {
      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
    })
    Object.values(pending).forEach(({ blobUrl }) => URL.revokeObjectURL(blobUrl))

    if (isEditMode) {
      // Edit mode: drop local edits, go back to dashboard
      useWizardStore.getState().reset()
      router.push('/')
    } else if (draftId) {
      // New-site draft saved: discard pending blobs, clear dirty, back to step 2
      useWizardStore.setState({ isDirty: false, pendingImages: {}, blobUrls: {} })
      setStep(2)
    } else {
      // No draft: wipe everything
      useWizardStore.getState().reset()
    }
  }

  // ── Shared upload helper ───────────────────────────────────────────────────

  async function uploadAndResolve() {
    const urlMap = await uploadPendingImages(pendingImages)
    const finalSectionData = replaceBlobUrls(sectionData, urlMap)
    const finalCollectionData = replaceBlobUrls(collectionData, urlMap)
    if (urlMap.size > 0) {
      useWizardStore.setState({
        sectionData: finalSectionData,
        collectionData: finalCollectionData,
        pendingImages: {},
        blobUrls: {},
      })
    }
    return { finalSectionData, finalCollectionData }
  }

  // ── Save Draft (both modes) ────────────────────────────────────────────────
  // New-site:  upserts by (user_id, project_name)     — no deployment_id
  // Edit-site: SELECT-first logic in the API          — deployment_id included

  async function handleSaveDraft() {
    if (saving) return
    setSaving(true)
    try {
      const { finalSectionData, finalCollectionData } = await uploadAndResolve()

      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: isEditMode ? null : projectName,
          template_slug: selectedTemplate?.slug ?? '',
          template_id: selectedTemplate?.id ?? null,
          current_step: 3,
          raw_text: rawText,
          section_data: finalSectionData,
          sections_registry: sectionsRegistry,
          collection_data: finalCollectionData,
          last_active_page: activePage,
          ...(isEditMode ? { deployment_id: deploymentId } : {}),
        }),
      })

      const data = await res.json()
      if (res.ok && data.data?.id) {
        setDraftId(data.data.id)
        useWizardStore.setState({ isDirty: false })
      }
    } catch (err) {
      console.error('[SaveDraft] Failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Save Changes (edit mode only) ──────────────────────────────────────────
  // Persists the current editor state back to the deployment's site_data
  // and sets has_unpublished_changes = true. Does NOT trigger a redeploy.

  async function handleSaveChanges() {
    if (saving || !deploymentId) return
    setSaving(true)
    try {
      const { finalSectionData, finalCollectionData } = await uploadAndResolve()

      const site_data = {
        _sections: sectionsRegistry,
        ...finalSectionData,
        // collectionData is not stored in site_data (managed in template manifest)
        // but include it if the template uses it
        ...(Object.keys(finalCollectionData).length > 0
          ? { _collections: finalCollectionData }
          : {}),
      }

      const res = await fetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_data, action: 'save' }),
      })

      if (res.ok) {
        useWizardStore.setState({ isDirty: false })
      }
    } catch (err) {
      console.error('[SaveChanges] Failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // preview_url is set after deployment; fall back to config.previewUrl so the editor
  // works for templates that haven't been deployed yet or whose preview_url is stale.
  const previewUrl = selectedTemplate?.preview_url ?? selectedTemplate?.config?.previewUrl ?? ''

  return (
    <div className="dark fixed inset-0 bg-background flex flex-col z-50">
      {/* ── Top Toolbar ── */}
      <div className="h-14 border-b border-white/10 flex items-center px-4 flex-shrink-0 gap-4">
        {/* Left — Back + context label */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M9 11L5 7l4-4" />
            </svg>
            Back
          </button>

          <div className="w-px h-4 bg-white/10" />

          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {isEditMode ? 'Editing Live Site' : (selectedTemplate?.name ?? '')}
          </span>
        </div>

        {/* Center — Project name + saved badge */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <span className="font-serif text-base font-light tracking-wide text-foreground truncate max-w-[260px]">
            {isViewOnly ? (selectedTemplate?.name ?? '') : (projectName || 'New Deployment')}
          </span>
          {!isViewOnly && (draftId || isEditMode) && !isDirty && (
            <span className="text-label uppercase tracking-label text-emerald-400/80 border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-0.5 rounded flex-shrink-0">
              Saved
            </span>
          )}
        </div>

        {/* Right — Viewport switcher + action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Viewport switcher */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            {VIEWPORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setViewport(opt.value)}
                title={opt.label}
                className={cn(
                  'w-8 h-7 rounded flex items-center justify-center transition-colors',
                  viewport === opt.value
                    ? 'bg-white/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d={opt.icon} />
                </svg>
              </button>
            ))}
          </div>

          {!isViewOnly && (
            <>
              <div className="w-px h-4 bg-white/10" />

              {/* Save Draft — works in both new-site and edit-site mode */}
              <button
                onClick={handleSaveDraft}
                disabled={saving || !isDirty}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:pointer-events-none',
                  isDirty
                    ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'
                    : 'border border-white/10 text-foreground hover:bg-white/5'
                )}
              >
                {saving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-300 rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Draft'
                )}
              </button>

              {isEditMode ? (
                /* Edit mode: Save Changes persists to the deployment record */
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg text-sm bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Save Changes
                </button>
              ) : (
                /* New-site mode: Deploy (coming soon) */
                <button
                  onClick={() => setShowComingSoon(true)}
                  className="px-3.5 py-1.5 rounded-lg text-sm bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
                >
                  Deploy
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />

        {panelMode === 'layers' ? (
          <>
            <PreviewCanvas templatePreviewUrl={previewUrl} iframeRef={iframeRef} />
            {!isViewOnly && (
              <div className="w-[280px] border-l border-white/10 flex-shrink-0 bg-editor-surface overflow-hidden flex flex-col">
                <RightPanel iframeRef={iframeRef} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 border-l border-white/10 bg-editor-surface overflow-y-auto">
            <CollectionEditorPanel />
          </div>
        )}
      </div>

      {/* Back confirmation modal */}
      <ConfirmModal
        open={showBackModal}
        title={isEditMode ? 'Leave editor?' : (draftId ? 'Discard changes?' : 'Discard & leave?')}
        description={
          isEditMode
            ? 'Any unsaved changes will be lost. Your last saved version will be preserved.'
            : draftId
            ? 'Your unsaved changes will be discarded and the last saved version will be restored.'
            : 'All your work — including the project name and content — will be lost. This cannot be undone.'
        }
        confirmLabel={isEditMode ? 'Leave' : (draftId ? 'Discard Changes' : 'Discard & Leave')}
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleDiscard}
        onCancel={() => setShowBackModal(false)}
      />

      {/* Deploy — coming soon overlay (new-site mode only) */}
      {showComingSoon && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-editor-surface border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1.5">Deployment Coming Soon</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The deployment feature is currently under development. Your draft is saved and will be ready to publish when this feature launches.
              </p>
            </div>
            <button
              onClick={() => setShowComingSoon(false)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium border border-white/10 text-foreground hover:bg-white/5 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
