import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { data: template, error: tplError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', deployment.template_id)
    .single()

  if (tplError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

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

  const body = await req.json()
  const { site_data, action } = body as {
    site_data: Record<string, unknown>
    action: 'save' | 'republish'
  }

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
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isRepublish = action === 'republish'

  const { data, error } = await supabase
    .from('deployments')
    .update({
      site_data,
      has_unpublished_changes: !isRepublish,
      // For republish: transition to deploying (deploy pipeline will update further)
      ...(isRepublish ? { status: 'deploying' } : {}),
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
