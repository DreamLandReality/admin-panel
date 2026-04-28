import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'
import type { Result, ServiceRequestOptions } from './types'

export type CallStatus = 'pending' | 'scheduled' | 'calling' | 'completed' | 'no_answer' | 'failed' | 'cancelled' | 'skipped'

export interface Enquiry {
  id: string
  deployment_id: string
  deployment_slug: string
  name: string
  email: string
  phone: string | null
  message: string | null
  source_url: string
  form_type: string
  source_metadata?: {
    id?: string
    label?: string
    kind?: string
    sectionId?: string
    gateId?: string
    known?: boolean
  } | null
  source: {
    id: string
    label: string
    kind: string
    sectionId?: string
    gateId?: string
    known: boolean
  }
  is_read: boolean
  created_at: string
  deployments: { project_name: string } | null
  call_status: CallStatus
  call_scheduled_for: string | null
  call_completed_at: string | null
  call_transcript: string | null
  call_collected_data: Record<string, string> | null
  call_duration_seconds: number | null
  call_attempts: number
  call_property_context: string | null
}

export interface EnquirySummary {
  unreadCount: number
}

export interface EnquiriesResult {
  data: Enquiry[]
  unreadCount: number
}

export type VoiceCallAction =
  | { action: 'retry' | 'cancel' }

export interface VoiceCallActionResult {
  status: string
}

function isSource(value: unknown): value is Enquiry['source'] {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.known === 'boolean'
  )
}

function isEnquiry(value: unknown): value is Enquiry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.deployment_slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    isSource(value.source) &&
    typeof value.is_read === 'boolean' &&
    typeof value.created_at === 'string'
  )
}

export async function getEnquirySummary(options?: ServiceRequestOptions): Promise<Result<EnquirySummary>> {
  try {
    const response = await fetch('/api/enquiries', { signal: options?.signal })
    const payload = await readJson(response)
    if (!response.ok) {
      return { ok: false, error: getResponseError(response, payload, 'Failed to load enquiries.') }
    }
    if (!isRecord(payload) || typeof payload.unreadCount !== 'number') {
      return errorResult('Enquiries response was invalid.')
    }

    return { ok: true, data: { unreadCount: payload.unreadCount } }
  } catch (error) {
    return { ok: false, error: toServiceError(error, 'Failed to load enquiries.') }
  }
}

export const enquiryService = {
  async list(options?: ServiceRequestOptions): Promise<Result<EnquiriesResult>> {
    try {
      const response = await fetch('/api/enquiries', { signal: options?.signal })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to load enquiries.') }
      }
      if (
        !isRecord(payload) ||
        !Array.isArray(payload.data) ||
        !payload.data.every(isEnquiry) ||
        typeof payload.unreadCount !== 'number'
      ) {
        return errorResult('Enquiries response was invalid.')
      }

      return { ok: true, data: { data: payload.data, unreadCount: payload.unreadCount } }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to load enquiries.') }
    }
  },

  async markRead(id: string, options?: ServiceRequestOptions): Promise<Result<{ success: true }>> {
    try {
      const response = await fetch('/api/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify({ id }),
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to mark enquiry as read.') }
      }

      return { ok: true, data: { success: true } }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to mark enquiry as read.') }
    }
  },

  async updateVoiceCall(
    id: string,
    input: VoiceCallAction,
    options?: ServiceRequestOptions
  ): Promise<Result<VoiceCallActionResult>> {
    try {
      const response = await fetch(`/api/voice-call/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify(input),
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Voice call update failed.') }
      }
      if (!isRecord(payload) || typeof payload.status !== 'string') {
        return errorResult('Voice call response was invalid.')
      }

      return { ok: true, data: { status: payload.status } }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Voice call update failed.') }
    }
  },
}
