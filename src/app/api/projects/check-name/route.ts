import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/projects/check-name?name=...
 *
 * Checks if a project name is already taken by an existing draft or deployment
 * belonging to the authenticated user.
 *
 * Response:
 *   { exists: false }
 *   { exists: true, type: 'draft' | 'deployment' }
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name) {
    return NextResponse.json({ exists: false })
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check deployments (any status except cancelled)
  const { data: deployment } = await supabase
    .from('deployments')
    .select('id')
    .eq('deployed_by', user.id)
    .ilike('project_name', name)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()

  if (deployment) {
    return NextResponse.json({ exists: true, type: 'deployment' })
  }

  // Check new-site drafts (deployment_id is null means new-site draft)
  const { data: draft } = await supabase
    .from('drafts')
    .select('id')
    .eq('user_id', user.id)
    .ilike('project_name', name)
    .is('deployment_id', null)
    .limit(1)
    .maybeSingle()

  if (draft) {
    return NextResponse.json({ exists: true, type: 'draft' })
  }

  return NextResponse.json({ exists: false })
}
