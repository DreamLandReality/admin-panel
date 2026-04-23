/**
 * Deploy Pipeline
 *
 * Two orchestration flows:
 *
 * runDeployPipeline (first deploy — 6 steps):
 *   upload_images  → validate no blob: URLs remain in site_data
 *   create_repo    → fork template GitHub repo; reuse if already exists
 *   inject_manifest → write template.manifest.json with user site_data
 *   cloudflare_setup → create or reuse Cloudflare Pages project
 *   save_record    → persist infrastructure IDs and set status = 'building'
 *   cf_build       → poll Cloudflare until build succeeds or times out
 *
 * runRedeployPipeline (republish existing site — 4 steps):
 *   upload_images → inject_manifest → save_record → cf_build
 *
 * SSE events are emitted via the `emit` callback at each step transition.
 * Shape: { step: DeployStepId, status: 'running'|'done'|'error', message: string, data?: {...} }
 *
 * Error logging uses the Supabase RPC `append_status_log(p_deployment_id, p_status, p_step, p_message)`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deployment, Template, DeployEvent, DeployStepId } from '@/types'
import { env } from '@/lib/env'
import { buildDeployManifest } from './manifest-builder'
import {
  createRepoFromTemplate,
  repoExists,
  waitForRepoReady,
  getFileContent,
  updateFileContent,
} from './github'
import {
  getProject,
  createPagesProject,
  waitForDeployment,
  triggerDeployment,
  updateProjectEnvVars,
} from './cloudflare'
import puppeteer from 'puppeteer'
import { uploadToPrivateBucket } from '@/lib/utils/r2-storage'

/**
 * Update astro.config.mjs in the GitHub repo to inject the real site URL
 * and enable sitemap generation.
 *
 * Replaces:
 *   site: 'https://example.com'
 * with:
 *   site: 'https://actual-site-url.pages.dev'
 *
 * And adds sitemap integration if not present.
 */
async function injectAstroConfig(
  repoFullName: string,
  siteUrl: string,
  commitMessage: string
): Promise<void> {
  const { content, sha } = await getFileContent(repoFullName, 'astro.config.mjs')

  let updated = content

  // Replace site URL — match even with trailing comment
  updated = updated.replace(
    /site:\s*['"]https:\/\/example\.com['"][^,]*,?\s*(?:\/\/.*)?$/m,
    `site: '${siteUrl}',`
  )

  // Add sitemap import if not present
  if (!updated.includes("from '@astrojs/sitemap'")) {
    updated = updated.replace(
      /(import\s+tailwind\s+from\s+['"]@astrojs\/tailwind['"];?)/,
      "$1\nimport sitemap from '@astrojs/sitemap';"
    )
  }

  // Add sitemap to integrations if not present — match various formatting
  if (!updated.includes('sitemap()')) {
    updated = updated.replace(
      /integrations:\s*\[\s*tailwind\(\)\s*\]/,
      'integrations: [\n    tailwind(),\n    sitemap()\n  ]'
    )
  }

  await updateFileContent(
    repoFullName,
    'astro.config.mjs',
    updated,
    sha,
    commitMessage
  )
}

// ── Screenshot ────────────────────────────────────────────────────────────────

/**
 * Guard against SSRF: only allow HTTPS URLs targeting public hostnames.
 * Blocks localhost, loopback, link-local, and private network ranges.
 */
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return (
      u.protocol === 'https:' &&
      !/(localhost|127\.0\.0\.1|169\.254\.|10\.|192\.168\.|::1)/i.test(u.hostname)
    )
  } catch {
    return false
  }
}

/**
 * Take a Puppeteer screenshot of the live URL and upload to the private
 * screenshots bucket (CLOUDFLARE_R2_BUCKET_NAME).
 *
 * Returns the R2 object key (e.g. "screenshots/deployments/my-site/preview.png"),
 * NOT a full URL — the key is stored in screenshot_url and the dashboard resolves
 * it to a short-lived signed URL at render time via generateSignedUrl().
 *
 * Returns null on failure (non-fatal — falls back to SEO/hero image).
 */
async function captureScreenshot(url: string, slug: string): Promise<string | null> {
  if (!isSafeUrl(url)) {
    throw new Error(`Unsafe preview URL blocked: ${url}`)
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 900 })
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 })
    await new Promise((r) => setTimeout(r, 2_000))
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    const safeName = slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
    const objectKey = `screenshots/deployments/${safeName}/preview.png`
    // Upload to the private screenshots bucket and return the object key.
    // The dashboard generates a signed URL from this key at render time.
    return await uploadToPrivateBucket(objectKey, Buffer.from(screenshot), 'image/png')
  } finally {
    await browser.close()
  }
}

async function runStep<T>(
  stepId: DeployStepId,
  label: string,
  emit: (e: DeployEvent) => void,
  fn: () => Promise<T>
): Promise<T> {
  emit({ step: stepId, status: 'running', message: `${label}...` })
  try {
    const result = await fn()
    emit({ step: stepId, status: 'done', message: `${label} complete` })
    return result
  } catch (err: any) {
    emit({ step: stepId, status: 'error', message: err.message ?? 'Unknown error' })
    throw err
  }
}

async function appendLog(
  supabase: SupabaseClient,
  deploymentId: string,
  status: string,
  step: string,
  message: string
) {
  await supabase.rpc('append_status_log', {
    p_deployment_id: deploymentId,
    p_status: status,
    p_step: step,
    p_message: message,
  })
}

function submissionEndpoint(): string {
  // Supabase Edge Function URL for contact form submissions
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL — contact form submission endpoint cannot be configured')
  }
  return `${supabaseUrl}/functions/v1/submit-form`
}

function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY — contact form submission cannot be configured')
  }
  return key
}

// ── First Deploy ──────────────────────────────────────────────────────────────

export async function runDeployPipeline(
  deployment: Deployment,
  template: Template,
  supabase: SupabaseClient,
  emit: (event: DeployEvent) => void
): Promise<{ siteUrl: string; repoUrl: string }> {
  const slug = deployment.slug
  const repoName = slug
  const templateRepo = template.github_repo.split('/').pop() ?? template.github_repo

  // Step 1: upload_images — validate no blob: URLs remain
  await runStep('upload_images', 'Validating images', emit, async () => {
    // At this point blobs should already be uploaded by the client.
    // This step is a server-side safety check.
    function findBlobs(node: unknown): string[] {
      if (typeof node === 'string' && node.startsWith('blob:')) return [node]
      if (Array.isArray(node)) return node.flatMap(findBlobs)
      if (node !== null && typeof node === 'object') {
        return Object.values(node as object).flatMap(findBlobs)
      }
      return []
    }
    const blobs = findBlobs(deployment.site_data)
    if (blobs.length > 0) {
      throw new Error(`${blobs.length} image(s) not yet uploaded to R2. Save the draft first.`)
    }
  })

  // Step 2: create_repo
  let repoFullName: string
  let repoUrl: string

  await runStep('create_repo', 'Creating repository', emit, async () => {
    const candidate = `${env.GITHUB_ORG}/${repoName}`
    console.log(`[Pipeline] create_repo: slug=${slug} repoName=${repoName} templateRepo=${templateRepo} candidate=${candidate}`)
    const exists = await repoExists(candidate)
    console.log(`[Pipeline] create_repo: repoExists(${candidate})=${exists}`)
    if (exists) {
      console.log(`[Pipeline] create_repo: reusing existing repo ${candidate}`)
      repoFullName = candidate
      repoUrl = `https://github.com/${candidate}`
    } else {
      let result: { repoUrl: string; fullName: string }
      try {
        result = await createRepoFromTemplate(
          templateRepo,
          repoName,
          `${deployment.project_name} — generated by Dream Land Reality`
        )
      } catch (err: any) {
        // GitHub template generation is async — a previous attempt may have started
        // generating this repo name but not yet made it visible via GET. The 422
        // "Name already exists" means the name is reserved mid-generation.
        // Wait for the in-flight generation to complete then reuse the repo.
        if (err.message?.includes('422')) {
          console.warn(`[Pipeline] create_repo: 422 on creation, waiting for in-flight generation of ${candidate}`)
          await waitForRepoReady(candidate, 60_000)
          console.log(`[Pipeline] create_repo: in-flight repo now ready, reusing ${candidate}`)
          repoFullName = candidate
          repoUrl = `https://github.com/${candidate}`
          return
        }
        throw err
      }
      repoFullName = result.fullName
      repoUrl = result.repoUrl
      await waitForRepoReady(repoFullName)
    }
  })

  // Step 3: inject_manifest
  await runStep('inject_manifest', 'Injecting site data', emit, async () => {
    const siteToken = deployment.site_token ?? crypto.randomUUID()
    const manifest = buildDeployManifest(
      deployment.template_manifest,
      deployment.site_data,
      siteToken,
      submissionEndpoint(),
      supabaseAnonKey()
    )
    const { sha } = await getFileContent(repoFullName!, 'template.manifest.json')
    await updateFileContent(
      repoFullName!,
      'template.manifest.json',
      JSON.stringify(manifest, null, 2),
      sha,
      `chore: inject site data for ${deployment.project_name}`
    )
  })

  // Step 4: cloudflare_setup
  let cfProjectName: string
  let cfProjectId: string
  let siteUrl: string
  let stableUrl: string  // Cloudflare *.pages.dev root URL — captured before cf_build overwrites siteUrl

  await runStep('cloudflare_setup', 'Configuring hosting', emit, async () => {
    cfProjectName = slug
    const existing = await getProject(cfProjectName)
    if (existing.exists) {
      cfProjectId = existing.projectId ?? ''
      siteUrl = existing.projectUrl ?? `https://${cfProjectName}.pages.dev`
      // Update SITE_URL for existing projects (non-fatal) — skipped on initial creation
      // because createPagesProject already sets it during project setup.
      try {
        await updateProjectEnvVars(cfProjectName, { SITE_URL: siteUrl })
      } catch (e: any) {
        console.warn(`[Cloudflare] Failed to update SITE_URL for existing project (non-fatal): ${e.message}`)
      }
    } else {
      const githubOwner = env.GITHUB_ORG
      const githubRepoName = repoName
      const tempSiteUrl = `https://${cfProjectName}.pages.dev`
      const result = await createPagesProject(
        cfProjectName,
        githubOwner,
        githubRepoName,
        tempSiteUrl
      )
      cfProjectId = result.projectId
      siteUrl = result.projectUrl
    }
    stableUrl = siteUrl  // save before cf_build overwrites with hash URL
    
    // Inject real site URL and sitemap into astro.config.mjs
    await injectAstroConfig(
      repoFullName!,
      siteUrl,
      `chore: configure site URL and sitemap for ${deployment.project_name}`
    )
  })

  // Step 5: save_record
  await runStep('save_record', 'Saving deployment record', emit, async () => {
    await supabase
      .from('deployments')
      .update({
        github_repo: repoFullName!,
        github_repo_url: repoUrl!,
        cloudflare_project_id: cfProjectId!,
        cloudflare_project_name: cfProjectName!,
        status: 'building',
        has_unpublished_changes: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deployment.id)

    await appendLog(supabase, deployment.id, 'building', 'save_record', 'Infrastructure provisioned — waiting for build')
  })

  // Step 6: cf_build
  await runStep('cf_build', 'Building & deploying', emit, async () => {
    // Explicitly trigger a deployment — don't rely solely on the GitHub auto-trigger.
    // The Cloudflare Pages GitHub App must have access to the repo for auto-trigger to fire;
    // if it doesn't (newly created repo not yet authorized), CF creates a Direct Upload project
    // and the auto-trigger never fires. This explicit call mirrors deploy-template.ts behaviour.
    let triggeredDeploymentId: string | undefined
    try {
      const triggered = await triggerDeployment(cfProjectName!)
      triggeredDeploymentId = triggered.deploymentId
    } catch {
      // Non-fatal — GitHub auto-trigger may already have started the build
    }

    const result = await waitForDeployment(
      cfProjectName!,
      300_000,
      (stage, status) => {
        emit({
          step: 'cf_build',
          status: 'running',
          message: `Build stage: ${stage} (${status})`,
        })
      },
      triggeredDeploymentId
    )

    if (result.success) {
      // Overwrite the stable project URL with the actual Cloudflare deployment hash URL
      // (e.g. https://08ffb1b9.projectName.pages.dev) so that both the screenshot
      // and the database record point directly to this exact build.
      siteUrl = result.url

      const sd = deployment.site_data as any

      // Update DB to 'live' immediately using hero/seo image as screenshot fallback.
      // The actual Puppeteer screenshot runs asynchronously below (does not block SSE).
      await supabase
        .from('deployments')
        .update({
          status: 'live',
          live_url: siteUrl,
          stable_url: stableUrl,
          screenshot_url: sd?.seo?.image || sd?.hero?.backgroundImage || null,
          deployed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deployment.id)

      await appendLog(supabase, deployment.id, 'live', 'cf_build', `Site live at ${siteUrl}`)

      emit({
        step: 'cf_build',
        status: 'done',
        message: 'Build & Deploy complete',
        data: { siteUrl: stableUrl, repoUrl: repoUrl! },
      })

      // Capture screenshot after SSE done — non-blocking; overwrites fallback on success.
      void captureScreenshot(result.url, deployment.slug)
        .then(async (key) => { if (key) await supabase.from('deployments').update({ screenshot_url: key, updated_at: new Date().toISOString() }).eq('id', deployment.id) })
        .catch((err: any) => console.warn(`[Screenshot] Non-fatal: ${err.message}`))
    } else {
      // Build timed out — leave as building so dashboard can poll
      if (result.logs?.includes('timed out')) {
        await supabase
          .from('deployments')
          .update({ build_logs: result.logs, updated_at: new Date().toISOString() })
          .eq('id', deployment.id)
        await appendLog(supabase, deployment.id, 'building', 'cf_build', 'Build timed out — check Cloudflare dashboard')
        throw new Error('Build timed out. Check the Cloudflare dashboard for progress.')
      }

      await supabase
        .from('deployments')
        .update({
          status: 'failed',
          error_message: 'Cloudflare build failed',
          build_logs: result.logs ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deployment.id)

      await appendLog(supabase, deployment.id, 'failed', 'cf_build', 'Cloudflare build failed')
      throw new Error('Cloudflare build failed. Check build logs for details.')
    }
  })

  return { siteUrl: siteUrl!, repoUrl: repoUrl! }
}

// ── Republish ─────────────────────────────────────────────────────────────────

export async function runRedeployPipeline(
  deployment: Deployment,
  _template: Template,
  supabase: SupabaseClient,
  emit: (event: DeployEvent) => void
): Promise<{ siteUrl: string }> {
  if (!deployment.github_repo || !deployment.cloudflare_project_name) {
    throw new Error(
      'Cannot republish: deployment is missing infrastructure data (github_repo or cloudflare_project_name). ' +
      'This may indicate the first deploy did not complete. Try deploying as a new site instead.'
    )
  }
  const repoFullName = deployment.github_repo
  const cfProjectName = deployment.cloudflare_project_name
  let siteUrl = deployment.live_url ?? `https://${cfProjectName}.pages.dev`

  // Step 1: upload_images — validate no blobs
  await runStep('upload_images', 'Validating images', emit, async () => {
    function findBlobs(node: unknown): string[] {
      if (typeof node === 'string' && node.startsWith('blob:')) return [node]
      if (Array.isArray(node)) return node.flatMap(findBlobs)
      if (node !== null && typeof node === 'object') {
        return Object.values(node as object).flatMap(findBlobs)
      }
      return []
    }
    const blobs = findBlobs(deployment.site_data)
    if (blobs.length > 0) {
      throw new Error(`${blobs.length} image(s) not yet uploaded to R2. Save the draft first.`)
    }
  })

  // Step 2: inject_manifest (update existing repo)
  await runStep('inject_manifest', 'Pushing updated site data', emit, async () => {
    const siteToken = deployment.site_token ?? crypto.randomUUID()
    const manifest = buildDeployManifest(
      deployment.template_manifest,
      deployment.site_data,
      siteToken,
      submissionEndpoint(),
      supabaseAnonKey()
    )
    const { sha } = await getFileContent(repoFullName, 'template.manifest.json')
    await updateFileContent(
      repoFullName,
      'template.manifest.json',
      JSON.stringify(manifest, null, 2),
      sha,
      `chore: republish site data for ${deployment.project_name}`
    )
    
    // Update astro.config.mjs with current site URL and sitemap
    await injectAstroConfig(
      repoFullName,
      siteUrl,
      `chore: update site URL and sitemap for ${deployment.project_name}`
    )
  })

  // Step 3: save_record
  await runStep('save_record', 'Saving deployment record', emit, async () => {
    await supabase
      .from('deployments')
      .update({
        status: 'building',
        has_unpublished_changes: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deployment.id)

    await appendLog(supabase, deployment.id, 'building', 'save_record', 'Changes pushed — waiting for rebuild')
  })

  // Step 4: cf_build (CF auto-builds from the push)
  await runStep('cf_build', 'Building & deploying', emit, async () => {
    // Trigger explicit redeploy in case CF didn't auto-pick up the push.
    // Capture the triggered deployment ID so waitForDeployment can filter by it,
    // preventing it from matching a stale previously-succeeded build (P0 fix).
    let triggeredDeploymentId: string | undefined
    try {
      const triggered = await triggerDeployment(cfProjectName)
      triggeredDeploymentId = triggered.deploymentId
    } catch {
      // Non-fatal — the git push may already have triggered the build
    }

    const result = await waitForDeployment(
      cfProjectName,
      300_000,
      (stage, status) => {
        emit({
          step: 'cf_build',
          status: 'running',
          message: `Build stage: ${stage} (${status})`,
        })
      },
      triggeredDeploymentId
    )

    if (result.success) {
      // Overwrite the stable project URL with the actual Cloudflare deployment hash URL
      // (e.g. https://08ffb1b9.projectName.pages.dev) so that both the screenshot
      // and the database record point directly to this exact build.
      siteUrl = result.url

      const sd = deployment.site_data as any

      // Update DB to 'live' immediately using hero/seo image as screenshot fallback.
      // The actual Puppeteer screenshot runs asynchronously below (does not block SSE).
      await supabase
        .from('deployments')
        .update({
          status: 'live',
          live_url: siteUrl,
          stable_url: deployment.stable_url ?? `https://${cfProjectName}.pages.dev`,
          screenshot_url: sd?.seo?.image || sd?.hero?.backgroundImage || null,
          deployed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deployment.id)

      await appendLog(supabase, deployment.id, 'live', 'cf_build', `Republished at ${siteUrl}`)

      emit({
        step: 'cf_build',
        status: 'done',
        message: 'Build & Deploy complete',
        data: { siteUrl: deployment.stable_url ?? siteUrl },
      })

      // Capture screenshot after SSE done — non-blocking; overwrites fallback on success.
      void captureScreenshot(result.url, deployment.slug)
        .then(async (key) => { if (key) await supabase.from('deployments').update({ screenshot_url: key, updated_at: new Date().toISOString() }).eq('id', deployment.id) })
        .catch((err: any) => console.warn(`[Screenshot] Non-fatal: ${err.message}`))
    } else {
      await supabase
        .from('deployments')
        .update({
          status: 'failed',
          error_message: 'Cloudflare rebuild failed',
          build_logs: result.logs ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deployment.id)

      await appendLog(supabase, deployment.id, 'failed', 'cf_build', 'Cloudflare rebuild failed')
      throw new Error('Cloudflare rebuild failed. Check build logs.')
    }
  })

  return { siteUrl }
}
