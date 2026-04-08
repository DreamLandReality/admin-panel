'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useWizardStore } from '@/stores/wizard-store'
import { uploadPendingImages, replaceBlobUrls } from '@/lib/utils/upload-pending-images'
import { extractDraftThumbnail } from '@/lib/utils/draft-thumbnail'
import { Button } from '@/components/ui/button'
import { Spinner, Heading, ButtonGroup } from '@/components/primitives'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { useDeployTransitionStore } from '@/stores/deploy-transition-store'
import { getIframeOrigin } from '@/lib/utils/iframe'
import { PreviewCanvas } from './preview-canvas'
import { RightPanel } from './right-panel'
import { LeftPanel } from './left-panel'
import { CollectionEditorPanel } from './collection-editor-panel'

const VIEWPORT_OPTIONS = [
  { value: 'desktop' as const, label: 'Desktop', icon: 'M3 4h18v12H3zM8 20h8M12 16v4' },
  { value: 'tablet'  as const, label: 'Tablet',  icon: 'M4 4h16v16H4zM10 18h4' },
  { value: 'mobile'  as const, label: 'Mobile',  icon: 'M7 2h10v20H7zM10 18h4' },
]

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
  const isViewOnly = useWizardStore((s) => s.isViewOnly)

  // Actions — stable references, never cause re-renders
  const setViewport = useWizardStore((s) => s.setViewport)
  const setStep = useWizardStore((s) => s.setStep)
  const setDraftId = useWizardStore((s) => s.setDraftId)

  const isEditMode = deploymentId !== null
  const previewUrl = selectedTemplate?.preview_url ?? selectedTemplate?.config?.previewUrl ?? ''

  const [saving, setSaving] = useState(false)
  const [showBackModal, setShowBackModal] = useState(false)

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
      useWizardStore.getState().reset()
      return
    }
    if (isDirty) {
      setShowBackModal(true)
    } else if (isEditMode) {
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
      useWizardStore.getState().reset()
      router.push('/')
    } else if (draftId) {
      useWizardStore.setState({ isDirty: false, pendingImages: {}, blobUrls: {} })
      setStep(2)
    } else {
      useWizardStore.getState().reset()
    }
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
    <div className="dark fixed inset-0 bg-background flex flex-col z-50">
      {/* ── Top Toolbar ── */}
      <div className="h-14 border-b border-white/10 flex items-center px-4 flex-shrink-0 gap-4">
        {/* Left — Back + context label */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M9 11L5 7l4-4" />
            </svg>
            Back
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-xs text-muted-foreground truncate max-w-36">
            {isEditMode ? 'Editing Live Site' : (selectedTemplate?.name ?? '')}
          </span>
        </div>

        {/* Center — Project name + save status badge */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <Heading variant="modal-title" as="span" className="truncate max-w-64 !font-light">
            <span title={isViewOnly ? (selectedTemplate?.name ?? '') : (projectName || 'New Deployment')}>
              {isViewOnly ? (selectedTemplate?.name ?? '') : (projectName || 'New Deployment')}
            </span>
          </Heading>
          {!isViewOnly && (
            saving
              ? <span className="text-label uppercase tracking-label text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1.5">
                  <Spinner size="xs" variant="accent" /> Saving…
                </span>
              : (draftId || isEditMode) && !isDirty
                ? <span className="text-label uppercase tracking-label text-emerald-400/80 border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-0.5 rounded flex-shrink-0">Saved</span>
                : null
          )}
        </div>

        {/* Right — Viewport switcher + action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <ButtonGroup
            size="sm"
            options={VIEWPORT_OPTIONS.map((o) => ({
              value: o.value,
              title: o.label,
              label: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d={o.icon} />
                </svg>
              ),
            }))}
            value={viewport}
            onChange={setViewport}
            className="bg-white/10 rounded-lg p-0.5 gap-1"
          />

          {!isViewOnly && (
            <>
              <div className="w-px h-4 bg-white/10" />

              <Button
                variant={isDirty ? 'amber' : 'secondary'}
                size="sm"
                onClick={handleSave}
                disabled={saving || !isDirty}
              >
                Save
              </Button>

              <Button variant="primary" size="sm" onClick={handleDeployClick} disabled={saving}>
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
    </div>
  )
}
