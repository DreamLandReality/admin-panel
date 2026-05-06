import { requireCapability } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { DEPLOY_TIMEOUTS } from '@/lib/constants'
import { log } from '@/lib/log'

export const dynamic = 'force-dynamic'

/**
 * GET /api/deployments/active
 *
 * Returns the current user's in-progress deployment, when present, plus a
 * staleness flag so the client can distinguish a genuinely running deploy
 * from a zombie (pipeline crashed without updating the DB).
 *
 * Also auto-recovers zombies older than 15 minutes — matching the same
 * cleanup logic on the dashboard page so every entry point into the app
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
  const auth = await requireCapability('canManageSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  // ── Auto-recover zombie deployments (same logic as dashboard page) ──────────
  const fifteenMinAgo = new Date(Date.now() - DEPLOY_TIMEOUTS.HARD_CANCEL_MS).toISOString()
  const { error: recoverError } = await supabase
    .from('deployments')
    .update({
      status: 'failed' as const,
      error_message: 'Deployment timed out (no progress for 15 minutes). You can retry from the editor.',
      updated_at: new Date().toISOString(),
    })
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .lt('updated_at', fifteenMinAgo)

  if (recoverError) {
    log.event('warn', 'deployment.active.zombie_recover_failed', recoverError.message, {
      userId: user.id,
    })
  }

  // ── Query for a remaining active deployment ───────────────────────────────
  const { data: deployment, error: deploymentError } = await supabase
    .from('deployments')
    .select('id, project_name, status, updated_at, github_repo')
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (deploymentError) {
    return apiError(deploymentError.message, 500)
  }

  if (!deployment) {
    return apiOk({ deployment: null, isLikelyStuck: false })
  }

  // ── Compute staleness ─────────────────────────────────────────────────────
  const updatedAt = new Date(deployment.updated_at).getTime()
  const ageMs = Date.now() - updatedAt

  const isLikelyStuck =
    (deployment.status === 'deploying' && ageMs > DEPLOY_TIMEOUTS.DEPLOYING_STALE_MS) ||
    (deployment.status === 'building' && ageMs > DEPLOY_TIMEOUTS.BUILDING_STALE_MS)

  return apiOk({ deployment, isLikelyStuck })
}
