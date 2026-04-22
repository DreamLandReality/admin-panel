'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useWizardStore } from '@/stores/wizard-store'
import { uploadPendingImages, replaceBlobUrls } from '@/lib/utils/upload-pending-images'
import { extractDraftThumbnail } from '@/lib/utils/draft-thumbnail'
import { Button } from '@/components/ui/button'
import { Spinner, Heading } from '@/components/primitives'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { DeleteSiteAction } from '@/components/shared/delete-site-action'
import { useDeployTransitionStore } from '@/stores/deploy-transition-store'
import { getIframeOrigin } from '@/lib/utils/iframe'
import { PreviewCanvas } from './preview-canvas'
import { RightPanel } from './right-panel'
import { LeftPanel } from './left-panel'
import { CollectionEditorPanel } from './collection-editor-panel'
import { ViewportSwitcher } from './viewport-switcher'

export function EditorShell() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const router = useRouter()

  // ── Zustand selectors: subscribe only to the fields each render path needs ──
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const isDirty = useWizardStore((s) => s.isDirty)
  const viewport = useWizardStore((s) => s.viewport)
  const panelMode = useWizardStore((s) => s.panelMode)
  const projectName = useWizardStore((s) => s.projectName)
  const draftId = useWizardStore((s) => s.draftId)
  const deploymentId = useWizardStore((s) => s.deploymentId)
  const deploymentStatus = useWizardStore((s) => s.deploymentStatus)
  const isViewOnly = useWizardStore((s) => s.isViewOnly)

  // Actions — stable references, never cause re-renders
  const setViewport = useWizardStore((s) => s.setViewport)
  const setStep = useWizardStore((s) => s.setStep)
  const setDraftId = useWizardStore((s) => s.setDraftId)

  const isEditMode = deploymentId !== null
  const previewUrl = selectedTemplate?.preview_url ?? selectedTemplate?.config?.previewUrl ?? ''

  const [saving, setSaving] = useState(false)
  const [showBackModal, setShowBackModal] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

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

  // ── Back navigation ──────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (isViewOnly) {
      setIsExiting(true)
      useWizardStore.getState().reset()
      return
    }
    if (isDirty) {
      setShowBackModal(true)
    } else if (isEditMode) {
      setIsExiting(true)
      // Delay navigation to prevent flash
      requestAnimationFrame(() => {
        useWizardStore.getState().reset()
        router.push('/')
      })
    } else {
      setStep(2)
    }
  }, [isViewOnly, isDirty, isEditMode, setStep, router])

  function handleDiscard() {
    setShowBackModal(false)
    setIsExiting(true)
    const { blobUrls, pendingImages: pending } = useWizardStore.getState()
    Object.values(blobUrls).forEach((url) => {
      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
    })
    Object.values(pending).forEach(({ blobUrl }) => URL.revokeObjectURL(blobUrl))

    // Delay navigation to prevent flash
    requestAnimationFrame(() => {
      if (isEditMode) {
        useWizardStore.getState().reset()
        router.push('/')
      } else if (draftId) {
        useWizardStore.setState({ isDirty: false, pendingImages: {}, blobUrls: {} })
        setStep(2)
      } else {
        useWizardStore.getState().reset()
      }
    })
  }

  // ── Shared upload helper ─────────────────────────────────────────────────────

  async function uploadAndResolve() {
    const store = useWizardStore.getState()
    const { urlMap, failed } = await uploadPendingImages(store.pendingImages)
    if (failed.length > 0) {
      console.warn(`[editor] ${failed.length} image(s) failed to upload — draft may be missing images.`)
    }
    const finalSectionData = replaceBlobUrls(store.sectionData, urlMap)
    const finalCollectionData = replaceBlobUrls(store.collectionData, urlMap)
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

  // ── Save Draft ────────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (saving) return
    setSaving(true)
    try {
      const { finalSectionData, finalCollectionData } = await uploadAndResolve()
      const screenshot_url =
        extractDraftThumbnail(finalSectionData) ??
        selectedTemplate?.preview_url ??
        selectedTemplate?.config?.previewUrl ??
        null
      const { rawText, sectionsRegistry, activePage } = useWizardStore.getState()
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          template_slug: selectedTemplate?.slug ?? '',
          template_id: selectedTemplate?.id ?? null,
          current_step: 3,
          raw_text: rawText,
          section_data: finalSectionData,
          sections_registry: sectionsRegistry,
          collection_data: finalCollectionData,
          last_active_page: activePage,
          screenshot_url,
        }),
      })
      const data = await res.json()
      if (res.ok && data.data?.id) {
        setDraftId(data.data.id)
        useWizardStore.setState({ isDirty: false })
        toast.success('Draft saved')
        // Fire-and-forget: generate real content screenshot async (non-blocking)
        void fetch('/api/screenshot/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft_id: data.data.id }),
        }).catch(() => { /* non-fatal */ })
      } else {
        toast.error(data?.error ?? 'Draft save failed. Please try again.')
      }
    } catch (err: any) {
      console.error('[SaveDraft] Failed:', err)
      toast.error(err?.message ?? 'Draft save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save Changes (edit mode only) ─────────────────────────────────────────────

  async function handleSaveChanges() {
    if (saving || !deploymentId) return
    setSaving(true)
    try {
      const { finalSectionData, finalCollectionData } = await uploadAndResolve()
      const site_data = {
        _sections: useWizardStore.getState().sectionsRegistry,
        ...finalSectionData,
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
        toast.success('Changes saved')
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData?.error ?? 'Failed to save changes.')
      }
    } catch (err: any) {
      console.error('[SaveChanges] Failed:', err)
      toast.error(err?.message ?? 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save (routes to draft or deployment based on mode) ───────────────────────

  async function handleSave() {
    if (isEditMode) {
      await handleSaveChanges()
    } else {
      await handleSaveDraft()
    }
  }

  // ── Navigate to deploy page ───────────────────────────────────────────────────

  async function handleDeployClick() {
    if (isEditMode && isDirty) {
      await handleSaveChanges()
    }
    useDeployTransitionStore.getState().setTransitioning(true)
    // Double rAF: first frame renders the overlay, second frame ensures it is
    // composited/painted before we navigate and unmount the dashboard layout.
    requestAnimationFrame(() => requestAnimationFrame(() => router.push('/deploy')))
  }

  return (
    <>
      <div className="dark fixed inset-0 bg-background flex flex-col z-50">
        {/* Exit overlay to prevent flash */}
        {isExiting && (
          <div className="absolute inset-0 bg-background z-[60] animate-fade-in" />
        )}
        
      {/* ── Top Toolbar ── */}
      <div className="h-14 border-b border-border bg-editor-bg/50 backdrop-blur-sm flex items-center px-6 flex-shrink-0 gap-6">
        {/* Left — Back + context label */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2 hover:bg-white/5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 11L5 7l4-4" />
            </svg>
            Back
          </Button>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
            <span className="text-xs font-medium text-muted-foreground truncate max-w-40">
              {isEditMode ? 'Live Site' : (selectedTemplate?.name ?? '')}
            </span>
          </div>
        </div>

        {/* Center — Project name + save status badge + viewport switcher */}
        <div className="flex-1 flex items-center justify-center gap-2.5 min-w-0">
          <Heading variant="modal-title" as="span" className="truncate max-w-80 !font-medium">
            <span title={isViewOnly ? (selectedTemplate?.name ?? '') : (projectName || 'Untitled Project')}>
              {isViewOnly ? (selectedTemplate?.name ?? '') : (projectName || 'Untitled Project')}
            </span>
          </Heading>
          {!isViewOnly && (
            saving
              ? <span className="text-label uppercase tracking-label text-amber-400/90 border border-amber-400/30 bg-amber-400/10 px-2 py-1 rounded-md flex-shrink-0 flex items-center gap-1.5 shadow-sm">
                  <Spinner size="xs" variant="accent" /> Saving
                </span>
              : (draftId || isEditMode) && !isDirty
                ? <span className="text-label uppercase tracking-label text-emerald-400/90 border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 rounded-md flex-shrink-0 shadow-sm">Saved</span>
                : isDirty
                  ? <span className="text-label uppercase tracking-label text-muted-foreground/60 border border-border bg-white/5 px-2 py-1 rounded-md flex-shrink-0">Unsaved</span>
                  : null
          )}
          <ViewportSwitcher iconSize={15} />
        </div>

        {/* Right — action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {!isViewOnly && (
            <>
              <Button
                variant={isDirty ? 'amber' : 'secondary'}
                size="sm"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="min-w-20"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>

              {isEditMode && deploymentStatus === 'live' && (
                <DeleteSiteAction
                  deploymentId={deploymentId}
                  projectName={projectName}
                  description={`"${projectName}" will be taken offline and removed from your dashboard. This cannot be undone.`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:text-red-400 hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors"
                  onDeleted={() => {
                    useWizardStore.getState().reset()
                    router.push('/')
                  }}
                />
              )}

              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleDeployClick} 
                disabled={saving}
                className="min-w-20"
              >
                {isEditMode ? 'Publish' : 'Deploy'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel iframeRef={iframeRef} />

        {panelMode === 'layers' ? (
          <>
            <PreviewCanvas templatePreviewUrl={previewUrl} iframeRef={iframeRef} />
            {!isViewOnly && (
              <div className="w-70 border-l border-white/10 flex-shrink-0 bg-editor-surface overflow-hidden flex flex-col">
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
  </>
)
}
