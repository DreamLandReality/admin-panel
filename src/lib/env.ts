function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  get SUPABASE_URL() {
    return requireValue('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get SUPABASE_ANON_KEY() {
    return requireValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
  },

  // ── Deploy pipeline (server-side only) ─────────────────────────────────────

  get SUPABASE_SERVICE_ROLE_KEY() {
    return requireValue('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
  },
  get GITHUB_TOKEN() {
    return requireValue('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  },
  get GITHUB_ORG() {
    return requireValue('GITHUB_ORG', process.env.GITHUB_ORG)
  },
  get CLOUDFLARE_API_TOKEN() {
    return requireValue('CLOUDFLARE_API_TOKEN', process.env.CLOUDFLARE_API_TOKEN)
  },
  get CLOUDFLARE_ACCOUNT_ID() {
    return requireValue('CLOUDFLARE_ACCOUNT_ID', process.env.CLOUDFLARE_ACCOUNT_ID)
  },
  get CLOUDFLARE_R2_ACCESS_KEY_ID() {
    return requireValue('CLOUDFLARE_R2_ACCESS_KEY_ID', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID)
  },
  get CLOUDFLARE_R2_SECRET_ACCESS_KEY() {
    return requireValue('CLOUDFLARE_R2_SECRET_ACCESS_KEY', process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY)
  },
  get CLOUDFLARE_R2_BUCKET_NAME() {
    return requireValue('CLOUDFLARE_R2_BUCKET_NAME', process.env.CLOUDFLARE_R2_BUCKET_NAME)
  },
  get NEXT_PUBLIC_R2_PUBLIC_URL() {
    return requireValue('NEXT_PUBLIC_R2_PUBLIC_URL', process.env.NEXT_PUBLIC_R2_PUBLIC_URL)
  },

  /** True when all deploy-pipeline env vars are present (no throw). Used to show/hide Deploy button. */
  get isDeployConfigured(): boolean {
    return !!(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.GITHUB_TOKEN &&
      process.env.GITHUB_ORG &&
      process.env.CLOUDFLARE_API_TOKEN &&
      process.env.CLOUDFLARE_ACCOUNT_ID
    )
  },

  /** True when ANTHROPIC_API_KEY is present (no throw). Used to show/hide AI parse features. */
  get isAiConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY
  },
  get ANTHROPIC_API_KEY() {
    return requireValue('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY)
  },

  // ── Voice Agent (ElevenLabs) ────────────────────────────────────────────────

  get ELEVENLABS_API_KEY() {
    return requireValue('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY)
  },
  get ELEVENLABS_AGENT_ID() {
    return requireValue('ELEVENLABS_AGENT_ID', process.env.ELEVENLABS_AGENT_ID)
  },
  get ELEVENLABS_AGENT_PHONE_NUMBER_ID() {
    return requireValue('ELEVENLABS_AGENT_PHONE_NUMBER_ID', process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID)
  },
  get ELEVENLABS_WEBHOOK_SECRET() {
    return requireValue('ELEVENLABS_WEBHOOK_SECRET', process.env.ELEVENLABS_WEBHOOK_SECRET)
  },

  // ── QStash ──────────────────────────────────────────────────────────────────

  get QSTASH_CURRENT_SIGNING_KEY() {
    return requireValue('QSTASH_CURRENT_SIGNING_KEY', process.env.QSTASH_CURRENT_SIGNING_KEY)
  },
  get QSTASH_NEXT_SIGNING_KEY() {
    return requireValue('QSTASH_NEXT_SIGNING_KEY', process.env.QSTASH_NEXT_SIGNING_KEY)
  },

  /** True when all voice agent env vars are present (no throw). */
  get isVoiceAgentConfigured(): boolean {
    return !!(
      process.env.ELEVENLABS_API_KEY &&
      process.env.ELEVENLABS_AGENT_ID &&
      process.env.QSTASH_TOKEN
    )
  },

}

/**
 * Eagerly validate the two env vars required for every request.
 * Call this once in middleware so missing vars surface at server start
 * rather than on the first API call that happens to need them.
 */
export function validateRequiredEnv(): void {
  void env.SUPABASE_URL
  void env.SUPABASE_ANON_KEY
}
