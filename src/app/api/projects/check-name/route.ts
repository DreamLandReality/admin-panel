import { type NextRequest } from 'next/server'
import { requireCapability } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'

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
    return apiOk({ exists: false })
  }

  const auth = await requireCapability('canCreateSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  // Check deployments (any status except cancelled)
  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id')
    .eq('deployed_by', user.id)
    .ilike('project_name', name)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()

  if (deploymentError) {
    return apiError(deploymentError.message, 500)
  }

  if (deployment) {
    return apiOk({ exists: true, type: 'deployment' })
  }

  // Check new-site drafts (deployment_id is null means new-site draft)
  const { data: draft, error: draftError } = await supabase
    .from('drafts')
    .select('id')
    .eq('user_id', user.id)
    .ilike('project_name', name)
    .is('deployment_id', null)
    .limit(1)
    .maybeSingle()

  if (draftError) {
    return apiError(draftError.message, 500)
  }

  if (draft) {
    return apiOk({ exists: true, type: 'draft' })
  }

  return apiOk({ exists: false })
}
