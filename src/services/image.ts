import type { ImageService, UploadImageResult } from './types'
import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'

function isUploadImageResult(value: unknown): value is UploadImageResult {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.key === 'string'
  )
}

export const imageService: ImageService = {
  async upload(input, options) {
    try {
      const formData = new FormData()
      formData.append('file', input.file)
      formData.append('objectKey', input.objectKey)

      const response = await fetch('/api/r2/upload', {
        method: 'POST',
        signal: options?.signal,
        body: formData,
      })
      const payload = await readJson(response)

      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Image upload failed.') }
      }
      if (!isUploadImageResult(payload)) {
        return errorResult('Image upload response was invalid.')
      }

      return { ok: true, data: payload }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Image upload failed.') }
    }
  },

  async getSignedUrl(key, options) {
    try {
      const response = await fetch('/api/r2/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify({
          objectKey: key,
          ...(options?.expiresIn ? { expiresIn: options.expiresIn } : {}),
          ...(options?.bucket ? { bucket: options.bucket } : {}),
        }),
      })
      const payload = await readJson(response)

      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to load image URL.') }
      }
      if (!isRecord(payload) || typeof payload.url !== 'string') {
        return errorResult('Signed URL response was invalid.')
      }

      return { ok: true, data: { url: payload.url } }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to load image URL.') }
    }
  },
}
