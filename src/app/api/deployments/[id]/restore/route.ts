import { type NextRequest } from 'next/server'
import { requireCapability } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * POST /api/deployments/[id]/restore
 * Restores an archived deployment by clearing dead infrastructure references
 * and resetting status to 'deploying' so the deploy pipeline recreates everything.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireCapability('canManageSites')
  if (!auth.ok) return auth.response
  const { user } = auth

  const svc = createServiceClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: deployment, error: fetchError } = await svc
    .from('deployments')
    .select('id, status, deployed_by')
    .eq('id', params.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    return apiError(fetchError.message, 500)
  }

  if (!deployment || deployment.deployed_by !== user.id) {
    return apiError('Not found', 404)
  }

  if (deployment.status !== 'archived') {
    return apiError('Only archived deployments can be restored', 400)
  }

  // Clear dead infrastructure — pipeline will recreate from scratch using existing site_data
  const { error } = await svc
    .from('deployments')
    .update({
      status: 'deploying' as const,
      cloudflare_project_name: null,
      cloudflare_project_id: null,
      github_repo: null,
      github_repo_url: null,
      stable_url: null,
      live_url: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('deployed_by', user.id)

  if (error) {
    return apiError(error.message, 500)
  }

  return apiOk({ deploymentId: params.id })
}
