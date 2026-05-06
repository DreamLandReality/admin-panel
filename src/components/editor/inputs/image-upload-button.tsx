'use client'

import { useEffect, useRef, useState } from 'react'
import { UploadIcon } from '@/components/icons'

export function ImageUploadButton({ onSelect }: { onSelect: (url: string, file?: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [currentBlobUrl])

  return (
    <>
      {typeError && (
        <p className="text-[10px] text-error mb-1.5">{typeError}</p>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
      >
        <UploadIcon width={12} height={12} strokeWidth={1.4} />
        Replace Image
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          e.target.value = ''
          if (!file.type.startsWith('image/')) {
            setTypeError('Only image files are allowed')
            return
          }
          setTypeError(null)

          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
          }

          const blobUrl = URL.createObjectURL(file)
          setCurrentBlobUrl(blobUrl)
          onSelect(blobUrl, file)
        }}
      />
    </>
  )
}
