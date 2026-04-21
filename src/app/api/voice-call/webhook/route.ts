import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * POST /api/voice-call/webhook
 * Called by ElevenLabs when a conversation ends.
 * Stores transcript and collected data back into form_submissions.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()

  // 1. Verify ElevenLabs webhook signature (required)
  const signature = req.headers.get('x-elevenlabs-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }
  const expected = crypto
    .createHmac('sha256', env.ELEVENLABS_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  // ElevenLabs post_call_transcription wraps everything under `data`
  const data = payload.data ?? payload
  const conversationId = data.conversation_id

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })
  }

  // 2. Find submission by conversation ID
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: submission } = await supabase
    .from('form_submissions')
    .select('id')
    .eq('elevenlabs_conversation_id', conversationId)
    .single()

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  // 3. Determine call outcome
  const durationSecs: number = data.metadata?.call_duration_secs ?? 0
  const callSuccessful: string = data.analysis?.call_successful ?? ''
  let callStatus = 'completed'
  if (durationSecs === 0 || callSuccessful === 'failure') {
    callStatus = 'no_answer'
  } else if (data.status === 'error') {
    callStatus = 'failed'
  }

  // 4. Build clean transcript — skip tool_call/tool_result turns (message is null)
  type Turn = { role: string; message: string | null }
  const transcript = ((data.transcript as Turn[]) || [])
    .filter((m) => m.message)
    .map((m) => `${m.role === 'agent' ? 'Agent' : 'User'}: ${m.message}`)
    .join('\n')

  // 5. Store only what the admin panel needs — summary + outcome
  const summary: string = data.analysis?.transcript_summary ?? ''
  const callInsights: Record<string, string> = {}
  if (summary) callInsights.summary = summary
  if (callSuccessful) callInsights.outcome = callSuccessful === 'success' ? 'Successful' : 'Unsuccessful'

  // 6. Update form_submission with results
  await supabase
    .from('form_submissions')
    .update({
      call_status: callStatus,
      call_completed_at: new Date().toISOString(),
      call_transcript: transcript || null,
      call_collected_data: Object.keys(callInsights).length ? callInsights : null,
      call_duration_seconds: durationSecs,
    })
    .eq('id', submission.id)

  return NextResponse.json({ status: 'ok' })
}
