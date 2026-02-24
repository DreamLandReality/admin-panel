import type { PendingImage } from '@/types'

const CONCURRENCY = 4

/**
 * Upload all pending blob images to R2 in batches.
 * Returns a Map of blobUrl → r2PublicUrl for replacing in data.
 */
export async function uploadPendingImages(
  pendingImages: Record<string, PendingImage>
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>()
  const entries = Object.entries(pendingImages)

  if (entries.length === 0) return urlMap

  const chunks: (typeof entries)[] = []
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    chunks.push(entries.slice(i, i + CONCURRENCY))
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async ([_key, pending]) => {
        const formData = new FormData()
        formData.append('file', pending.file)
        formData.append('objectKey', pending.r2Key)

        const res = await fetch('/api/r2/upload', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Upload failed')
        }

        urlMap.set(pending.blobUrl, data.url)
      })
    )

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[uploadPendingImages] Failed:', r.reason)
      }
    }
  }

  return urlMap
}

/**
 * Deep-walk any data structure and replace blob URL strings
 * with their R2 public URLs using the urlMap.
 */
export function replaceBlobUrls<T>(data: T, urlMap: Map<string, string>): T {
  if (urlMap.size === 0) return data
  if (typeof data === 'string') {
    return (urlMap.get(data) ?? data) as T
  }
  if (Array.isArray(data)) {
    return data.map((item) => replaceBlobUrls(item, urlMap)) as T
  }
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, replaceBlobUrls(v, urlMap)])
    ) as T
  }
  return data
}
