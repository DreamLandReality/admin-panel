import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  PARENT_TO_RUNTIME_MESSAGE_TYPES as ADMIN_PARENT_TO_RUNTIME_MESSAGE_TYPES,
  RUNTIME_TO_PARENT_MESSAGE_TYPES as ADMIN_RUNTIME_TO_PARENT_MESSAGE_TYPES,
} from '../src/lib/preview/messages'
import {
  PARENT_TO_RUNTIME_MESSAGE_TYPES as RUNTIME_PARENT_TO_RUNTIME_MESSAGE_TYPES,
  RUNTIME_TO_PARENT_MESSAGE_TYPES as RUNTIME_RUNTIME_TO_PARENT_MESSAGE_TYPES,
} from '../../templates-library/tooling/runtime/types/messages'

type ManifestSchemaModule = {
  validateManifestSafe: (input: unknown) => { success: true } | { success: false; error: { issues: Array<{ path: Array<string | number>; message: string }> } }
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const adminRoot = join(scriptDir, '..')
const repoRoot = join(adminRoot, '..')
const templatesRoot = join(repoRoot, 'templates-library')
const schemaRoot = join(templatesRoot, 'tooling/scripts/lib/manifest-schema')
const schemaDist = join(schemaRoot, 'dist/index.js')
const templatesDir = join(templatesRoot, 'templates')

function assertEqualArray(label: string, left: readonly string[], right: readonly string[]): void {
  const leftValues = [...left].sort()
  const rightValues = [...right].sort()
  const mismatch = leftValues.length !== rightValues.length
    || leftValues.some((value, index) => value !== rightValues[index])

  if (mismatch) {
    throw new Error(`${label} mismatch\nadmin-panel: ${leftValues.join(', ')}\nruntime: ${rightValues.join(', ')}`)
  }
}

async function getManifestPaths(): Promise<string[]> {
  const entries = await readdir(templatesDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(templatesDir, entry.name, 'template.manifest.json'))
    .filter((manifestPath) => existsSync(manifestPath))
    .sort()
}

async function validateCurrentManifests(validateManifestSafe: ManifestSchemaModule['validateManifestSafe']): Promise<void> {
  const manifestPaths = await getManifestPaths()
  if (manifestPaths.length === 0) {
    throw new Error('No template.manifest.json files found in templates-library/templates')
  }

  const failures: string[] = []
  for (const manifestPath of manifestPaths) {
    const raw = await readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    const result = validateManifestSafe(parsed)
    if (!result.success) {
      failures.push(`${relative(repoRoot, manifestPath)}\n${result.error.issues.map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`).join('\n')}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`Manifest schema validation failed:\n${failures.join('\n\n')}`)
  }

  console.log(`✓ ${manifestPaths.length} template manifest(s) validate against templates-library schema`)
}

async function main(): Promise<void> {
  console.log('Building templates-library manifest schema...')
  execFileSync('npm', ['run', 'build', '--silent'], { cwd: schemaRoot, stdio: 'inherit' })

  console.log('Checking admin-panel TypeScript compatibility...')
  execFileSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], { cwd: adminRoot, stdio: 'inherit' })

  const schemaModule = await import(pathToFileURL(schemaDist).href) as ManifestSchemaModule
  await validateCurrentManifests(schemaModule.validateManifestSafe)

  assertEqualArray(
    'Parent-to-runtime postMessage types',
    ADMIN_PARENT_TO_RUNTIME_MESSAGE_TYPES,
    RUNTIME_PARENT_TO_RUNTIME_MESSAGE_TYPES
  )
  assertEqualArray(
    'Runtime-to-parent postMessage types',
    ADMIN_RUNTIME_TO_PARENT_MESSAGE_TYPES,
    RUNTIME_RUNTIME_TO_PARENT_MESSAGE_TYPES
  )
  console.log('✓ admin-panel and preview-runtime postMessage type lists match')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Contract check failed: ${message}`)
  process.exit(1)
})
