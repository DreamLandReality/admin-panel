/**
 * React Hook: useR2Image
 *
 * Fetches a signed URL for displaying R2 images in the admin panel
 *
 * Usage:
 *   const { imageUrl, loading, error } = useR2Image('screenshots/minimal-luxury/preview.png')
 */

import { useR2ImageQuery } from '@/hooks/queries/use-r2-image-query'

interface UseR2ImageReturn {
  imageUrl: string | null
  loading: boolean
  error: string | null
}

export function useR2Image(
  objectKey: string | null | undefined,
  expiresIn: number = 3600,
  bucket?: string
): UseR2ImageReturn {
  const signedUrlQuery = useR2ImageQuery(objectKey, expiresIn, bucket)

  if (!objectKey) {
    return { imageUrl: null, loading: false, error: null }
  }

  if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
    return { imageUrl: objectKey, loading: false, error: null }
  }

  return {
    imageUrl: signedUrlQuery.data?.url ?? null,
    loading: signedUrlQuery.isPending,
    error: signedUrlQuery.error?.message ?? null,
  }
}
