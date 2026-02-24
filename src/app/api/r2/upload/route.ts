/**
 * API Route: Upload Image to R2 Assets Bucket
 *
 * POST /api/r2/upload
 * Content-Type: multipart/form-data
 * Body: file (image), objectKey (string)
 * Response: { url: string, key: string } | { error: string }
 *
 * The assets bucket has public read access, so uploaded images
 * are immediately accessible via the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2, getAssetsBucketName } from '@/lib/utils/r2-storage'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'

const uploadLimiter = createRateLimiter({ windowMs: 60_000, max: 20 })

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/avif'
])

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Object key must start with one of these prefixes
const ALLOWED_PREFIXES = ['sites/', 'templates/']

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { limited } = uploadLimiter.check(user.id)
    if (limited) {
      return NextResponse.json({ error: 'Too many upload requests' }, { status: 429 })
    }

    // Check assets bucket is configured
    if (!getAssetsBucketName()) {
      return NextResponse.json(
        { error: 'R2 assets bucket not configured. Set CLOUDFLARE_R2_ASSETS_BUCKET_NAME.' },
        { status: 500 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const objectKey = formData.get('objectKey') as string | null

    if (!file || !objectKey) {
      return NextResponse.json(
        { error: 'file and objectKey are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${[...ALLOWED_TYPES].join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 }
      )
    }

    // Validate object key
    if (objectKey.includes('..') || objectKey.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid objectKey: path traversal not allowed' },
        { status: 400 }
      )
    }

    if (!ALLOWED_PREFIXES.some(prefix => objectKey.startsWith(prefix))) {
      return NextResponse.json(
        { error: `Invalid objectKey: must start with ${ALLOWED_PREFIXES.join(' or ')}` },
        { status: 400 }
      )
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to R2
    const publicUrl = await uploadToR2(objectKey, buffer, file.type)

    return NextResponse.json({
      url: publicUrl,
      key: objectKey
    })
  } catch (error) {
    console.error('Error uploading to R2:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
