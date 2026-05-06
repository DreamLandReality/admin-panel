import { type NextRequest } from 'next/server'
import { requireCapability } from '@/lib/api/auth'
import { apiData, apiError, apiOk } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'
import { deleteProject } from '@/lib/deploy/cloudflare'
import type { SiteData } from '@/types'

type RouteContext = { params: { id: string } }

function getNestedString(source: Record<string, unknown>, path: string): string | null {
  let current: unknown = source
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : null
}

/**
 * GET /api/deployments/[id]
 * Returns the deployment row and its template.
 * Used by client components that need to bootstrap the editor.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { data: deployment, error: depError } = await supabase
    .from('deployments')
    .select('*')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .single()

  if (depError || !deployment) {
    return apiError('Not found', 404)
  }

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', deployment.template_id)
    .maybeSingle()

  if (templateError) {
    return apiError(templateError.message, 500)
  }

  return apiData({ deployment, template })
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
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const bodyResult = await parseJsonRecordBody(req)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.data
  const site_data = body.site_data as SiteData | undefined
  const action = body.action as 'save' | 'republish' | 'cancel' | undefined

  if (!site_data || !action) {
    return apiError('site_data and action are required', 400)
  }

  // Verify ownership before writing
  const { data: existing, error: existingError } = await supabase
    .from('deployments')
    .select('id')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .maybeSingle()

  if (existingError) {
    return apiError(existingError.message, 500)
  }

  if (!existing) {
    return apiError('Not found', 404)
  }

  if (action === 'republish') {
    return apiError('republish via PATCH is not yet implemented — use POST /api/deploy', 501)
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
      return apiError(cancelErr.message, 500)
    }
    if (!cancelled) {
      return apiError('Deployment is not in progress — cannot cancel.', 409)
    }
    return apiData(cancelled)
  }

  // Extract screenshot from site_data using the same fallback logic as the deploy pipeline
  const siteDataRecord = site_data as Record<string, unknown>
  const extractedScreenshot: string | null =
    (getNestedString(siteDataRecord, 'seo.image')?.startsWith('http') ? getNestedString(siteDataRecord, 'seo.image') : null) ??
    (getNestedString(siteDataRecord, 'hero.backgroundImage')?.startsWith('http') ? getNestedString(siteDataRecord, 'hero.backgroundImage') : null) ??
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
      .eq('deployed_by', user.id)
      .select('id, status, has_unpublished_changes, updated_at')
      .single()

  if (error) {
    return apiError(error.message, 500)
  }

  return apiData(data)
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
  const auth = await requireCapability('canManageSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { data: deployment, error: fetchError } = await supabase
    .from('deployments')
    .select('id, status, cloudflare_project_name')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .single()

  if (fetchError || !deployment) {
    return apiError('Not found', 404)
  }

  if (deployment.status !== 'live') {
    return apiError('Only live deployments can be deleted', 400)
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
    .eq('deployed_by', user.id)

  if (updateError) {
    return apiError(updateError.message, 500)
  }

  return apiOk({ status: 'archived' })
}
