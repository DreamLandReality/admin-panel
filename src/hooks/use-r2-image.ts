/**
 * React Hook: useR2Image
 *
 * Fetches a signed URL for displaying R2 images in the admin panel
 *
 * Usage:
 *   const { imageUrl, loading, error } = useR2Image('screenshots/minimal-luxury/preview.png')
 */

import { useState, useEffect } from 'react'

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
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reset state if no objectKey
    if (!objectKey) {
      setImageUrl(null)
      setLoading(false)
      setError(null)
      return
    }

    // If objectKey is already a full URL (http/https), use it directly
    if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
      setImageUrl(objectKey)
      setLoading(false)
      setError(null)
      return
    }

    // Otherwise, fetch signed URL from API
    let isCancelled = false

    async function fetchSignedUrl() {
      setLoading(true)
      setError(null)

      if (process.env.NODE_ENV === 'development') {
        console.log('[R2Image] Fetching signed URL for:', objectKey)
      }

      try {
        const response = await fetch('/api/r2/signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            objectKey,
            expiresIn,
            ...(bucket ? { bucket } : {})
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch signed URL: ${response.statusText}`)
        }

        const data = await response.json()

        if (!isCancelled) {
          if (data.error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[R2Image] Error:', data.error)
            }
            setError(data.error)
            setImageUrl(null)
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('[R2Image] Signed URL generated successfully')
            }
            setImageUrl(data.url)
            setError(null)
          }
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          if (process.env.NODE_ENV === 'development') {
            console.error('[R2Image] Fetch error:', errorMessage)
          }
          setError(errorMessage)
          setImageUrl(null)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchSignedUrl()

    // Cleanup function
    return () => {
      isCancelled = true
    }
  }, [objectKey, expiresIn, bucket])

  return { imageUrl, loading, error }
}
