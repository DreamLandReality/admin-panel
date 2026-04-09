import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteProject } from '@/lib/deploy/cloudflare'

type RouteContext = { params: { id: string } }

/**
 * GET /api/deployments/[id]
 * Returns the deployment row and its template.
 * Used by client components that need to bootstrap the editor.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: deployment, error: depError } = await supabase
    .from('deployments')
    .select('*')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .single()

  if (depError || !deployment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', deployment.template_id)
    .maybeSingle()

  return NextResponse.json({ data: { deployment, template } })
}

/**
 * PATCH /api/deployments/[id]
 * Updates the deployment's site_data.
 *
 * Body:
 *   site_data  — merged section data + _sections registry
 *   action     — 'save'      : persist edits, mark has_unpublished_changes = true
 *              | 'republish' : persist edits + trigger deploy pipeline (future)
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { site_data: Record<string, unknown>; action: 'save' | 'republish' | 'cancel' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { site_data, action } = body

  if (!site_data || !action) {
    return NextResponse.json(
      { error: 'site_data and action are required' },
      { status: 400 }
    )
  }

  // Verify ownership before writing
  const { data: existing } = await supabase
    .from('deployments')
    .select('id')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (action === 'republish') {
    return NextResponse.json({ error: 'republish via PATCH is not yet implemented — use POST /api/deploy' }, { status: 501 })
  }

  if (action === 'cancel') {
    const { data: cancelled, error: cancelErr } = await supabase
      .from('deployments')
      .update({
        status: 'failed' as const,
        error_message: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('deployed_by', user.id)
      .in('status', ['deploying', 'building'])
      .select('id, status, error_message, updated_at')
      .maybeSingle()

    if (cancelErr) {
      return NextResponse.json({ error: cancelErr.message }, { status: 500 })
    }
    if (!cancelled) {
      return NextResponse.json(
        { error: 'Deployment is not in progress — cannot cancel.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ data: cancelled })
  }

  // Extract screenshot from site_data using the same fallback logic as the deploy pipeline
  const sd = site_data as any
  const extractedScreenshot: string | null =
    (typeof sd?.seo?.image === 'string' && sd.seo.image.startsWith('http') ? sd.seo.image : null) ??
    (typeof sd?.hero?.backgroundImage === 'string' && sd.hero.backgroundImage.startsWith('http') ? sd.hero.backgroundImage : null) ??
    null

  const { data, error } = await supabase
    .from('deployments')
    .update({
      site_data,
      has_unpublished_changes: true,
      ...(extractedScreenshot ? { screenshot_url: extractedScreenshot } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('id, status, has_unpublished_changes, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/deployments/[id]
 * Deletes a live deployment:
 *   - Removes the Cloudflare Pages project (site goes offline)
 *   - Soft-deletes the DB row: status = 'archived', URLs cleared
 * Only works when status === 'live'.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: deployment, error: fetchError } = await supabase
    .from('deployments')
    .select('id, status, cloudflare_project_name')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .single()

  if (fetchError || !deployment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (deployment.status !== 'live') {
    return NextResponse.json(
      { error: 'Only live deployments can be deleted' },
      { status: 400 }
    )
  }

  // 1. Delete Cloudflare Pages project (hard delete — site goes offline)
  if (deployment.cloudflare_project_name) {
    await deleteProject(deployment.cloudflare_project_name)
  }

  // 2. Soft delete — archive row, clear live URLs
  const { error: updateError } = await supabase
    .from('deployments')
    .update({
      status: 'archived' as const,
      stable_url: null,
      live_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'archived' })
}
