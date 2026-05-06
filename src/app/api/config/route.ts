import { requireUser } from '@/lib/api/auth'
import { apiData, tooManyRequests } from '@/lib/api/response'
import { createRateLimiter } from '@/lib/rate-limit'

const configLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

/**
 * GET /api/config
 * Returns server-side feature flags for client consumption.
 * Requires authentication — never exposes secrets, only boolean flags.
 */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const { limited, resetMs } = configLimiter.check(user.id)
  if (limited) {
    return tooManyRequests('Too many requests', resetMs, configLimiter.limit)
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''
  const googleKey = process.env.GOOGLE_API_KEY ?? ''
  const isRealAnthropicKey = anthropicKey.startsWith('sk-ant-') && anthropicKey.length > 50
  const isRealGoogleKey = googleKey.startsWith('AIza') && googleKey.length > 30

  return apiData({
    isAiConfigured: isRealAnthropicKey,
    isGeminiConfigured: isRealGoogleKey,
  })
}
