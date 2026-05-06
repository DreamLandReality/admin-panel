import { type NextRequest } from 'next/server'
import { requireCapability } from '@/lib/api/auth'
import { apiData, apiError } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'

/**
 * GET /api/drafts — List all drafts for the authenticated user
 */
export async function GET() {
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from('drafts')
    .select('id, project_name, template_slug, template_id, current_step, updated_at, deployment_id, screenshot_url, deployments(project_name, screenshot_url, status), templates(preview_url)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return apiError(error.message, 500)
  }

  return apiData(data)
}

/**
 * POST /api/drafts — Upsert a draft
 *
 * Two modes depending on whether deployment_id is present:
 *
 * 1. New-site draft (deployment_id absent):
 *    Upsert by (user_id, project_name). project_name is required.
 *
 * 2. Edit-site draft (deployment_id present):
 *    SELECT-first, then UPDATE or INSERT. project_name stored as NULL
 *    (resolved via deployment join for display). deployment_id is required.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const bodyResult = await parseJsonRecordBody(request)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.data
  const {
    deployment_id,
    project_name,
    template_slug,
    template_id,
    current_step,
    raw_text,
    section_data,
    sections_registry,
    collection_data,
    site_slug,
    last_active_page,
    screenshot_url,
  } = body

  if (typeof template_slug !== 'string' || !template_slug) {
    return apiError('template_slug is required', 400)
  }

  // ── Edit-site draft path ──────────────────────────────────────────────────
  if (typeof deployment_id === 'string' && deployment_id) {
    const record = {
      user_id: user.id,
      deployment_id,
      project_name: null as null,   // resolved via deployment join — not stored
      template_slug,
      template_id: typeof template_id === 'string' ? template_id : null,
      current_step: typeof current_step === 'number' ? current_step : 3,
      raw_text: typeof raw_text === 'string' ? raw_text : '',
      section_data: section_data ?? {},
      sections_registry: sections_registry ?? {},
      collection_data: collection_data ?? {},
      site_slug: typeof site_slug === 'string' ? site_slug : null,
      last_active_page: typeof last_active_page === 'string' ? last_active_page : null,
      screenshot_url: typeof screenshot_url === 'string' ? screenshot_url : null,
      updated_at: new Date().toISOString(),
    }

    // Check whether an edit draft already exists for this deployment
    const { data: existing, error: existingError } = await supabase
      .from('drafts')
      .select('id')
      .eq('user_id', user.id)
      .eq('deployment_id', deployment_id)
      .maybeSingle()

    if (existingError) {
      return apiError(existingError.message, 500)
    }

    if (existing) {
      const { data, error } = await supabase
        .from('drafts')
        .update(record)
        .eq('id', existing.id)
        .select('id')
        .single()

      if (error) {
        return apiError(error.message, 500)
      }
      return apiData(data)
    } else {
      const { data, error } = await supabase
        .from('drafts')
        .insert(record)
        .select('id')
        .single()

      if (error) {
        return apiError(error.message, 500)
      }
      return apiData(data)
    }
  }

  // ── New-site draft path ───────────────────────────────────────────────────
  if (typeof project_name !== 'string' || !project_name) {
    return apiError('project_name is required for new-site drafts', 400)
  }

  const { data, error } = await supabase
    .from('drafts')
    .upsert(
      {
        user_id: user.id,
        project_name,
        template_slug,
        template_id: typeof template_id === 'string' ? template_id : null,
        current_step: typeof current_step === 'number' ? current_step : 3,
        raw_text: typeof raw_text === 'string' ? raw_text : '',
        section_data: section_data ?? {},
        sections_registry: sections_registry ?? {},
        collection_data: collection_data ?? {},
        site_slug: typeof site_slug === 'string' ? site_slug : null,
        last_active_page: typeof last_active_page === 'string' ? last_active_page : null,
        screenshot_url: typeof screenshot_url === 'string' ? screenshot_url : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,project_name' }
    )
    .select('id')
    .single()

  if (error) {
    return apiError(error.message, 500)
  }

  return apiData(data)
}
