'use client'

import { useWizardStore } from '@/stores/wizard-store'
import { postToIframe } from '@/lib/utils/iframe'
import { useImageUpload } from '@/hooks/use-image-upload'
import { slugify } from '@/lib/utils/slugify'
import { Breadcrumb, PanelInput } from '../panel-inputs'

// ─── ImageReplaceView ─────────────────────────────────────────────────────────

export function ImageReplaceView({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const { selection, clearSelection, sectionData, updateField, setBlobUrl, setDataUrl, addPendingImage, projectName } = useWizardStore()
  const { sectionId, field, content } = selection

  const { fileInputRef, triggerUpload, handleFileChange } = useImageUpload(
    (blobUrl, file) => {
      if (!sectionId || !field) return
      setBlobUrl(`${sectionId}.${field}`, blobUrl)
      updateField(sectionId, field, blobUrl)
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
