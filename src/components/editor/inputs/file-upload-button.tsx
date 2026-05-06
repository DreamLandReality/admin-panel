'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AdminEyeIcon,
  FileIcon,
  FileTextIcon,
  UploadIcon,
  VideoIcon,
} from '@/components/icons'

function matchesAccept(file: File, accept: string): boolean {
  return accept.split(',').map(s => s.trim()).some(token => {
    if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -1))
    return file.type === token
  })
}

export function FileUploadButton({
  accept,
  currentUrl,
  onSelect,
}: {
  accept?: string
  currentUrl?: string
  onSelect: (url: string, file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pickedName, setPickedName] = useState<string | null>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [currentBlobUrl])

  const urlName = currentUrl && !currentUrl.startsWith('blob:')
    ? decodeURIComponent(currentUrl.split('/').pop()?.split('?')[0] ?? '')
    : null
  const filename = pickedName ?? urlName ?? null
  const hasFile = !!(currentUrl || filename)
  const isPdf = accept?.includes('pdf') || filename?.toLowerCase().endsWith('.pdf')
  const isVideo = accept?.startsWith('video') || !!filename?.toLowerCase().match(/\.(mp4|webm|mov)$/)

  return (
    <div>
      {hasFile && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-surface-hover border border-border-subtle mb-2">
          {isPdf ? (
            <FileTextIcon width={14} height={14} strokeWidth={1.5} className="text-error shrink-0" />
          ) : isVideo ? (
            <VideoIcon width={14} height={14} strokeWidth={1.5} className="text-info shrink-0" />
          ) : (
            <FileIcon width={14} height={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          )}
          <span className="text-xs text-muted-foreground truncate flex-1">
            {filename ?? 'Uploaded file'}
          </span>
          {currentUrl && (isPdf || isVideo) && (
            <button
              onClick={() => window.open(currentUrl, '_blank')}
              title="Preview"
              className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
            >
              <AdminEyeIcon width={13} height={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
      {typeError && (
        <p className="text-[10px] text-error mb-1.5">{typeError}</p>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
      >
        <UploadIcon width={12} height={12} strokeWidth={1.4} />
        {hasFile ? 'Replace File' : 'Upload File'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          e.target.value = ''
          if (accept && !matchesAccept(file, accept)) {
            setTypeError(`Invalid file type. Expected: ${accept}`)
            return
          }
          setTypeError(null)
          setPickedName(file.name)

          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
          }

          const blobUrl = URL.createObjectURL(file)
          setCurrentBlobUrl(blobUrl)
          onSelect(blobUrl, file)
        }}
      />
    </div>
  )
}
