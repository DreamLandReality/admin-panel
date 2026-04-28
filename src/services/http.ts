import type { Result, ServiceError } from './types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function serviceError(
  message: string,
  options: { code?: string; status?: number; cause?: unknown } = {}
): ServiceError {
  return { message, ...options }
}

export function errorResult<T>(
  message: string,
  options: { code?: string; status?: number; cause?: unknown } = {}
): Result<T> {
  return { ok: false, error: serviceError(message, options) }
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function getResponseError(
  response: Response,
  payload: unknown,
  fallback: string
): ServiceError {
  const message =
    isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : fallback

  const code =
    isRecord(payload) && typeof payload.code === 'string'
      ? payload.code
      : undefined

  return serviceError(message, { code, status: response.status })
}

export function abortErrorResult<T>(): Result<T> {
  return errorResult('Request was cancelled.', { code: 'aborted' })
}

export function toServiceError(error: unknown, fallback: string): ServiceError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return serviceError('Request was cancelled.', { code: 'aborted', cause: error })
  }
  if (error instanceof Error) {
    return serviceError(error.message || fallback, { cause: error })
  }
  return serviceError(fallback, { cause: error })
}
