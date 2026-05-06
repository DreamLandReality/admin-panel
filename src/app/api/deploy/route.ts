import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { requireCapability } from '@/lib/api/auth'
import { isRecord } from '@/lib/api/contracts'
import { apiError, apiOk } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'
import { env } from '@/lib/env'
import { DEPLOY_TIMEOUTS } from '@/lib/constants'
import { log } from '@/lib/log'
import { validateDeployReady } from '@/lib/deploy/validators'
import type { Deployment, SiteData, Template } from '@/types'

/** Create a Supabase client using the service role key (bypasses RLS). */
function createServiceClient() {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export const dynamic = 'force-dynamic'

/**
 * POST /api/deploy
 *
 * Validates + creates (or updates) the deployment record, then returns
 * { deploymentId } so the client can navigate to /deployments/{id}/progress.
 * The actual pipeline runs in GET /api/deploy/[id]/stream.
 *
 * Body (JSON):
 *   projectName   — human name, e.g. "Luxury Villa Estates"
 *   templateId    — UUID of the template
 *   siteData      — full site_data from the editor store
 *   deploymentId? — if set, republish an existing live site
 *
 * Responses:
 *   201  { deploymentId, slug }
 *   400  { error, errors[], warnings[] }   (validation failed)
 *   401  { error }                          (not authenticated)
 *   429  { error }                          (rate limited)
 *   404/500  { error }                      (DB errors)
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const auth = await requireCapability('canManageSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  // ── 2. Rate limit (distributed — block concurrent active deploys) ───────────
  const { data: active, error: activeError } = await supabase
    .from('deployments')
    .select('id, status, updated_at')
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .limit(1)

  if (activeError) {
    return apiError(activeError.message, 500)
  }

  if (active?.length) {
    const blocking = active[0]
    const ageMs = Date.now() - new Date(blocking.updated_at).getTime()
    const isZombie =
      (blocking.status === 'deploying' && ageMs > DEPLOY_TIMEOUTS.DEPLOYING_STALE_MS) ||
      (blocking.status === 'building'  && ageMs > DEPLOY_TIMEOUTS.BUILDING_STALE_MS)
    if (!isZombie) {
      return apiError('A deployment is already in progress. Please wait before starting another.', 429)
    }
    // Auto-cancel zombie deployment so the retry can proceed
    const { error: zombieError } = await supabase
      .from('deployments')
      .update({
        status: 'failed' as const,
        error_message: 'Deployment timed out (no progress). Auto-cancelled to allow retry.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', blocking.id)
      .eq('deployed_by', user.id)
      .in('status', ['deploying', 'building'])

    if (zombieError) {
      log.event('warn', 'deploy.zombie_cancel_failed', zombieError.message, {
        deploymentId: blocking.id,
        userId: user.id,
      })
      return apiError('Failed to clear timed-out deployment. Please try again.', 500)
    }
  }

  // ── 3. Parse body ──────────────────────────────────────────────────────────
  const bodyResult = await parseJsonRecordBody(req)
  if (!bodyResult.ok) return bodyResult.response

  const body = bodyResult.data
  const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : ''
  const templateId = typeof body.templateId === 'string' ? body.templateId : ''
  const siteData = isRecord(body.siteData) ? body.siteData as SiteData : null
  const deploymentId = typeof body.deploymentId === 'string' ? body.deploymentId : undefined
  const isRepublish = !!deploymentId

  if (!projectName || !templateId || !siteData) {
    return apiError('projectName, templateId, and siteData are required', 400)
  }

  // ── 4. Fetch template ──────────────────────────────────────────────────────
  const svc = createServiceClient()
  const { data: template, error: tplError } = await svc
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (tplError || !template) {
    return apiError('Template not found', 404)
  }
  const typedTemplate = template as unknown as Template

  // ── 5. Pre-deploy validation ───────────────────────────────────────────────
  const { valid, errors, warnings } = validateDeployReady(
    siteData,
    typedTemplate.manifest,
    projectName
  )
  if (!valid) {
    return apiError('Validation failed', 400, { fields: { errors, warnings } })
  }

  // ── 6. Create / update deployment record ──────────────────────────────────
  let deployment: Deployment

  if (isRepublish) {
    const { data: existing, error: depError } = await svc
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('deployed_by', user.id)
      .single()

    if (depError || !existing) {
      return apiError('Deployment not found', 404)
    }
    const existingDeployment = existing as unknown as Deployment

    // Only allow republish from terminal states (auto-cancel if zombie)
    if (!['live', 'failed'].includes(existingDeployment.status)) {
      const ageMs = Date.now() - new Date(existingDeployment.updated_at).getTime()
      const isZombie =
        (existingDeployment.status === 'deploying' && ageMs > DEPLOY_TIMEOUTS.DEPLOYING_STALE_MS) ||
        (existingDeployment.status === 'building'  && ageMs > DEPLOY_TIMEOUTS.BUILDING_STALE_MS)
      if (!isZombie) {
        return apiError(`Cannot republish: deployment is currently "${existingDeployment.status}". Wait for it to finish or retry after failure.`, 409)
      }
      // Zombie — mark as failed so the optimistic update below can proceed
      const { error: zombieError } = await svc
        .from('deployments')
        .update({
          status: 'failed' as const,
          error_message: 'Deployment timed out. Auto-cancelled.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deploymentId)
        .eq('deployed_by', user.id)
        .in('status', ['deploying', 'building'])

      if (zombieError) {
        log.event('warn', 'deploy.republish_zombie_cancel_failed', zombieError.message, {
          deploymentId,
          userId: user.id,
        })
        return apiError('Failed to clear timed-out deployment. Please try again.', 500)
      }
    }

    // Optimistic lock: only update if status hasn't changed since we checked
    const { data: updated, error: updateErr } = await svc
      .from('deployments')
      .update({
        site_data: siteData,
        status: 'deploying',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deploymentId)
      .eq('deployed_by', user.id)
      .in('status', ['live', 'failed'])
      .select('*')
      .maybeSingle()

    if (updateErr) {
      return apiError('Failed to update deployment', 500)
    }
    if (!updated) {
      return apiError('Deployment is already being redeployed by another request. Please wait.', 409)
    }
    deployment = updated as unknown as Deployment
  } else {
    const { data: slugData, error: slugError } = await svc
      .rpc('generate_unique_slug', { project_name: projectName })
    if (slugError || !slugData) {
      return apiError('Failed to generate site slug', 500)
    }
    const slug = slugData as string

    const { data: created, error: insertErr } = await svc
      .from('deployments')
      .insert({
        project_name: projectName,
        slug,
        template_id: templateId,
        template_version: typedTemplate.version,
        template_manifest: typedTemplate.manifest,
        site_data: siteData,
        status: 'deploying',
        site_token: crypto.randomUUID(),
        deployed_by: user.id,
      })
      .select('*')
      .single()

    if (insertErr || !created) {
      return apiError('Failed to create deployment record', 500)
    }
    deployment = created as unknown as Deployment
  }

  // ── 7. Return deploymentId — pipeline runs in /api/deploy/[id]/stream ──────
  return apiOk({ deploymentId: deployment.id, slug: deployment.slug }, { status: 201 })
}
