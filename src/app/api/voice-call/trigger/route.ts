import { type NextRequest } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createClient } from '@supabase/supabase-js'
import { apiError, apiOk } from '@/lib/api/response'
import { env } from '@/lib/env'
import { log } from '@/lib/log'
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

type VoiceSettings = {
  voiceAgentEnabled: boolean
  devModeEnabled: boolean
  source: 'database' | 'env_fallback'
}

type VoiceSettingsRow = {
  voice_agent_enabled: boolean | null
  dev_mode_enabled: boolean | null
}

type VoiceSettingsDatabase = {
  public: {
    Tables: {
      voice_settings: {
        Row: VoiceSettingsRow
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type SubmissionUpdateClient = {
  from(table: 'form_submissions'): {
    update(values: Record<string, unknown>): {
      eq(column: 'id', value: string): PromiseLike<{ error: { message: string } | null }>
    }
  }
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function getErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function getEnvVoiceSettings(): VoiceSettings {
  return {
    voiceAgentEnabled: env.VOICE_AGENT_ENABLED,
    devModeEnabled: env.VOICE_AGENT_DEV_MODE,
    source: 'env_fallback',
  }
}

async function resolveVoiceSettings(): Promise<VoiceSettings> {
  const settingsClient = createClient<VoiceSettingsDatabase>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await settingsClient
    .from('voice_settings')
    .select('voice_agent_enabled, dev_mode_enabled')
    .eq('id', true)
    .maybeSingle()

  if (error || !data) {
    // Env fallback keeps local/bootstrap triggers working before the singleton row exists.
    log.event('warn', 'voice.trigger.settings_fallback', 'Voice settings lookup failed; using environment fallback', {
      reason: error?.message ?? 'missing row',
    })
    return getEnvVoiceSettings()
  }

  return {
    voiceAgentEnabled: data.voice_agent_enabled === true,
    devModeEnabled: data.dev_mode_enabled === true,
    source: 'database',
  }
}

async function updateSubmissionStatus(
  supabase: SubmissionUpdateClient,
  submissionId: string,
  update: Record<string, unknown>,
  event: string
): Promise<string | null> {
  const { error } = await supabase
    .from('form_submissions')
    .update(update)
    .eq('id', submissionId)

  if (!error) return null

  log.event('error', event, 'Failed to update voice call submission state', {
    submissionId,
    reason: error.message,
  })
  return error.message
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
      log.event('warn', 'voice.trigger.invalid_signature', 'Rejected QStash trigger with invalid signature')
      return apiError('Invalid signature', 401)
    }
  } catch {
    log.event('warn', 'voice.trigger.invalid_signature', 'Rejected QStash trigger during signature verification')
    return apiError('Invalid signature', 401)
  }

  let parsed: TriggerBody
  try {
    parsed = JSON.parse(body) as TriggerBody
  } catch {
    log.event('warn', 'voice.trigger.invalid_json', 'Rejected QStash trigger with invalid JSON')
    return apiError('Invalid JSON', 400)
  }

  const submissionId = getString(parsed.submission_id)
  const name = getString(parsed.name, 'there')
  const propertyName = getString(parsed.property_name, 'the property')
  if (!submissionId) {
    log.event('warn', 'voice.trigger.missing_submission_id', 'Rejected QStash trigger without submission_id')
    return apiError('Missing submission_id', 400)
  }

  // 2. Service-role client (bypasses RLS)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // 3. Check submission hasn't been cancelled
  const { data: submission, error: submissionError } = await supabase
    .from('form_submissions')
    .select('call_status, call_attempts, call_property_context')
    .eq('id', submissionId)
    .single()

  if (submissionError) {
    log.event('error', 'voice.trigger.submission_lookup_failed', 'Failed to load submission for voice trigger', {
      submissionId,
      reason: submissionError.message,
    })
    return apiError(submissionError.message, 500)
  }

  if (!submission || submission.call_status === 'cancelled') {
    return apiOk({ status: 'cancelled' })
  }

  const voiceSettings = await resolveVoiceSettings()
  if (!voiceSettings.voiceAgentEnabled) {
    const updateError = await updateSubmissionStatus(
      supabase,
      submissionId,
      { call_status: 'skipped' },
      'voice.trigger.skip_update_failed'
    )
    if (updateError) return apiError(updateError, 500)
    return apiOk({ status: 'skipped', reason: 'voice_disabled' })
  }

  // 4. Normalize phone number
  if (voiceSettings.devModeEnabled) {
    log.event('info', 'voice.trigger.dev_mode', 'Voice trigger dev mode enabled')
  }

  const toNumber = voiceSettings.devModeEnabled
    ? normalizePhone(env.ELEVENLABS_DEV_TO_NUMBER)
    : normalizePhone(getString(parsed.phone))

  if (!toNumber) {
    const updateError = await updateSubmissionStatus(
      supabase,
      submissionId,
      { call_status: 'skipped' },
      'voice.trigger.invalid_phone_update_failed'
    )
    if (updateError) return apiError(updateError, 500)
    return apiOk({ status: 'skipped', reason: voiceSettings.devModeEnabled ? 'invalid_dev_phone' : 'invalid_phone' })
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
    log.event('error', 'voice.trigger.elevenlabs_error', 'ElevenLabs outbound call request failed', {
      submissionId,
      status: response.status,
      reason: error.slice(0, 500),
    })
    const updateError = await updateSubmissionStatus(
      supabase,
      submissionId,
      {
        call_status: 'failed',
        call_attempts: (submission.call_attempts || 0) + 1,
      },
      'voice.trigger.elevenlabs_error_update_failed'
    )
    if (updateError) return apiError(updateError, 500)
    return apiError(error, 500)
  }

  const result = await response.json().catch(() => null) as OutboundCallResponse | null
  const conversationId = typeof result?.conversation_id === 'string' ? result.conversation_id : ''

  if (!conversationId || result?.success === false) {
    const errorMessage = result?.message ?? 'ElevenLabs did not return a conversation_id'
    log.event('error', 'voice.trigger.unusable_response', 'ElevenLabs outbound call response was not usable', {
      submissionId,
      reason: getErrorMessage(errorMessage),
    })
    const updateError = await updateSubmissionStatus(
      supabase,
      submissionId,
      {
        call_status: 'failed',
        call_attempts: (submission.call_attempts || 0) + 1,
      },
      'voice.trigger.unusable_response_update_failed'
    )
    if (updateError) return apiError(updateError, 500)
    return apiError(errorMessage, 502)
  }

  // 7. Update submission
  const updateError = await updateSubmissionStatus(
    supabase,
    submissionId,
    {
      call_status: 'calling',
      elevenlabs_conversation_id: conversationId,
      call_attempts: (submission.call_attempts || 0) + 1,
    },
    'voice.trigger.calling_update_failed'
  )
  if (updateError) return apiError(updateError, 500)

  return apiOk({ status: 'calling', conversation_id: conversationId })
}
