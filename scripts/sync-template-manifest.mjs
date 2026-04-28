/**
 * sync-template-manifest.mjs
 *
 * Updates the `manifest` column in the Supabase `templates` table for a given
 * template slug, using the local template.manifest.json as the source of truth.
 *
 * Usage:
 *   node scripts/sync-template-manifest.mjs noir-luxury
 *   node scripts/sync-template-manifest.mjs noir-luxury-template
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load env from .env.local ──────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join('=')])
)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// ── Read template slug from args ──────────────────────────────────────────────
const slug = process.argv[2]
if (!slug) {
  console.error('Usage: node scripts/sync-template-manifest.mjs <template-slug>')
  console.error('Example: node scripts/sync-template-manifest.mjs noir-luxury')
  process.exit(1)
}

// ── Load manifest from local file ────────────────────────────────────────────
const templateDir = slug.endsWith('-template') ? slug : `${slug}-template`
const manifestPath = resolve(__dirname, `../../templates-library/templates/${templateDir}/template.manifest.json`)
let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch {
  console.error(`Could not read manifest at: ${manifestPath}`)
  process.exit(1)
}

console.log(`Loaded manifest for "${slug}" from "${templateDir}" — ${manifest.sections?.length ?? 0} sections`)

// ── Update Supabase ───────────────────────────────────────────────────────────
const url = `${SUPABASE_URL}/rest/v1/templates?slug=eq.${encodeURIComponent(slug)}`
const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=representation',
  },
  body: JSON.stringify({ manifest }),
})

if (!res.ok) {
  const text = await res.text()
  console.error(`Supabase error ${res.status}: ${text}`)
  process.exit(1)
}

const updated = await res.json()
if (!updated?.length) {
  console.error(`No template found with slug "${slug}". Check the slug matches the templates table.`)
  process.exit(1)
}

console.log(`✓ Updated manifest for template "${updated[0].name ?? slug}" (id: ${updated[0].id})`)
