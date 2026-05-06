import { NextResponse } from 'next/server'

type JsonPayload = Record<string, unknown>

export function apiData<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init)
}

export function apiOk<T extends JsonPayload>(payload: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(payload, init)
}

export function apiError(
  message: string,
  status: number,
  options: { code?: string; details?: unknown; headers?: HeadersInit; fields?: JsonPayload } = {}
): NextResponse {
  const body: JsonPayload = { error: message, ...options.fields }
  if (options.code) body.code = options.code
  if (options.details !== undefined) body.details = options.details

  return NextResponse.json(body, {
    status,
    headers: options.headers,
  })
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return apiError(message, 401)
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return apiError(message, 403)
}

export function tooManyRequests(message: string, resetMs: number, limit: number): NextResponse {
  return apiError(message, 429, {
    headers: {
      'Retry-After': String(Math.ceil(resetMs / 1000)),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
    },
  })
}
