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

/**
 * In-process concurrency guard — prevents memory spikes from many parallel large uploads.
 * NOTE: This counter is per-process and not safe across multiple Node.js instances or
 * edge workers. For distributed deployments, replace with a Redis atomic counter.
 */
let activeUploads = 0
const MAX_CONCURRENT_UPLOADS = 10

// Magic-byte signatures for supported file types.
// SVG, AVIF, and video formats cannot be reliably validated by header bytes alone.
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/png':       [[0x89, 0x50, 0x4E, 0x47]],
  'image/jpeg':      [[0xFF, 0xD8, 0xFF]],
  'image/webp':      [[0x52, 0x49, 0x46, 0x46]], // "RIFF" — WebP container prefix
  'image/gif':       [[0x47, 0x49, 0x46, 0x38]], // "GIF8"
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
}

function hasMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  const sigs = MAGIC_BYTES[mimeType]
  if (!sigs) return true // no signature defined (avif, svg) — skip check
  return sigs.some(sig => sig.every((b, i) => bytes[i] === b))
}

const ALLOWED_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/avif',
  // Documents
  'application/pdf',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

// Per-type file size limits
function getMaxFileSize(mimeType: string): number {
  if (mimeType.startsWith('video/')) return 200 * 1024 * 1024  // 200 MB
  if (mimeType === 'application/pdf')  return 25 * 1024 * 1024  //  25 MB
  return 10 * 1024 * 1024                                        //  10 MB (images)
}

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

    const { limited, remaining, resetMs } = uploadLimiter.check(user.id)
    if (limited) {
      return NextResponse.json(
        { error: 'Too many upload requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(resetMs / 1000)),
            'X-RateLimit-Limit': String(uploadLimiter.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((Date.now() + resetMs) / 1000)),
          },
        }
      )
    }
    void remaining // consumed above for headers; suppress lint warning

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
        { error: `Unsupported file type: ${file.type}. Allowed: ${Array.from(ALLOWED_TYPES).join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size (limit varies by type)
    const maxFileSize = getMaxFileSize(file.type)
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${maxFileSize / 1024 / 1024} MB` },
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

    // Validate objectKey has meaningful length (prefix + at least a filename)
    if (objectKey.length < 10) {
      return NextResponse.json(
        { error: 'Invalid objectKey: too short' },
        { status: 400 }
      )
    }

    // Concurrent upload limit
    if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
      return NextResponse.json(
        { error: 'Too many concurrent uploads. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': '5' } }
      )
    }

    // Read file into buffer, validate magic bytes, then upload to R2
    activeUploads++
    try {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      if (!hasMagicBytes(bytes, file.type)) {
        return NextResponse.json(
          { error: 'Invalid file content: file header does not match declared type' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(arrayBuffer)
      const publicUrl = await uploadToR2(objectKey, buffer, file.type)

      return NextResponse.json({
        url: publicUrl,
        key: objectKey
      })
    } finally {
      activeUploads--
    }
  } catch (error) {
    console.error('Error uploading to R2:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
