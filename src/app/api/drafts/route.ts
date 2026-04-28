import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/drafts — List all drafts for the authenticated user
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('drafts')
    .select('id, project_name, template_slug, template_id, current_step, updated_at, deployment_id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
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
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
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

  if (!template_slug) {
    return NextResponse.json({ error: 'template_slug is required' }, { status: 400 })
  }

  // ── Edit-site draft path ──────────────────────────────────────────────────
  if (deployment_id) {
    const record = {
      user_id: user.id,
      deployment_id,
      project_name: null as null,   // resolved via deployment join — not stored
      template_slug,
      template_id: template_id ?? null,
      current_step: current_step ?? 3,
      raw_text: raw_text ?? '',
      section_data: section_data ?? {},
      sections_registry: sections_registry ?? {},
      collection_data: collection_data ?? {},
      site_slug: site_slug ?? null,
      last_active_page: last_active_page ?? null,
      screenshot_url: screenshot_url ?? null,
      updated_at: new Date().toISOString(),
    }

    // Check whether an edit draft already exists for this deployment
    const { data: existing } = await supabase
      .from('drafts')
      .select('id')
      .eq('user_id', user.id)
      .eq('deployment_id', deployment_id)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('drafts')
        .update(record)
        .eq('id', existing.id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data })
    } else {
      const { data, error } = await supabase
        .from('drafts')
        .insert(record)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data })
    }
  }

  // ── New-site draft path ───────────────────────────────────────────────────
  if (!project_name) {
    return NextResponse.json(
      { error: 'project_name is required for new-site drafts' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('drafts')
    .upsert(
      {
        user_id: user.id,
        project_name,
        template_slug,
        template_id: template_id ?? null,
        current_step: current_step ?? 3,
        raw_text: raw_text ?? '',
        section_data: section_data ?? {},
        sections_registry: sections_registry ?? {},
        collection_data: collection_data ?? {},
        site_slug: site_slug ?? null,
        last_active_page: last_active_page ?? null,
        screenshot_url: screenshot_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,project_name' }
    )
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
