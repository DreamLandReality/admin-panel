import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/deployments/active
 *
 * Returns the current user's in-progress deployment (if any) plus a
 * staleness flag so the client can distinguish a genuinely running deploy
 * from a zombie (pipeline crashed without updating the DB).
 *
 * Also auto-recovers zombies older than 15 minutes — matching the same
 * cleanup logic on the dashboard page so any entry point into the app
 * can unblock a stuck user.
 *
 * Response:
 *   { deployment: ActiveDeployment | null, isLikelyStuck: boolean }
 *
 * isLikelyStuck thresholds (based on expected step durations):
 *   'deploying' + updated_at > 5 min  → likely stuck (each pre-CF step < 1 min)
 *   'building'  + updated_at > 10 min → likely stuck (CF build legitimately 5-8 min)
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Auto-recover zombie deployments (same logic as dashboard page) ──────────
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  await supabase
    .from('deployments')
    .update({
      status: 'failed' as const,
      error_message: 'Deployment timed out (no progress for 15 minutes). You can retry from the editor.',
      updated_at: new Date().toISOString(),
    })
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .lt('updated_at', fifteenMinAgo)

  // ── Query for any remaining active deployment ─────────────────────────────
  const { data: deployment } = await supabase
    .from('deployments')
    .select('id, project_name, status, updated_at, github_repo')
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!deployment) {
    return NextResponse.json({ deployment: null, isLikelyStuck: false })
  }

  // ── Compute staleness ─────────────────────────────────────────────────────
  const updatedAt = new Date(deployment.updated_at).getTime()
  const ageMs = Date.now() - updatedAt
  const fiveMin = 5 * 60 * 1000
  const tenMin = 10 * 60 * 1000

  const isLikelyStuck =
    (deployment.status === 'deploying' && ageMs > fiveMin) ||
    (deployment.status === 'building' && ageMs > tenMin)

  return NextResponse.json({ deployment, isLikelyStuck })
}
