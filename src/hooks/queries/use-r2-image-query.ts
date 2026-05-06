'use client'

import { useQuery } from '@tanstack/react-query'
import { imageService } from '@/services/image'
import { unwrapResult } from './utils'

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

export function useR2ImageQuery(objectKey: string | null | undefined, expiresIn = 3600, bucket?: string) {
  const shouldFetch = !!objectKey && !isAbsoluteUrl(objectKey)

  return useQuery({
    queryKey: ['r2-image', objectKey, expiresIn, bucket],
    queryFn: ({ signal }) =>
      unwrapResult(imageService.getSignedUrl(objectKey ?? '', { signal, expiresIn, ...(bucket ? { bucket } : {}) })),
    enabled: shouldFetch,
  })
}
