import { type NextRequest } from 'next/server'
import { requireCapability, requireUser } from '@/lib/api/auth'
import { isCallStatus, isLeadStatus } from '@/lib/api/contracts'
import { apiData, apiError, apiOk, forbidden } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'
import { hasCapability } from '@/lib/auth/roles'
import { resolveLeadSource } from '@/lib/utils/manifest-contract'
import type { FormSubmission } from '@/types'

type SourceMetadata = ReturnType<typeof resolveLeadSource>
type FormSubmissionDeployment = { project_name?: string | null } | null
type FormSubmissionWithDeployment = FormSubmission & {
  deployments?: FormSubmissionDeployment | FormSubmissionDeployment[]
  call_status?: string | null
}
type PropertyOptionRow = Pick<FormSubmission, 'deployment_slug'> & {
  deployments?: FormSubmissionDeployment | FormSubmissionDeployment[]
}
type SortColumn = 'name' | 'date' | 'property'
type SortDirection = 'asc' | 'desc'
type EnquiryAuth = Extract<Awaited<ReturnType<typeof requireCapability>>, { ok: true }>
type EnquirySupabaseClient = EnquiryAuth['supabase']

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

function normalizeStoredSourceMetadata(
  value: unknown,
  formType: string | null | undefined
): SourceMetadata {
  if (value && typeof value === 'object') {
    const metadata = value as Partial<SourceMetadata>
    if (
      typeof metadata.id === 'string' &&
      typeof metadata.label === 'string' &&
      typeof metadata.kind === 'string' &&
      typeof metadata.known === 'boolean'
    ) {
      return {
        id: metadata.id,
        label: metadata.label,
        kind: metadata.kind,
        sectionId: typeof metadata.sectionId === 'string' ? metadata.sectionId : undefined,
        gateId: typeof metadata.gateId === 'string' ? metadata.gateId : undefined,
        known: metadata.known,
      }
    }
  }

  return resolveLeadSource(null, formType)
}

function normalizeJoinedDeployment(
  deployment: FormSubmissionWithDeployment['deployments']
): FormSubmissionDeployment {
  return Array.isArray(deployment) ? deployment[0] ?? null : deployment ?? null
}

function getBoundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function getSortColumn(value: string | null): SortColumn {
  return value === 'name' || value === 'property' || value === 'date' ? value : 'date'
}

function getSortDirection(value: string | null): SortDirection {
  return value === 'asc' ? 'asc' : 'desc'
}

function getSearchTerm(value: string | null): string {
  return (value ?? '')
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}

function enrichSubmission(submission: FormSubmissionWithDeployment) {
  const deployment = normalizeJoinedDeployment(submission.deployments)
  const source = normalizeStoredSourceMetadata(submission.source_metadata, submission.form_type)
  const { source_metadata: _sourceMetadata, ...submissionSummary } = submission

  return {
    ...submissionSummary,
    deployments: deployment,
    source,
  }
}

async function getNewLeadCount(supabase: EnquirySupabaseClient) {
  const { count, error } = await supabase
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('lead_status', 'new')

  if (error) throw new Error(error.message)
  return count ?? 0
}

async function getCallStats(supabase: EnquirySupabaseClient) {
  const [scheduled, completed, failed, noAnswer] = await Promise.all([
    supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('call_status', 'scheduled'),
    supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('call_status', 'completed'),
    supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('call_status', 'failed'),
    supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('call_status', 'no_answer'),
  ])

  const firstError = [scheduled, completed, failed, noAnswer].find((result) => result.error)?.error
  if (firstError) throw new Error(firstError.message)

  return {
    scheduled: scheduled.count ?? 0,
    completed: completed.count ?? 0,
    failed: (failed.count ?? 0) + (noAnswer.count ?? 0),
  }
}

async function getPropertyOptions(supabase: EnquirySupabaseClient) {
  const { data, error } = await supabase
    .from('form_submissions')
    .select('deployment_slug, deployments(project_name)')
    .order('deployment_slug', { ascending: true })

  if (error) throw new Error(error.message)

  return Array.from(
    new Map(
      ((data ?? []) as PropertyOptionRow[]).map((row) => {
        const deployment = normalizeJoinedDeployment(row.deployments)
        return [
          row.deployment_slug,
          {
            slug: row.deployment_slug,
            name: deployment?.project_name ?? row.deployment_slug,
          },
        ]
      })
    ).values()
  )
}

/**
 * GET /api/enquiries
 * Returns one bounded form-submission page plus lightweight summary counts.
 */
export async function GET(req: NextRequest) {
  const auth = await requireCapability('canViewEnquiries')
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const searchParams = req.nextUrl.searchParams
  const summaryOnly = searchParams.get('summary') === 'true'
  let newLeadCount: number
  let callStats: Awaited<ReturnType<typeof getCallStats>>
  try {
    newLeadCount = await getNewLeadCount(supabase)
    callStats = await getCallStats(supabase)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to load enquiry summary', 500)
  }

  if (summaryOnly) {
    return apiData({ newLeadCount, callStats })
  }

  const page = getBoundedInteger(searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = getBoundedInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const property = searchParams.get('property') ?? 'all'
  const search = getSearchTerm(searchParams.get('search'))
  const callStatus = searchParams.get('callStatus') ?? 'all'
  const leadStatus = searchParams.get('leadStatus') ?? 'all'
  const sort = getSortColumn(searchParams.get('sort'))
  const dir = getSortDirection(searchParams.get('dir'))
  let properties: Awaited<ReturnType<typeof getPropertyOptions>>
  try {
    properties = await getPropertyOptions(supabase)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to load enquiry filters', 500)
  }

  let query = supabase
    .from('form_submissions')
    .select('*, deployments(project_name)', { count: 'exact' })

  if (property !== 'all') {
    query = query.eq('deployment_slug', property)
  }

  if (callStatus !== 'all' && isCallStatus(callStatus)) {
    query = query.eq('call_status', callStatus)
  }

  if (leadStatus !== 'all' && isLeadStatus(leadStatus)) {
    query = query.eq('lead_status', leadStatus)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%,deployment_slug.ilike.%${search}%`)
  }

  if (sort === 'name') {
    query = query.order('name', { ascending: dir === 'asc' })
  } else if (sort === 'property') {
    query = query.order('deployment_slug', { ascending: dir === 'asc' })
  } else {
    query = query.order('created_at', { ascending: dir === 'asc' })
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return apiError(error.message, 500)
  }

  const submissions = (data ?? []) as FormSubmissionWithDeployment[]
  const enriched = submissions.map(enrichSubmission)

  return apiOk({
    data: enriched,
    page,
    pageSize,
    totalCount: count ?? 0,
    newLeadCount,
    properties,
    callStats,
  })
}

/**
 * PATCH /api/enquiries
 * Supports manual lead progress updates.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user, role } = auth

  const bodyResult = await parseJsonRecordBody(req)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.data

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) {
    return apiError('Missing id', 400)
  }

  const action = typeof body.action === 'string' ? body.action : 'update_lead_status'

  if (action === 'update_lead_status' || action === 'update_follow_up') {
    if (!hasCapability(role, 'canManageFollowUps')) {
      return forbidden()
    }

    const leadStatus = isLeadStatus(body.lead_status)
      ? body.lead_status
      : null
    const callNotes = typeof body.call_notes === 'string' ? body.call_notes.trim() : ''

    if (!leadStatus) {
      return apiError('Invalid lead_status', 400)
    }

    const { error } = await supabase
      .from('form_submissions')
      .update({
        lead_status: leadStatus,
        call_notes: callNotes || null,
        attended_by: 'manual',
        attended_user_id: user.id,
        attended_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return apiError(error.message, 500)
    }

    return apiOk({ success: true })
  }

  return apiError('Invalid action', 400)
}
