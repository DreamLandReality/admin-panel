import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * PATCH /api/voice-call/[id]
 * Admin actions: retry or cancel a voice call.
 * Body: { action: 'retry' | 'cancel' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth check (same pattern as /api/enquiries)
  const authClient = createAuthClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { action } = await req.json()
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  if (action === 'cancel') {
    const { error } = await supabase
      .from('form_submissions')
      .update({ call_status: 'cancelled' })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ status: 'cancelled' })
  }

  if (action === 'retry') {
    // Fetch submission to get phone + context
    const { data: sub } = await supabase
      .from('form_submissions')
      .select('phone, name, deployment_slug, deployments(project_name), call_status')
      .eq('id', id)
      .single()

    if (!sub || !sub.phone) {
      return NextResponse.json({ error: 'No phone number' }, { status: 400 })
    }

    // Only retry if in a retryable state
    if (!['failed', 'no_answer', 'cancelled'].includes(sub.call_status)) {
      return NextResponse.json({ error: 'Not retryable in current state' }, { status: 400 })
    }

    // Schedule via QStash with 60s delay (near-immediate retry)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const qstashToken = process.env.QSTASH_TOKEN
    if (!appUrl || !qstashToken) {
      return NextResponse.json({ error: 'Voice agent not configured' }, { status: 500 })
    }

    const triggerUrl = `${appUrl}/api/voice-call/trigger`
    const qstashRes = await fetch(`https://qstash.upstash.io/v1/publish/${triggerUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '60s',
        'Upstash-Retries': '2',
      },
      body: JSON.stringify({
        submission_id: id,
        phone: sub.phone,
        name: sub.name,
        deployment_slug: sub.deployment_slug,
        property_name: ((sub as any).deployments?.project_name as string) ?? sub.deployment_slug,
      }),
    })

    if (!qstashRes.ok) {
      const err = await qstashRes.text()
      console.error('[voice-call/retry] QStash error:', err)
      return NextResponse.json({ error: 'Failed to schedule retry' }, { status: 500 })
    }

    await supabase
      .from('form_submissions')
      .update({
        call_status: 'scheduled',
        call_scheduled_at: new Date().toISOString(),
        call_scheduled_for: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ status: 'scheduled' })
  }

  if (action === 'clear_signed_url') {
    const { error } = await supabase
      .from('form_submissions')
      .update({ call_signed_url: null })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ status: 'ok' })
  }

  if (action === 'complete_dev_call') {
    const { error } = await supabase
      .from('form_submissions')
      .update({
        call_status: 'completed',
        call_completed_at: new Date().toISOString(),
        call_signed_url: null,
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ status: 'completed' })
  }

  return NextResponse.json({ error: 'Invalid action. Use "retry", "cancel", or "clear_signed_url".' }, { status: 400 })
}
