/**
 * Cloudflare R2 Storage Utilities
 *
 * Provides utilities for accessing R2 bucket objects:
 * - Private bucket (template-screenshots): signed URLs for screenshots
 * - Public-read bucket (template-assets): template images + customer uploads
 *
 * Environment variables are loaded from admin-panel/.env.local
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/lib/env'

// R2 Configuration from environment (loaded from .env.local by Next.js)
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME
const R2_ASSETS_BUCKET_NAME = process.env.CLOUDFLARE_R2_ASSETS_BUCKET_NAME
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

// Warn at module load time if R2 is partially configured (credentials set but no public URL)
if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && !R2_PUBLIC_URL) {
  console.warn('[R2] R2 credentials are set but NEXT_PUBLIC_R2_PUBLIC_URL is missing. Uploads will succeed but public URL generation will fail.')
}

// Lazy getter: whitelisted bucket names (computed at call time, not module load)
function getAllowedBuckets(): Set<string> {
  return new Set([R2_BUCKET_NAME, R2_ASSETS_BUCKET_NAME].filter(Boolean) as string[])
}

/** Lazily created S3 client (shared across requests) */
let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client

  // env.* getters throw with a clear message if any var is missing (fail-fast)
  _s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    }
  })

  return _s3Client
}

/**
 * Resolve a bucket name: validates against whitelist, defaults to screenshots bucket
 */
function resolveBucket(bucket?: string): string {
  if (bucket && getAllowedBuckets().has(bucket)) return bucket
  if (!R2_BUCKET_NAME) throw new Error('Missing CLOUDFLARE_R2_BUCKET_NAME')
  return R2_BUCKET_NAME
}

/**
 * Generate a signed URL for accessing a private R2 object
 *
 * @param objectKey - The object key in the R2 bucket (e.g., "screenshots/minimal-luxury/preview.png")
 * @param expiresInSeconds - How long the URL should be valid (default: 1 hour)
 * @param bucket - Optional bucket name (defaults to CLOUDFLARE_R2_BUCKET_NAME)
 * @returns Signed URL string
 * @throws Error if R2 credentials are not configured
 */
export async function generateSignedUrl(
  objectKey: string,
  expiresInSeconds: number = 3600,
  bucket?: string
): Promise<string> {
  const s3Client = getS3Client()
  const targetBucket = resolveBucket(bucket)

  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: targetBucket,
      Key: objectKey
    }),
    { expiresIn: expiresInSeconds }
  )

  return signedUrl
}

/**
 * Upload a file to R2
 *
 * @param objectKey - The object key (e.g., "sites/my-site/hero.png")
 * @param body - File content as Buffer or Uint8Array
 * @param contentType - MIME type (e.g., "image/png")
 * @param bucket - Optional bucket name (defaults to assets bucket)
 * @returns Public URL of the uploaded object
 */
export async function uploadToR2(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string,
  bucket?: string
): Promise<string> {
  const s3Client = getS3Client()
  const targetBucket = bucket
    ? resolveBucket(bucket)
    : (R2_ASSETS_BUCKET_NAME || resolveBucket())

  await s3Client.send(new PutObjectCommand({
    Bucket: targetBucket,
    Key: objectKey,
    Body: body,
    ContentType: contentType
  }))

  return getR2PublicUrl(objectKey)
}

/**
 * Build a public URL for an R2 object in the assets bucket
 *
 * @param objectKey - The R2 object key
 * @returns Full public URL
 */
export function getR2PublicUrl(objectKey: string): string {
  return `${env.NEXT_PUBLIC_R2_PUBLIC_URL}/${objectKey}`
}

/**
 * Build the immutable shared-defaults URL used by production templates.
 *
 * Shared defaults are general-mode assets: all templates reference
 * `shared-defaults/{filename}` rather than per-template subfolders. Do not
 * overwrite an existing shared-default file after customer sites are deployed;
 * use a new filename for new defaults.
 */
export function getSharedDefaultUrl(filename: string): string {
  const normalized = filename.replace(/^\/+/, '')
  return getR2PublicUrl(`shared-defaults/${normalized}`)
}

/**
 * Generate a signed URL for a template preview screenshot
 *
 * @param templateSlug - The template slug (e.g., "minimal-luxury")
 * @param expiresInSeconds - How long the URL should be valid (default: 1 hour)
 * @returns Signed URL string
 * @throws Error if R2 credentials are not configured
 */
export async function getTemplatePreviewUrl(
  templateSlug: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const objectKey = `screenshots/${templateSlug}/preview.png`
  return generateSignedUrl(objectKey, expiresInSeconds)
}

/**
 * Check if R2 storage is properly configured
 *
 * @returns true if all required credentials are present
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ACCOUNT_ID && R2_BUCKET_NAME)
}

/**
 * Get the name of the assets bucket
 */
export function getAssetsBucketName(): string | undefined {
  return R2_ASSETS_BUCKET_NAME
}

/**
 * Upload a file to the private screenshots bucket and return the object key.
 *
 * Unlike uploadToR2 (which returns a CDN public URL), this returns the raw
 * object key so callers can generate signed URLs on demand via generateSignedUrl.
 *
 * @param objectKey   - e.g. "screenshots/deployments/my-site/preview.png"
 * @param body        - File content as Buffer or Uint8Array
 * @param contentType - MIME type (e.g. "image/png")
 * @returns The object key (not a URL)
 */
export async function uploadToPrivateBucket(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const s3Client = getS3Client()
  await s3Client.send(new PutObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: objectKey,
    Body: body,
    ContentType: contentType,
  }))
  return objectKey
}
