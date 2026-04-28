import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'
import type { Result, ServiceRequestOptions } from './types'

export interface AppConfig {
  isAiConfigured: boolean
  isGeminiConfigured: boolean
}

export async function getAppConfig(options?: ServiceRequestOptions): Promise<Result<AppConfig>> {
  try {
    const response = await fetch('/api/config', { signal: options?.signal })
    const payload = await readJson(response)
    if (!response.ok) {
      return { ok: false, error: getResponseError(response, payload, 'Failed to load app config.') }
    }
    if (
      !isRecord(payload) ||
      typeof payload.isAiConfigured !== 'boolean' ||
      typeof payload.isGeminiConfigured !== 'boolean'
    ) {
      return errorResult('App config response was invalid.')
    }

    return {
      ok: true,
      data: {
        isAiConfigured: payload.isAiConfigured,
        isGeminiConfigured: payload.isGeminiConfigured,
      },
    }
  } catch (error) {
    return { ok: false, error: toServiceError(error, 'Failed to load app config.') }
  }
}
