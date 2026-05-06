import type { AiProvider, AiService, ParseProjectResult } from './types'
import { apiExceptionResult, apiRawRequest } from './api-client'
import { errorResult, isRecord } from './http'

type ParseStreamEvent =
  | { type: 'ping' }
  | { type: 'error'; message?: string }
  | {
      type: 'result'
      sectionData: Record<string, unknown>
      _sections: ParseProjectResult['sectionsRegistry']
      provider: AiProvider
      parseQuality: ParseProjectResult['parseQuality']
    }

function isSectionRegistryMap(value: unknown): value is ParseProjectResult['sectionsRegistry'] {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => (
    isRecord(entry) &&
    typeof entry.enabled === 'boolean' &&
    (entry.showInNav === undefined || typeof entry.showInNav === 'boolean')
  ))
}

function parseStreamEvent(line: string): ParseStreamEvent | null {
  if (!line.startsWith('data: ')) return null

  let payload: unknown
  try {
    payload = JSON.parse(line.slice(6))
  } catch {
    return null
  }

  if (!isRecord(payload) || typeof payload.type !== 'string') return null
  if (payload.type === 'ping') return { type: 'ping' }
  if (payload.type === 'error') {
    return { type: 'error', message: typeof payload.message === 'string' ? payload.message : undefined }
  }
  if (
    payload.type === 'result' &&
    isRecord(payload.sectionData) &&
    isSectionRegistryMap(payload._sections) &&
    (payload.provider === 'claude' || payload.provider === 'gemini') &&
    (payload.parseQuality === 'ok' || payload.parseQuality === 'low' || payload.parseQuality === 'empty')
  ) {
    return {
      type: 'result',
      sectionData: payload.sectionData,
      _sections: payload._sections,
      provider: payload.provider,
      parseQuality: payload.parseQuality,
    }
  }

  return null
}

export const aiService: AiService = {
  async parseProject(input, options) {
    const responseResult = await apiRawRequest('/api/parse', {
      method: 'POST',
      signal: options?.signal,
      fallback: 'Something went wrong. Please try again.',
      json: {
        templateId: input.templateId,
        rawText: input.rawText,
        provider: input.provider,
      },
    })
    if (!responseResult.ok) return responseResult

    const response = responseResult.data
    if (!response.body) {
      return errorResult('Something went wrong. Please try again.', { status: response.status })
    }

    try {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseStreamEvent(line)
          if (!event || event.type === 'ping') continue

          if (event.type === 'error') {
            return errorResult(event.message ?? 'Something went wrong. Please try again.')
          }

          if (event.parseQuality === 'empty') {
            return errorResult('No data could be extracted. The text may be too short or unrelated to a property listing — try adding more detail.')
          }

          return {
            ok: true,
            data: {
              sectionData: event.sectionData,
              sectionsRegistry: event._sections,
              provider: event.provider,
              parseQuality: event.parseQuality,
            },
          }
        }
      }

      return errorResult('AI parse ended before returning a result.')
    } catch (error) {
      return apiExceptionResult(error, 'Network error. Please check your connection and try again.')
    }
  },
}
