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

  // 1. Verify ElevenLabs webhook signature
  const signature = req.headers.get('x-elevenlabs-signature')
  if (signature) {
    const expected = crypto
      .createHmac('sha256', env.ELEVENLABS_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body)
  const conversationId = payload.conversation_id

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
  let callStatus = 'completed'
  if (payload.status === 'no_answer' || payload.call_duration_seconds === 0) {
    callStatus = 'no_answer'
  } else if (payload.status === 'failed') {
    callStatus = 'failed'
  }

  // 4. Build transcript from messages
  const transcript = (payload.messages || [])
    .map((m: { role: string; content: string }) =>
      `${m.role === 'agent' ? 'Agent' : 'User'}: ${m.content}`
    )
    .join('\n')

  // 5. Update form_submission with results
  await supabase
    .from('form_submissions')
    .update({
      call_status: callStatus,
      call_completed_at: new Date().toISOString(),
      call_transcript: transcript || null,
      call_collected_data: payload.collected_variables || {},
      call_duration_seconds: payload.call_duration_seconds || 0,
    })
    .eq('id', submission.id)

  return NextResponse.json({ status: 'ok' })
}
