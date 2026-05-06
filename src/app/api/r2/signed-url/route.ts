/**
 * API Route: Generate Signed URL for R2 Objects
 *
 * POST /api/r2/signed-url
 * Body: { objectKey: string, expiresIn?: number }
 * Response: { url: string } | { error: string }
 */

import { type NextRequest } from 'next/server'
import { generateSignedUrl } from '@/lib/utils/r2-storage'
import { apiError, apiOk } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'
import { requireCapability } from '@/lib/api/auth'
import { createRateLimiter } from '@/lib/rate-limit'
import { log } from '@/lib/log'

const r2Limiter = createRateLimiter({ windowMs: 60_000, max: 30 })

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error'
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCapability('canEditSites')
    if (!auth.ok) return auth.response
    const { user } = auth

    const { limited } = r2Limiter.check(user.id)
    if (limited) {
      return apiError('Too many requests', 429)
    }

    const bodyResult = await parseJsonRecordBody(request)
    if (!bodyResult.ok) return bodyResult.response
    const body = bodyResult.data
    const { objectKey, expiresIn, bucket } = body

    if (!objectKey || typeof objectKey !== 'string') {
      return apiError('objectKey is required and must be a string', 400)
    }

    // Prevent path traversal
    if (objectKey.includes('..') || objectKey.startsWith('/')) {
      return apiError('Invalid objectKey', 400)
    }

    // Cap expiration to 1 hour max
    const safeExpiry = Math.min(
      typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 3600,
      3600
    )

    // Optional bucket parameter (validated by generateSignedUrl against whitelist)
    const targetBucket = typeof bucket === 'string' ? bucket : undefined

    const signedUrl = await generateSignedUrl(objectKey, safeExpiry, targetBucket)

    return apiOk({ url: signedUrl })
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    log.event('error', 'r2.signed_url.failed', 'Failed to generate R2 signed URL', {
      reason: errorMessage,
    })
    return apiError(errorMessage, 500)
  }
}
