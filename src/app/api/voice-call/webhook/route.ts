import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

const WEBHOOK_TOLERANCE_SECONDS = 30 * 60

type WebhookData = {
  conversation_id?: unknown
  metadata?: { call_duration_secs?: unknown }
  analysis?: {
    call_successful?: unknown
    transcript_summary?: unknown
  }
  status?: unknown
  transcript?: unknown
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function verifyElevenLabsSignature(body: string, signature: string | null): boolean {
  if (!signature) return false

  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, ...valueParts] = part.trim().split('=')
      return [key, valueParts.join('=')]
    })
  )
  const timestamp = parts.t
  const signatureValue = parts.v0
  if (!timestamp || !signatureValue) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds)
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS) return false

  const expected = crypto
    .createHmac('sha256', env.ELEVENLABS_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  return timingSafeEqualHex(signatureValue, expected)
}

/**
 * POST /api/voice-call/webhook
 * Called by ElevenLabs when a conversation ends.
 * Stores transcript and collected data back into form_submissions.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()

  // 1. Verify ElevenLabs webhook signature (required)
  const signature = req.headers.get('elevenlabs-signature')
  if (!verifyElevenLabsSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  // ElevenLabs post_call_transcription wraps everything under `data`
  const data = (
    payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload
  ) as WebhookData
  const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : ''

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
  const durationSecs = typeof data.metadata?.call_duration_secs === 'number'
    ? data.metadata.call_duration_secs
    : 0
  const callSuccessful = typeof data.analysis?.call_successful === 'string'
    ? data.analysis.call_successful
    : ''
  let callStatus = 'completed'
  if (durationSecs === 0 || callSuccessful === 'failure') {
    callStatus = 'no_answer'
  } else if (data.status === 'error') {
    callStatus = 'failed'
  }

  // 4. Build clean transcript — skip tool_call/tool_result turns (message is null)
  type Turn = { role: string; message: string | null }
  const transcript = (Array.isArray(data.transcript) ? data.transcript as Turn[] : [])
    .filter((m) => m.message)
    .map((m) => `${m.role === 'agent' ? 'Agent' : 'User'}: ${m.message}`)
    .join('\n')

  // 5. Store only what the admin panel needs — summary + outcome
  const summary = typeof data.analysis?.transcript_summary === 'string'
    ? data.analysis.transcript_summary
    : ''
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
