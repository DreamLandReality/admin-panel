import type { Result, ServiceRequestOptions } from './types'
import { getResponseError, readJson, toServiceError } from './http'

type ApiRequestOptions = ServiceRequestOptions & {
  method?: string
  headers?: HeadersInit
  json?: unknown
  body?: BodyInit | null
  fallback: string
}

function buildRequestInit(options: ApiRequestOptions): RequestInit {
  const headers = new Headers(options.headers)
  const hasJson = options.json !== undefined
  const hasBody = options.body !== undefined
  const body = hasJson ? JSON.stringify(options.json) : options.body

  if (hasJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return {
    method: options.method ?? (hasJson || hasBody ? 'POST' : 'GET'),
    headers,
    signal: options.signal,
    body,
  }
}

export async function apiRawRequest(
  path: string,
  options: ApiRequestOptions
): Promise<Result<Response>> {
  try {
    const response = await fetch(path, buildRequestInit(options))
    if (!response.ok) {
      const payload = await readJson(response)
      return { ok: false, error: getResponseError(response, payload, options.fallback) }
    }
    return { ok: true, data: response }
  } catch (error) {
    return { ok: false, error: toServiceError(error, options.fallback) }
  }
}

export async function apiJsonRequest(
  path: string,
  options: ApiRequestOptions
): Promise<Result<unknown>> {
  const response = await apiRawRequest(path, options)
  if (!response.ok) return response
  return { ok: true, data: await readJson(response.data) }
}

export function apiExceptionResult<T>(error: unknown, fallback: string): Result<T> {
  return { ok: false, error: toServiceError(error, fallback) }
}
