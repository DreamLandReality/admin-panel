import { apiError } from './response'

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: Response }

export type JsonRecordBodyResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: Response }

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function parseJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    return { ok: true, data: await request.json() }
  } catch {
    return { ok: false, response: apiError('Invalid request body', 400) }
  }
}

export async function parseJsonRecordBody(request: Request): Promise<JsonRecordBodyResult> {
  const bodyResult = await parseJsonBody(request)
  if (!bodyResult.ok) return bodyResult
  if (!isJsonRecord(bodyResult.data)) {
    return { ok: false, response: apiError('Invalid request body', 400) }
  }
  return { ok: true, data: bodyResult.data }
}
