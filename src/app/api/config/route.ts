import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'

const configLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

/**
 * GET /api/config
 * Returns server-side feature flags for client consumption.
 * Requires authentication — never exposes secrets, only boolean flags.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited, resetMs } = configLimiter.check(user.id)
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(resetMs / 1000)),
          'X-RateLimit-Limit': String(configLimiter.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''
  const googleKey = process.env.GOOGLE_API_KEY ?? ''
  const isRealAnthropicKey = anthropicKey.startsWith('sk-ant-') && anthropicKey.length > 50
  const isRealGoogleKey = googleKey.startsWith('AIza') && googleKey.length > 30

  return NextResponse.json({
    isAiConfigured: !!(isRealAnthropicKey && process.env.ANTHROPIC_PARSE_MODEL),
    isGeminiConfigured: !!(isRealGoogleKey && process.env.GEMINI_PARSE_MODEL),
    isDeployConfigured: !!(
      process.env.GITHUB_TOKEN &&
      process.env.GITHUB_ORG &&
      process.env.CLOUDFLARE_API_TOKEN &&
      process.env.CLOUDFLARE_ACCOUNT_ID
    ),
    isVoiceAgentConfigured: !!(
      process.env.ELEVENLABS_API_KEY &&
      process.env.ELEVENLABS_AGENT_ID &&
      process.env.QSTASH_TOKEN
    ),
  })
}
