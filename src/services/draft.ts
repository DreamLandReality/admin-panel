import type { Draft, DraftCardData } from '@/types'
import type { DraftService, SaveDraftResult } from './types'
import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'

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
    try {
      const response = await fetch('/api/drafts', { signal: options?.signal })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to load drafts.') }
      }
      if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isDraftCardData)) {
        return errorResult('Draft response was invalid.')
      }

      return { ok: true, data: payload.data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to load drafts.') }
    }
  },

  async get(id, options) {
    try {
      const response = await fetch(`/api/drafts/${id}`, { signal: options?.signal })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to load draft.') }
      }
      if (!isRecord(payload) || !isDraft(payload.data)) {
        return errorResult('Draft response was invalid.')
      }

      return { ok: true, data: payload.data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to load draft.') }
    }
  },

  async save(input, options) {
    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify({
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
        }),
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Draft save failed. Please try again.') }
      }
      if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.id !== 'string') {
        return errorResult('Draft save response was invalid.')
      }

      const data: SaveDraftResult = { id: payload.data.id }
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Draft save failed. Please try again.') }
    }
  },

  async generateScreenshot(draftId, options) {
    try {
      const response = await fetch('/api/screenshot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify({ draft_id: draftId }),
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Draft screenshot failed.') }
      }
      return { ok: true, data: undefined }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Draft screenshot failed.') }
    }
  },
}
