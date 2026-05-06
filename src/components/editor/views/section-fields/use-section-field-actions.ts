'use client'

import type { RefObject } from 'react'
import { postToIframe } from '@/lib/utils/iframe'
import { slugify } from '@/lib/utils/slugify'
import { replaceBlobUrls } from '@/lib/utils/upload-pending-images'
import { useEditorStore } from '@/stores/editor-store'
import { useWizardStore } from '@/stores/wizard-store'
import { isRecord, type FieldValue } from './section-field-utils'

interface UseSectionFieldActionsOptions {
  sectionId: string
  iframeRef: RefObject<HTMLIFrameElement | null>
}

export function useSectionFieldActions({
  sectionId,
  iframeRef,
}: UseSectionFieldActionsOptions) {
  const sectionData = useEditorStore((state) => state.sectionData)
  const updateField = useEditorStore((state) => state.updateField)
  const updateArrayItemField = useEditorStore((state) => state.updateArrayItemField)
  const setBlobUrl = useEditorStore((state) => state.setBlobUrl)
  const setDataUrl = useEditorStore((state) => state.setDataUrl)
  const addPendingImage = useEditorStore((state) => state.addPendingImage)
  const projectName = useWizardStore((state) => state.projectName)

  function handleFieldChange(field: string, value: FieldValue) {
    updateField(sectionId, field, value)

    let resolved = value
    const dataUrlMap = useEditorStore.getState().dataUrls
    if (Object.keys(dataUrlMap).length > 0) {
      resolved = replaceBlobUrls(value, dataUrlMap)
    }

    const json = typeof resolved === 'string' ? resolved : JSON.stringify(resolved)
    if (json?.includes('blob:')) return

    postToIframe(iframeRef, { type: 'field-update', sectionId, field, value: resolved })
  }

  function handleImageUpload(fieldPath: string, url: string, file?: File) {
    setBlobUrl(`${sectionId}.${fieldPath}`, url)
    if (!file) return

    const slug = slugify(projectName)
    const ext = file.name.split('.').pop() || 'png'
    const r2Key = `sites/${slug}/${sectionId}/${fieldPath}.${ext}`
    addPendingImage(`${sectionId}.${fieldPath}`, { blobUrl: url, file, r2Key })
    readFileAsDataUrl(file, (dataUrl) => setDataUrl(url, dataUrl))
  }

  function handleArrayItemChange(index: number, field: string, value: FieldValue, path?: string) {
    updateArrayItemField(sectionId, index, field, value, path)
  }

  function handleArrayItemImageUpload(
    index: number,
    key: string,
    url: string,
    arrayPath?: string,
    file?: File
  ) {
    setBlobUrl(`${sectionId}.${index}.${key}`, url)
    handleArrayItemChange(index, key, url, arrayPath)
    if (!file) return

    readFileAsDataUrl(file, (dataUrl) => setDataUrl(url, dataUrl))
    const slug = slugify(projectName)
    const ext = file.name.split('.').pop() || 'png'
    const rawData = sectionData[sectionId]
    const arrayItems = arrayPath && isRecord(rawData) ? rawData[arrayPath] : rawData
    const item = Array.isArray(arrayItems) ? arrayItems[index] : undefined
    const itemId = isRecord(item) && typeof item.id === 'string' ? item.id : `item_${index}`
    const r2Key = `sites/${slug}/${sectionId}/${itemId}/${key}.${ext}`
    addPendingImage(`${sectionId}.${index}.${key}`, { blobUrl: url, file, r2Key })
  }

  return {
    handleArrayItemChange,
    handleArrayItemImageUpload,
    handleFieldChange,
    handleImageUpload,
  }
}

function readFileAsDataUrl(file: File, onLoad: (dataUrl: string) => void) {
  const reader = new FileReader()
  reader.onload = () => onLoad(reader.result as string)
  reader.readAsDataURL(file)
}
