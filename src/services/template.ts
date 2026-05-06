import type { Template } from '@/types'
import { isProjectNameCheckResult, isRecord } from '@/lib/api/contracts'
import type { ProjectNameCheckResult, TemplateService } from './types'
import { apiJsonRequest } from './api-client'
import { errorResult } from './http'

function isTemplate(value: unknown): value is Template {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    isRecord(value.manifest) &&
    isRecord(value.config) &&
    typeof value.is_active === 'boolean'
  )
}

export const templateService: TemplateService = {
  async list(options) {
    const result = await apiJsonRequest('/api/templates', {
      signal: options?.signal,
      fallback: 'Failed to load templates.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isTemplate)) {
      return errorResult('Templates response was invalid.')
    }

    return { ok: true, data: payload.data }
  },

  async checkProjectName(name, options) {
    const result = await apiJsonRequest(`/api/projects/check-name?name=${encodeURIComponent(name)}`, {
      signal: options?.signal,
      fallback: 'Failed to check project name.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isProjectNameCheckResult(payload)) {
      return errorResult('Project name check response was invalid.')
    }

    const data: ProjectNameCheckResult = payload.exists === false
      ? { exists: false }
      : { exists: true, type: payload.type }
    return { ok: true, data }
  },
}
