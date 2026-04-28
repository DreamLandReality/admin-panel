/**
 * API Route: Generate Signed URL for R2 Objects
 *
 * POST /api/r2/signed-url
 * Body: { objectKey: string, expiresIn?: number }
 * Response: { url: string } | { error: string }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { generateSignedUrl } from '@/lib/utils/r2-storage'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'

const r2Limiter = createRateLimiter({ windowMs: 60_000, max: 30 })

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { limited } = r2Limiter.check(user.id)
    if (limited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    let body: { objectKey?: unknown; expiresIn?: unknown; bucket?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { objectKey, expiresIn, bucket } = body

    if (!objectKey || typeof objectKey !== 'string') {
      return NextResponse.json(
        { error: 'objectKey is required and must be a string' },
        { status: 400 }
      )
    }

    // Prevent path traversal
    if (objectKey.includes('..') || objectKey.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid objectKey' },
        { status: 400 }
      )
    }

    // Cap expiration to 1 hour max
    const safeExpiry = Math.min(
      typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 3600,
      3600
    )

    // Optional bucket parameter (validated by generateSignedUrl against whitelist)
    const targetBucket = typeof bucket === 'string' ? bucket : undefined

    const signedUrl = await generateSignedUrl(objectKey, safeExpiry, targetBucket)

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    console.error('Error generating signed URL:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
