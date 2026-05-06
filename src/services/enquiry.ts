import { apiJsonRequest } from './api-client'
import { errorResult, isRecord } from './http'
import type { Result, ServiceRequestOptions } from './types'
import {
  isCallStats,
  isCallStatus,
  isLeadStatus,
  unwrapDataEnvelope,
  type AttendedBy,
  type CallStats,
  type CallStatus,
  type LeadStatus,
} from '@/lib/api/contracts'

export type { AttendedBy, CallStats, CallStatus, LeadStatus }
export type EnquiryStatusFilter = 'all' | 'unread' | `source:${string}`
export type EnquirySortColumn = 'name' | 'date' | 'property'
export type EnquirySortDirection = 'asc' | 'desc'

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
  call_attempts: number
  call_property_context: string | null
  lead_status: LeadStatus
  attended_by: AttendedBy
  attended_user_id: string | null
  attended_at: string | null
  call_notes: string | null
  call_transcript_raw?: unknown
  call_transcript_text?: string | null
}

export interface EnquiriesResult {
  data: Enquiry[]
  page: number
  pageSize: number
  totalCount: number
  unreadCount: number
  callStats: CallStats
}

export interface EnquirySummaryResult {
  unreadCount: number
  callStats: CallStats
}

export interface EnquiryQuery {
  page?: number
  pageSize?: number
  status?: EnquiryStatusFilter
  property?: string
  search?: string
  sort?: EnquirySortColumn
  dir?: EnquirySortDirection
  callStatus?: 'all' | CallStatus
  leadStatus?: 'all' | LeadStatus
}

export interface FollowUpUpdateInput {
  lead_status: LeadStatus
  call_notes: string
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
    isLeadStatus(value.lead_status) &&
    typeof value.is_read === 'boolean' &&
    typeof value.created_at === 'string'
  )
}

function buildEnquiryListPath(query: EnquiryQuery = {}): string {
  const params = new URLSearchParams()
  const page = Number.isInteger(query.page) ? query.page : 1
  const pageSize = Number.isInteger(query.pageSize) ? query.pageSize : 10

  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (query.status && query.status !== 'all') params.set('status', query.status)
  if (query.property && query.property !== 'all') params.set('property', query.property)
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.sort) params.set('sort', query.sort)
  if (query.dir) params.set('dir', query.dir)
  if (query.callStatus && query.callStatus !== 'all' && isCallStatus(query.callStatus)) {
    params.set('callStatus', query.callStatus)
  }
  if (query.leadStatus && query.leadStatus !== 'all' && isLeadStatus(query.leadStatus)) {
    params.set('leadStatus', query.leadStatus)
  }

  return `/api/enquiries?${params.toString()}`
}

export const enquiryService = {
  async list(query: EnquiryQuery = {}, options?: ServiceRequestOptions): Promise<Result<EnquiriesResult>> {
    const result = await apiJsonRequest(buildEnquiryListPath(query), {
      signal: options?.signal,
      fallback: 'Failed to load enquiries.',
    })
    if (!result.ok) return result

    const payload = unwrapDataEnvelope(result.data)
    if (
      !isRecord(payload) ||
      !Array.isArray(payload.data) ||
      !payload.data.every(isEnquiry) ||
      typeof payload.page !== 'number' ||
      typeof payload.pageSize !== 'number' ||
      typeof payload.totalCount !== 'number' ||
      typeof payload.unreadCount !== 'number' ||
      !isCallStats(payload.callStats)
    ) {
      return errorResult('Enquiries response was invalid.')
    }

    return {
      ok: true,
      data: {
        data: payload.data,
        page: payload.page,
        pageSize: payload.pageSize,
        totalCount: payload.totalCount,
        unreadCount: payload.unreadCount,
        callStats: payload.callStats,
      },
    }
  },

  async summary(options?: ServiceRequestOptions): Promise<Result<EnquirySummaryResult>> {
    const result = await apiJsonRequest('/api/enquiries?summary=true', {
      signal: options?.signal,
      fallback: 'Failed to load enquiry summary.',
    })
    if (!result.ok) return result

    const payload = unwrapDataEnvelope(result.data)
    if (
      !isRecord(payload) ||
      typeof payload.unreadCount !== 'number' ||
      !isCallStats(payload.callStats)
    ) {
      return errorResult('Enquiry summary response was invalid.')
    }

    return { ok: true, data: { unreadCount: payload.unreadCount, callStats: payload.callStats } }
  },

  async markRead(id: string, options?: ServiceRequestOptions): Promise<Result<{ success: true }>> {
    const result = await apiJsonRequest('/api/enquiries', {
      method: 'PATCH',
      signal: options?.signal,
      fallback: 'Failed to mark enquiry as read.',
      json: { action: 'mark_read', id },
    })
    if (!result.ok) return result

    return { ok: true, data: { success: true } }
  },

  async updateFollowUp(
    id: string,
    input: FollowUpUpdateInput,
    options?: ServiceRequestOptions
  ): Promise<Result<{ success: true }>> {
    const result = await apiJsonRequest('/api/enquiries', {
      method: 'PATCH',
      signal: options?.signal,
      fallback: 'Failed to update follow-up.',
      json: { action: 'update_follow_up', id, ...input },
    })
    if (!result.ok) return result

    return { ok: true, data: { success: true } }
  },
}
