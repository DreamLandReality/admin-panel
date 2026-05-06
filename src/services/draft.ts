import type { Draft, DraftCardData } from '@/types'
import { isRecord, isStringIdPayload } from '@/lib/api/contracts'
import type { DraftService, SaveDraftResult } from './types'
import { apiJsonRequest } from './api-client'
import { errorResult } from './http'

function isDraftCardData(value: unknown): value is DraftCardData {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (typeof value.project_name === 'string' || value.project_name === null) &&
    typeof value.template_slug === 'string' &&
    typeof value.current_step === 'number' &&
    typeof value.updated_at === 'string' &&
    (typeof value.deployment_id === 'string' || value.deployment_id === null)
  )
}

function isDraft(value: unknown): value is Draft {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.template_slug === 'string' &&
    typeof value.current_step === 'number' &&
    typeof value.raw_text === 'string'
  )
}

export const draftService: DraftService = {
  async list(options) {
    const result = await apiJsonRequest('/api/drafts', {
      signal: options?.signal,
      fallback: 'Failed to load drafts.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isDraftCardData)) {
      return errorResult('Draft response was invalid.')
    }

    return { ok: true, data: payload.data }
  },

  async get(id, options) {
    const result = await apiJsonRequest(`/api/drafts/${id}`, {
      signal: options?.signal,
      fallback: 'Failed to load draft.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isRecord(payload) || !isDraft(payload.data)) {
      return errorResult('Draft response was invalid.')
    }

    return { ok: true, data: payload.data }
  },

  async save(input, options) {
    const result = await apiJsonRequest('/api/drafts', {
      method: 'POST',
      signal: options?.signal,
      fallback: 'Draft save failed. Please try again.',
      json: {
        deployment_id: input.deploymentId,
        project_name: input.projectName,
        template_slug: input.templateSlug,
        template_id: input.templateId,
        current_step: input.currentStep,
        raw_text: input.rawText,
        section_data: input.sectionData,
        sections_registry: input.sectionsRegistry,
        collection_data: input.collectionData,
        site_slug: input.siteSlug,
        last_active_page: input.lastActivePage,
        screenshot_url: input.screenshotUrl,
      },
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isRecord(payload) || !isStringIdPayload(payload.data)) {
      return errorResult('Draft save response was invalid.')
    }

    const data: SaveDraftResult = { id: payload.data.id }
    return { ok: true, data }
  },

  async generateScreenshot(draftId, options) {
    const result = await apiJsonRequest('/api/screenshot/draft', {
      method: 'POST',
      signal: options?.signal,
      fallback: 'Draft screenshot failed.',
      json: { draft_id: draftId },
    })
    if (!result.ok) return result
    return { ok: true, data: undefined }
  },
}
