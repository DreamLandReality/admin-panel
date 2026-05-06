import { isSignedUrlResult, isUploadImageResult } from '@/lib/api/contracts'
import type { ImageService } from './types'
import { apiJsonRequest } from './api-client'
import { errorResult } from './http'

export const imageService: ImageService = {
  async upload(input, options) {
    const formData = new FormData()
    formData.append('file', input.file)
    formData.append('objectKey', input.objectKey)

    const result = await apiJsonRequest('/api/r2/upload', {
      method: 'POST',
      signal: options?.signal,
      body: formData,
      fallback: 'Image upload failed.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isUploadImageResult(payload)) {
      return errorResult('Image upload response was invalid.')
    }

    return { ok: true, data: payload }
  },

  async getSignedUrl(key, options) {
    const result = await apiJsonRequest('/api/r2/signed-url', {
      method: 'POST',
      signal: options?.signal,
      fallback: 'Failed to load image URL.',
      json: {
        objectKey: key,
        ...(options?.expiresIn ? { expiresIn: options.expiresIn } : {}),
        ...(options?.bucket ? { bucket: options.bucket } : {}),
      },
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isSignedUrlResult(payload)) {
      return errorResult('Signed URL response was invalid.')
    }

    return { ok: true, data: { url: payload.url } }
  },
}
