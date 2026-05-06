import { requireCapability } from '@/lib/api/auth'
import { apiError } from '@/lib/api/response'

/**
 * PATCH /api/voice-call/[id]
 * Voice-call controls are intentionally disabled. Lead handling happens through
 * the unified follow-up fields on /api/enquiries.
 */
export async function PATCH() {
  const auth = await requireCapability('canManageFollowUps')
  if (!auth.ok) return auth.response

  return apiError('Voice call controls are disabled. Update follow-up status and notes instead.', 410)
}
