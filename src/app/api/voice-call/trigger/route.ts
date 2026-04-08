import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { normalizePhone } from '@/lib/utils/phone'

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

  const { submission_id, phone, name, deployment_slug, property_name } = JSON.parse(body)

  // 2. Service-role client (bypasses RLS)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // 3. Check submission hasn't been cancelled
  const { data: submission } = await supabase
    .from('form_submissions')
    .select('call_status, call_attempts')
    .eq('id', submission_id)
    .single()

  if (!submission || submission.call_status === 'cancelled') {
    return NextResponse.json({ status: 'cancelled' })
  }

  // 4. Normalize phone number
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    await supabase
      .from('form_submissions')
      .update({ call_status: 'skipped' })
      .eq('id', submission_id)
    return NextResponse.json({ status: 'skipped', reason: 'invalid_phone' })
  }

  // 5. Call ElevenLabs outbound call API
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
        to_number: normalizedPhone,
        conversation_config_override: {
          agent: {
            prompt: {
              prompt: `The caller's name is ${name}. They enquired about "${property_name}" on website ${deployment_slug}. Greet them by name and reference this property.`,
            },
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
      .eq('id', submission_id)
    return NextResponse.json({ error }, { status: 500 })
  }

  const result = await response.json()

  // 6. Update submission
  await supabase
    .from('form_submissions')
    .update({
      call_status: 'calling',
      elevenlabs_conversation_id: result.conversation_id,
      call_attempts: (submission.call_attempts || 0) + 1,
    })
    .eq('id', submission_id)

  return NextResponse.json({ status: 'calling', conversation_id: result.conversation_id })
}
