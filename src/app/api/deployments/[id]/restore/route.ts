import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: deployment } = await svc
    .from('deployments')
    .select('id, status, deployed_by')
    .eq('id', params.id)
    .single()

  if (!deployment || deployment.deployed_by !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (deployment.status !== 'archived') {
    return NextResponse.json({ error: 'Only archived deployments can be restored' }, { status: 400 })
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deploymentId: params.id })
}
