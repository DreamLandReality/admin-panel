import { isAppConfigPayload, unwrapDataEnvelope } from '@/lib/api/contracts'
import { apiJsonRequest } from './api-client'
import { errorResult } from './http'
import type { Result, ServiceRequestOptions } from './types'

export interface AppConfig {
  isAiConfigured: boolean
  isGeminiConfigured: boolean
}

export async function getAppConfig(options?: ServiceRequestOptions): Promise<Result<AppConfig>> {
  const result = await apiJsonRequest('/api/config', {
    signal: options?.signal,
    fallback: 'Failed to load app config.',
  })
  if (!result.ok) return result

  const payload = unwrapDataEnvelope(result.data)
  if (!isAppConfigPayload(payload)) {
    return errorResult('App config response was invalid.')
  }

  return {
    ok: true,
    data: {
      isAiConfigured: payload.isAiConfigured,
      isGeminiConfigured: payload.isGeminiConfigured,
    },
  }
}
