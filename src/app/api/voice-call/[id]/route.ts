import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

type VoiceRetrySubmission = {
  phone: string | null
  name: string | null
  deployment_slug: string
  call_status: string
  deployments:
    | { project_name?: string | null }
    | { project_name?: string | null }[]
    | null
}

function getDeploymentProjectName(submission: VoiceRetrySubmission): string {
  const deployment = Array.isArray(submission.deployments)
    ? submission.deployments[0]
    : submission.deployments

  return deployment?.project_name ?? submission.deployment_slug
}

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
  let body: { action?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { action } = body
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
    const { data: rawSub } = await supabase
      .from('form_submissions')
      .select('phone, name, deployment_slug, deployments(project_name), call_status')
      .eq('id', id)
      .single()
    const sub = rawSub as VoiceRetrySubmission | null

    if (!sub) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Only retry if in a retryable state
    if (!['failed', 'no_answer', 'cancelled'].includes(sub.call_status)) {
      return NextResponse.json({ error: 'Not retryable in current state' }, { status: 400 })
    }

    const isDevMode = process.env.VOICE_AGENT_DEV_MODE === 'true'
    if (!isDevMode && !sub.phone) {
      return NextResponse.json({ error: 'No phone number' }, { status: 400 })
    }

    // Schedule via QStash. Dev mode has no delay and the trigger calls ELEVENLABS_DEV_TO_NUMBER.
    const appUrl = process.env.ADMIN_PANEL_URL
    const qstashToken = env.QSTASH_TOKEN
    if (!appUrl || !qstashToken) {
      return NextResponse.json({ error: 'Voice agent not configured' }, { status: 500 })
    }

    const triggerUrl = `${appUrl}/api/voice-call/trigger`
    const retryDelaySeconds = isDevMode ? 0 : 60
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${qstashToken}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': '2',
    }
    if (retryDelaySeconds > 0) {
      headers['Upstash-Delay'] = `${retryDelaySeconds}s`
    }

    const qstashRes = await fetch(`https://qstash.upstash.io/v1/publish/${triggerUrl}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        submission_id: id,
        phone: sub.phone,
        name: sub.name,
        deployment_slug: sub.deployment_slug,
        property_name: getDeploymentProjectName(sub),
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
        call_scheduled_for: new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ status: 'scheduled' })
  }

  return NextResponse.json({ error: 'Invalid action. Use "retry" or "cancel".' }, { status: 400 })
}
