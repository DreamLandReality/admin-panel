import { useRef, useCallback } from 'react'

interface UseImageUploadReturn {
  fileInputRef: React.RefObject<HTMLInputElement>
  triggerUpload: () => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Captures an image file locally as a blob URL (no R2 upload).
 * The caller is responsible for storing the File for deferred upload via `onFileCapture`.
 */
export function useImageUpload(
  onSuccess: (blobUrl: string, file: File) => void,
  onFileCapture?: (file: File, blobUrl: string) => void
): UseImageUploadReturn {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const blobUrl = URL.createObjectURL(file)
    onFileCapture?.(file, blobUrl)
    onSuccess(blobUrl, file)
  }, [onSuccess, onFileCapture])

  return { fileInputRef, triggerUpload, handleFileChange }
}
