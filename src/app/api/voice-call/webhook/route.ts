import { type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { apiError, apiOk } from '@/lib/api/response'
import { env } from '@/lib/env'
import { log } from '@/lib/log'

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

type SubmissionFollowUpState = {
  id: string
  attended_by: string | null
  call_notes: string | null
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
    log.event('warn', 'voice.webhook.invalid_signature', 'Rejected ElevenLabs webhook with invalid signature')
    return apiError('Invalid signature', 401)
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    log.event('warn', 'voice.webhook.invalid_json', 'Rejected ElevenLabs webhook with invalid JSON')
    return apiError('Invalid JSON', 400)
  }
  // ElevenLabs post_call_transcription wraps everything under `data`
  const data = (
    payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload
  ) as WebhookData
  const conversationId = typeof data.conversation_id === 'string' ? data.conversation_id : ''

  if (!conversationId) {
    log.event('warn', 'voice.webhook.missing_conversation_id', 'Rejected ElevenLabs webhook without conversation_id')
    return apiError('Missing conversation_id', 400)
  }

  // 2. Find submission by conversation ID
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: submission, error: submissionError } = await supabase
    .from('form_submissions')
    .select('id, attended_by, call_notes')
    .eq('elevenlabs_conversation_id', conversationId)
    .single()
  const followUpState = submission as SubmissionFollowUpState | null

  if (submissionError) {
    log.event('warn', 'voice.webhook.submission_lookup_failed', submissionError.message, {
      conversationId,
    })
    if (submissionError.code !== 'PGRST116') {
      return apiError(submissionError.message, 500)
    }
  }

  if (!followUpState) {
    log.event('warn', 'voice.webhook.submission_not_found', 'No submission matched ElevenLabs conversation_id', {
      conversationId,
    })
    return apiError('Submission not found', 404)
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

  // 5. Store only what the admin panel needs for follow-up.
  const summary = typeof data.analysis?.transcript_summary === 'string'
    ? data.analysis.transcript_summary
    : ''

  // 6. Update form_submission with results
  const completedAt = new Date().toISOString()
  const update: Record<string, unknown> = {
    call_status: callStatus,
    call_completed_at: completedAt,
    call_transcript_raw: payload,
    call_transcript_text: transcript || null,
  }

  if (callStatus === 'completed' && followUpState.attended_by !== 'manual') {
    update.attended_by = 'automated'
    update.attended_user_id = null
    update.attended_at = completedAt
    update.lead_status = 'attended'
    update.call_notes = summary || followUpState.call_notes || null
  }

  const { error: updateError } = await supabase
    .from('form_submissions')
    .update(update)
    .eq('id', followUpState.id)

  if (updateError) {
    log.event('error', 'voice.webhook.update_failed', 'Failed to persist ElevenLabs webhook result', {
      submissionId: followUpState.id,
      conversationId,
      reason: updateError.message,
    })
    return apiError(updateError.message, 500)
  }

  return apiOk({ status: 'ok' })
}
