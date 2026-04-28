import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveLeadSource } from '@/lib/utils/manifest-contract'

type SourceMetadata = ReturnType<typeof resolveLeadSource>

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

/**
 * GET /api/enquiries
 * Returns all form submissions joined with deployment project_name, newest first.
 * Also includes a top-level unreadCount for sidebar badge.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('form_submissions')
    .select('*, deployments(project_name)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unreadCount = (data ?? []).filter((s) => !s.is_read).length

  const callStats = {
    scheduled: (data ?? []).filter((s: any) => s.call_status === 'scheduled').length,
    completed: (data ?? []).filter((s: any) => s.call_status === 'completed').length,
    failed: (data ?? []).filter((s: any) => ['failed', 'no_answer'].includes(s.call_status)).length,
  }

  const enriched = (data ?? []).map((submission: any) => {
    const deployment = submission.deployments as { project_name?: string } | null
    const source = normalizeStoredSourceMetadata(submission.source_metadata, submission.form_type)
    const { source_metadata: _sourceMetadata, ...submissionSummary } = submission

    return {
      ...submissionSummary,
      deployments: deployment,
      source,
    }
  })

  return NextResponse.json({ data: enriched, unreadCount, callStats })
}

/**
 * PATCH /api/enquiries
 * Marks a single form submission as read.
 * Body: { id: string }
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('form_submissions')
    .update({ is_read: true })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
