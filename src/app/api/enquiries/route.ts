import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/enquiries
 * Returns all form submissions joined with deployment project_name, newest first.
 * Also includes a top-level unreadCount for sidebar badge.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('form_submissions')
    .select('*, deployments(project_name)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unreadCount = (data ?? []).filter((s) => !s.is_read).length

  const callStats = {
    scheduled: (data ?? []).filter((s: any) => s.call_status === 'scheduled').length,
    completed: (data ?? []).filter((s: any) => s.call_status === 'completed').length,
    failed: (data ?? []).filter((s: any) => ['failed', 'no_answer'].includes(s.call_status)).length,
  }

  return NextResponse.json({ data: data ?? [], unreadCount, callStats })
}

/**
 * PATCH /api/enquiries
 * Marks a single form submission as read.
 * Body: { id: string }
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('form_submissions')
    .update({ is_read: true })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
