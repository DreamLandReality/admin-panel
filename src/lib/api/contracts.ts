export const CALL_STATUSES = [
  'pending',
  'scheduled',
  'calling',
  'completed',
  'no_answer',
  'failed',
  'cancelled',
  'skipped',
] as const

export type CallStatus = typeof CALL_STATUSES[number]

export const LEAD_STATUSES = [
  'new',
  'attended',
  'follow_up',
  'closed',
] as const

export type LeadStatus = typeof LEAD_STATUSES[number]

export const ATTENDED_BY_VALUES = [
  'automated',
  'manual',
] as const

export type AttendedBy = typeof ATTENDED_BY_VALUES[number] | null

export interface CallStats {
  scheduled: number
  completed: number
  failed: number
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function unwrapDataEnvelope(payload: unknown): unknown {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data
  return payload
}

export function isStringIdPayload(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string'
}

export function isDeploymentIdPayload(value: unknown): value is { deploymentId: string } {
  return isRecord(value) && typeof value.deploymentId === 'string'
}

export function isArchivedStatusPayload(value: unknown): value is { status: 'archived' } {
  return isRecord(value) && value.status === 'archived'
}

export function isUploadImageResult(value: unknown): value is { url: string; key: string } {
  return isRecord(value) && typeof value.url === 'string' && typeof value.key === 'string'
}

export function isSignedUrlResult(value: unknown): value is { url: string } {
  return isRecord(value) && typeof value.url === 'string'
}

export function isProjectNameCheckResult(
  value: unknown
): value is { exists: false } | { exists: true; type: 'draft' | 'deployment' } {
  if (!isRecord(value) || typeof value.exists !== 'boolean') return false
  return value.exists === false || value.type === 'draft' || value.type === 'deployment'
}

export function isAppConfigPayload(
  value: unknown
): value is { isAiConfigured: boolean; isGeminiConfigured: boolean } {
  return (
    isRecord(value) &&
    typeof value.isAiConfigured === 'boolean' &&
    typeof value.isGeminiConfigured === 'boolean'
  )
}

export function isCallStatus(value: unknown): value is CallStatus {
  return typeof value === 'string' && CALL_STATUSES.includes(value as CallStatus)
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && LEAD_STATUSES.includes(value as LeadStatus)
}

export function isAttendedBy(value: unknown): value is AttendedBy {
  return value === null || (typeof value === 'string' && ATTENDED_BY_VALUES.includes(value as Exclude<AttendedBy, null>))
}

export function isCallStats(value: unknown): value is CallStats {
  return (
    isRecord(value) &&
    typeof value.scheduled === 'number' &&
    typeof value.completed === 'number' &&
    typeof value.failed === 'number'
  )
}
