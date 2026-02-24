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
    projectName, draftId, setDraftId, pendingImages,
    sectionData, sectionsRegistry, collectionData, activePage, rawText,
    isViewOnly,
  } = useWizardStore()

  const [saving, setSaving] = useState(false)
  const [showBackModal, setShowBackModal] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)

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

  const handleBack = useCallback(() => {
    if (isViewOnly) {
      router.push('/templates')
      return
    }
    if (isDirty) {
      setShowBackModal(true)
    } else {
      setStep(2)
    }
  }, [isViewOnly, isDirty, setStep, router])

  function handleDiscard() {
    setShowBackModal(false)

    if (!draftId) {
      // Scenario 1: No saved draft — wipe everything and go back to template picker
      useWizardStore.getState().reset()
    } else {
      // Scenario 2: Has a saved draft — discard pending blobs, clear dirty flag, exit editor
      const { blobUrls, pendingImages: pending } = useWizardStore.getState()
      Object.values(blobUrls).forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
      Object.values(pending).forEach(({ blobUrl }) => URL.revokeObjectURL(blobUrl))
      useWizardStore.setState({ isDirty: false, pendingImages: {}, blobUrls: {} })
      setStep(2)
    }
  }

  async function handleSaveDraft() {
    if (saving) return
    setSaving(true)

    try {
      // Upload pending images to R2
      const urlMap = await uploadPendingImages(pendingImages)

      // Replace blob URLs in data
      const finalSectionData = replaceBlobUrls(sectionData, urlMap)
      const finalCollectionData = replaceBlobUrls(collectionData, urlMap)

      // Update store with resolved URLs
      if (urlMap.size > 0) {
        const store = useWizardStore.getState()
        // Update section & collection data with resolved URLs
        useWizardStore.setState({
          sectionData: finalSectionData,
          collectionData: finalCollectionData,
          pendingImages: {},
          blobUrls: {},
        })
        // Clean up — store reference is still valid
        void store
      }

      // Upsert draft
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

  // preview_url is set after deployment; fall back to config.previewUrl (stored in template config)
  // so the editor works for templates that haven't been deployed yet or whose preview_url is stale.
  const previewUrl = selectedTemplate?.preview_url ?? selectedTemplate?.config?.previewUrl ?? ''

  return (
    <div className="dark fixed inset-0 bg-background flex flex-col z-50">
      {/* ── Top Toolbar ── */}
      <div className="h-14 border-b border-white/10 flex items-center px-4 flex-shrink-0 gap-4">
        {/* Left — Back + template name */}
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
            {selectedTemplate?.name ?? ''}
          </span>
        </div>

        {/* Center — Project name + badge */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <span className="font-serif text-base font-light tracking-wide text-foreground truncate max-w-[260px]">
            {isViewOnly ? (selectedTemplate?.name ?? '') : (projectName || 'New Deployment')}
          </span>
          {!isViewOnly && draftId && !isDirty && (
            <span className="text-label uppercase tracking-label text-emerald-400/80 border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-0.5 rounded flex-shrink-0">
              Saved
            </span>
          )}
        </div>

        {/* Right — Viewport switcher + actions */}
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
              <button
                onClick={() => setShowDeployModal(true)}
                disabled={!isDirty}
                className="px-3.5 py-1.5 rounded-lg text-sm bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Deploy
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — pages / collections navigation */}
        <LeftPanel />

        {panelMode === 'layers' ? (
          <>
            {/* Canvas */}
            <PreviewCanvas templatePreviewUrl={previewUrl} iframeRef={iframeRef} />

            {/* Right panel — hidden in view-only mode */}
            {!isViewOnly && (
              <div className="w-[280px] border-l border-white/10 flex-shrink-0 bg-editor-surface overflow-hidden flex flex-col">
                <RightPanel iframeRef={iframeRef} />
              </div>
            )}
          </>
        ) : (
          /* Full-width collection editor (data mode) */
          <div className="flex-1 border-l border-white/10 bg-editor-surface overflow-y-auto">
            <CollectionEditorPanel />
          </div>
        )}
      </div>

      {/* Back confirmation modal */}
      <ConfirmModal
        open={showBackModal}
        title={draftId ? 'Discard changes?' : 'Discard & leave?'}
        description={
          draftId
            ? 'Your unsaved changes will be discarded and the last saved version will be restored.'
            : 'All your work — including the project name and content — will be lost. This cannot be undone.'
        }
        confirmLabel={draftId ? 'Discard Changes' : 'Discard & Leave'}
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleDiscard}
        onCancel={() => setShowBackModal(false)}
      />

      {/* Deploy confirmation modal */}
      <ConfirmModal
        open={showDeployModal}
        title="Ready to deploy?"
        description="This will save your draft and take you to the deployment step where you can choose a site slug and go live."
        confirmLabel="Continue to Deploy"
        cancelLabel="Not yet"
        variant="default"
        onConfirm={() => {
          setShowDeployModal(false)
          setStep(4)
        }}
        onCancel={() => setShowDeployModal(false)}
      />
    </div>
  )
}
