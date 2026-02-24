import { NextRequest, NextResponse } from 'next/server'
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
    .select('id, project_name, template_slug, template_id, current_step, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * POST /api/drafts — Upsert a draft (insert or update by user_id + project_name)
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
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
  } = body

  if (!project_name || !template_slug) {
    return NextResponse.json(
      { error: 'project_name and template_slug are required' },
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
        last_active_page: last_active_page ?? 'home',
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
