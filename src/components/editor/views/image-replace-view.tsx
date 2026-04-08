'use client'

import { useWizardStore } from '@/stores/wizard-store'
import { buildPageList } from '@/lib/utils/page-list'
import { postToIframe } from '@/lib/utils/iframe'
import { useImageUpload } from '@/hooks/use-image-upload'
import { slugify } from '@/lib/utils/slugify'
import { Breadcrumb, PanelInput } from '../panel-inputs'

// ─── ImageReplaceView ─────────────────────────────────────────────────────────

export function ImageReplaceView({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  // ── Zustand selectors ──
  const selection = useWizardStore((s) => s.selection)
  const sectionData = useWizardStore((s) => s.sectionData)
  const collectionData = useWizardStore((s) => s.collectionData)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const activePage = useWizardStore((s) => s.activePage)
  const projectName = useWizardStore((s) => s.projectName)
  const clearSelection = useWizardStore((s) => s.clearSelection)
  const updateField = useWizardStore((s) => s.updateField)
  const updateCollectionItem = useWizardStore((s) => s.updateCollectionItem)
  const updateArrayItemField = useWizardStore((s) => s.updateArrayItemField)
  const setBlobUrl = useWizardStore((s) => s.setBlobUrl)
  const setDataUrl = useWizardStore((s) => s.setDataUrl)
  const addPendingImage = useWizardStore((s) => s.addPendingImage)
  const { sectionId, field, content } = selection

  const { fileInputRef, triggerUpload, handleFileChange } = useImageUpload(
    (blobUrl, file) => {
      if (!sectionId || !field) return
      setBlobUrl(`${sectionId}.${field}`, blobUrl)

      // For detail: sections, update the underlying collection/section item.
      // sendFullUpdate reads from there (collectionData/sectionData items), NOT from
      // sectionData["detail:core"] which is a dead slot — writing there would cause
      // sendFullUpdate to overwrite the correct image with old data when dataUrls changes.
      if (sectionId.startsWith('detail:')) {
        const manifest = selectedTemplate?.manifest
        const pageList = buildPageList(manifest, sectionData, collectionData)
        const activeEntry = pageList.find((p) => p.id === activePage)
        const dynDef = manifest?.pages?.find(
          (p: any) => p.dynamic && (p.id === activeEntry?.dynamicPageId || p.sourceSection === activeEntry?.sourceSection)
        )
        if (dynDef) {
          const slugField = dynDef.slugField ?? 'slug'
          if (dynDef.sourceCollection && collectionData[dynDef.sourceCollection]) {
            const items = collectionData[dynDef.sourceCollection]
            const item = items.find((i: any) => i[slugField] === activePage)
            if (item?.id) updateCollectionItem(dynDef.sourceCollection, item.id, field, blobUrl)
          } else if (dynDef.sourceSection) {
            const rawData = sectionData[dynDef.sourceSection]
            const itemsPath = dynDef.itemsPath
            const items = (itemsPath && rawData && !Array.isArray(rawData)
              ? (rawData as any)[itemsPath]
              : rawData ?? []) as any[]
            const idx = Array.isArray(items) ? items.findIndex((i: any) => i[slugField] === activePage) : -1
            if (idx >= 0) updateArrayItemField(dynDef.sourceSection, idx, field, blobUrl, dynDef.itemsPath)
          }
        }
      } else {
        updateField(sectionId, field, blobUrl)
      }

      // Blob URLs are origin-bound and won't load in a cross-origin iframe.
      // Convert to a data URL (base64), store it so sendFullUpdate substitutes it too.
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setDataUrl(blobUrl, dataUrl)
        postToIframe(iframeRef, { type: 'field-update', sectionId, field, value: dataUrl })
      }
      reader.readAsDataURL(file)
    },
    (file, blobUrl) => {
      if (!sectionId || !field) return
      const slug = slugify(projectName)
      const ext = file.name.split('.').pop() || 'png'
      const r2Key = `sites/${slug}/${sectionId}/${field}.${ext}`
      addPendingImage(`${sectionId}.${field}`, { blobUrl, file, r2Key })
    }
  )

  if (!sectionId || !field) return null

  const altField = field.replace(/Url$/, 'Alt').replace(/Image$/, 'Alt')
  const currentAlt = (sectionData[sectionId]?.[altField] as string) ?? ''

  return (
    <div>
      <Breadcrumb label={field} onBack={clearSelection} />
      <div className="px-4 space-y-4 pb-4">
        {/* Thumbnail */}
        {content && (
          <div className="aspect-video rounded-lg overflow-hidden bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Replace button */}
        <button
          onClick={triggerUpload}
          className="w-full py-2.5 rounded-lg text-sm bg-white/5 text-foreground hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M7 2v10M2 7l5-5 5 5" />
          </svg>
          Replace Image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {/* Alt text */}
        <PanelInput
          label="Alt text"
          value={currentAlt}
          placeholder="Describe the image..."
          onChange={(v) => {
            updateField(sectionId!, altField, v)
            postToIframe(iframeRef, { type: 'field-update', sectionId, field: altField, value: v })
          }}
        />
      </div>
    </div>
  )
}
