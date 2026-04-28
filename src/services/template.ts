import type { Template } from '@/types'
import type { ProjectNameCheckResult, TemplateService } from './types'
import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'

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
    try {
      const response = await fetch('/api/templates', { signal: options?.signal })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to load templates.') }
      }
      if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isTemplate)) {
        return errorResult('Templates response was invalid.')
      }

      return { ok: true, data: payload.data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to load templates.') }
    }
  },

  async checkProjectName(name, options) {
    try {
      const response = await fetch(`/api/projects/check-name?name=${encodeURIComponent(name)}`, {
        signal: options?.signal,
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to check project name.') }
      }
      if (!isRecord(payload) || typeof payload.exists !== 'boolean') {
        return errorResult('Project name check response was invalid.')
      }
      if (payload.exists === false) {
        return { ok: true, data: { exists: false } }
      }
      if (payload.type === 'draft' || payload.type === 'deployment') {
        const data: ProjectNameCheckResult = { exists: true, type: payload.type }
        return { ok: true, data }
      }

      return errorResult('Project name check response was invalid.')
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to check project name.') }
    }
  },
}
