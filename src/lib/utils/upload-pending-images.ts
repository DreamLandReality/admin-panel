import type { PendingImage } from '@/types'
import { fetchWithTimeout } from './fetch-with-timeout'

const CONCURRENCY = 4

export interface UploadResult {
  /** Map of blobUrl → R2 public URL for all successful uploads */
  urlMap: Map<string, string>
  /** blobUrls that failed to upload — callers should abort deploy if non-empty */
  failed: string[]
}

/**
 * Upload all pending blob images to R2 in batches of CONCURRENCY.
 * Returns a result object with the URL map and any failed blobUrls so callers
 * can decide whether to abort or warn based on the failures.
 */
export async function uploadPendingImages(
  pendingImages: Record<string, PendingImage>
): Promise<UploadResult> {
  const urlMap = new Map<string, string>()
  const failed: string[] = []
  const entries = Object.entries(pendingImages)

  if (entries.length === 0) return { urlMap, failed }

  const chunks: (typeof entries)[] = []
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    chunks.push(entries.slice(i, i + CONCURRENCY))
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async ([, pending]) => {
        const formData = new FormData()
        formData.append('file', pending.file)
        formData.append('objectKey', pending.r2Key)

        const res = await fetchWithTimeout('/api/r2/upload', { method: 'POST', body: formData }, 60_000)
        const data = await res.json()

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Upload failed')
        }

        urlMap.set(pending.blobUrl, data.url)
        return pending.blobUrl
      })
    )

    chunk.forEach(([, pending], i) => {
      const r = results[i]
      if (r.status === 'rejected') {
        console.error('[uploadPendingImages] Failed to upload:', pending.r2Key, r.reason)
        failed.push(pending.blobUrl)
      }
    })
  }

  return { urlMap, failed }
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
