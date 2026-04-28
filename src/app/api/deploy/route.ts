import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { validateDeployReady } from '@/lib/deploy/validators'
import type { SiteData } from '@/types'

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
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Rate limit (distributed — block concurrent active deploys) ───────────
  const { data: active } = await supabase
    .from('deployments')
    .select('id, status, updated_at')
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .limit(1)
  if (active?.length) {
    const blocking = active[0]
    const ageMs = Date.now() - new Date(blocking.updated_at).getTime()
    const isZombie =
      (blocking.status === 'deploying' && ageMs > 5 * 60 * 1000) ||
      (blocking.status === 'building'  && ageMs > 10 * 60 * 1000)
    if (!isZombie) {
      return NextResponse.json(
        { error: 'A deployment is already in progress. Please wait before starting another.' },
        { status: 429 }
      )
    }
    // Auto-cancel zombie deployment so the retry can proceed
    await supabase
      .from('deployments')
      .update({
        status: 'failed' as const,
        error_message: 'Deployment timed out (no progress). Auto-cancelled to allow retry.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', blocking.id)
      .in('status', ['deploying', 'building'])
  }

  // ── 3. Parse body ──────────────────────────────────────────────────────────
  let body: {
    projectName: string
    templateId: string
    siteData: SiteData
    deploymentId?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { projectName, templateId, siteData, deploymentId } = body
  const isRepublish = !!deploymentId

  // ── 4. Fetch template ──────────────────────────────────────────────────────
  const svc = createServiceClient()
  const { data: template, error: tplError } = await svc
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (tplError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // ── 5. Pre-deploy validation ───────────────────────────────────────────────
  const { valid, errors, warnings } = validateDeployReady(
    siteData,
    template.manifest,
    projectName
  )
  if (!valid) {
    return NextResponse.json({ error: 'Validation failed', errors, warnings }, { status: 400 })
  }

  // ── 6. Create / update deployment record ──────────────────────────────────
  let deployment: any

  if (isRepublish) {
    const { data: existing, error: depError } = await svc
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single()

    if (depError || !existing) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 })
    }

    // Only allow republish from terminal states (auto-cancel if zombie)
    if (!['live', 'failed'].includes(existing.status)) {
      const ageMs = Date.now() - new Date(existing.updated_at).getTime()
      const isZombie =
        (existing.status === 'deploying' && ageMs > 5 * 60 * 1000) ||
        (existing.status === 'building'  && ageMs > 10 * 60 * 1000)
      if (!isZombie) {
        return NextResponse.json(
          { error: `Cannot republish: deployment is currently "${existing.status}". Wait for it to finish or retry after failure.` },
          { status: 409 }
        )
      }
      // Zombie — mark as failed so the optimistic update below can proceed
      await svc
        .from('deployments')
        .update({
          status: 'failed' as const,
          error_message: 'Deployment timed out. Auto-cancelled.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deploymentId)
        .in('status', ['deploying', 'building'])
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
      .in('status', ['live', 'failed'])
      .select('*')
      .maybeSingle()

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update deployment' }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'Deployment is already being redeployed by another request. Please wait.' },
        { status: 409 }
      )
    }
    deployment = updated
  } else {
    const { data: slugData, error: slugError } = await svc
      .rpc('generate_unique_slug', { project_name: projectName })
    if (slugError || !slugData) {
      return NextResponse.json({ error: 'Failed to generate site slug' }, { status: 500 })
    }
    const slug = slugData as string

    const { data: created, error: insertErr } = await svc
      .from('deployments')
      .insert({
        project_name: projectName,
        slug,
        template_id: templateId,
        template_version: template.version,
        template_manifest: template.manifest,
        site_data: siteData,
        status: 'deploying',
        site_token: crypto.randomUUID(),
        deployed_by: user.id,
      })
      .select('*')
      .single()

    if (insertErr || !created) {
      return NextResponse.json({ error: 'Failed to create deployment record' }, { status: 500 })
    }
    deployment = created
  }

  // ── 7. Return deploymentId — pipeline runs in /api/deploy/[id]/stream ──────
  return NextResponse.json(
    { deploymentId: deployment.id, slug: deployment.slug },
    { status: 201 }
  )
}
