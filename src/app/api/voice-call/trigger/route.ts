import { type NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { normalizePhone } from '@/lib/utils/phone'
import { buildPropertyCallPrompt } from '@/prompts'

type TriggerBody = {
  submission_id?: unknown
  phone?: unknown
  name?: unknown
  property_name?: unknown
}

type OutboundCallResponse = {
  success?: boolean
  message?: string
  conversation_id?: string | null
  callSid?: string | null
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/**
 * POST /api/voice-call/trigger
 * Called by QStash after the scheduled delay expires.
 * Initiates an outbound call via ElevenLabs Conversational AI.
 */
export async function POST(req: NextRequest) {
  // 1. Verify QStash signature
  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  })

  const body = await req.text()

  try {
    const isValid = await receiver.verify({
      signature: req.headers.get('upstash-signature') ?? '',
      body,
    })
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let parsed: TriggerBody
  try {
    parsed = JSON.parse(body) as TriggerBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const submissionId = getString(parsed.submission_id)
  const name = getString(parsed.name, 'there')
  const propertyName = getString(parsed.property_name, 'the property')
  if (!submissionId) {
    return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })
  }

  // 2. Service-role client (bypasses RLS)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // 3. Check submission hasn't been cancelled
  const { data: submission } = await supabase
    .from('form_submissions')
    .select('call_status, call_attempts, call_property_context')
    .eq('id', submissionId)
    .single()

  if (!submission || submission.call_status === 'cancelled') {
    return NextResponse.json({ status: 'cancelled' })
  }

  // 4. Normalize phone number
  const toNumber = env.VOICE_AGENT_DEV_MODE
    ? normalizePhone(env.ELEVENLABS_DEV_TO_NUMBER)
    : normalizePhone(getString(parsed.phone))

  if (!toNumber) {
    await supabase
      .from('form_submissions')
      .update({ call_status: 'skipped' })
      .eq('id', submissionId)
    return NextResponse.json({ status: 'skipped', reason: env.VOICE_AGENT_DEV_MODE ? 'invalid_dev_phone' : 'invalid_phone' })
  }

  // 5. Read property context built server-side by the submit-form edge function
  const propertyContext = submission.call_property_context ?? ''

  // 6. Call ElevenLabs outbound call API
  const response = await fetch(
    'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: env.ELEVENLABS_AGENT_ID,
        agent_phone_number_id: env.ELEVENLABS_AGENT_PHONE_NUMBER_ID,
        to_number: toNumber,
        conversation_initiation_client_data: {
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: buildPropertyCallPrompt({
                  callerName: name,
                  propertyName,
                  propertyContext,
                }),
              },
            },
          },
          dynamic_variables: {
            caller_name: name,
            property_name: propertyName,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[voice-call/trigger] ElevenLabs error:', error)
    await supabase
      .from('form_submissions')
      .update({
        call_status: 'failed',
        call_attempts: (submission.call_attempts || 0) + 1,
      })
      .eq('id', submissionId)
    return NextResponse.json({ error }, { status: 500 })
  }

  const result = await response.json().catch(() => null) as OutboundCallResponse | null
  const conversationId = typeof result?.conversation_id === 'string' ? result.conversation_id : ''

  if (!conversationId || result?.success === false) {
    const errorMessage = result?.message ?? 'ElevenLabs did not return a conversation_id'
    console.error('[voice-call/trigger] ElevenLabs unusable response:', result)
    await supabase
      .from('form_submissions')
      .update({
        call_status: 'failed',
        call_attempts: (submission.call_attempts || 0) + 1,
      })
      .eq('id', submissionId)
    return NextResponse.json({ error: errorMessage }, { status: 502 })
  }

  // 7. Update submission
  await supabase
    .from('form_submissions')
    .update({
      call_status: 'calling',
      elevenlabs_conversation_id: conversationId,
      call_attempts: (submission.call_attempts || 0) + 1,
    })
    .eq('id', submissionId)

  return NextResponse.json({ status: 'calling', conversation_id: conversationId })
}
