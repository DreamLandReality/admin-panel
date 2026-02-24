import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'
import * as path from 'path'
import type { DeployEvent } from '@/types'

/**
 * POST /api/deploy
 *
 * Deploys a customer site by creating a new GitHub repo from a template,
 * injecting the edited manifest, and deploying to Cloudflare Pages.
 *
 * Body:
 *   templateSlug  - Template to deploy from (e.g., "minimal-luxury")
 *   siteSlug      - Unique site name (e.g., "luxury-heights-mumbai")
 *   projectName   - Display name for the project
 *   manifest      - The complete edited template.manifest.json object
 *   siteData      - All section data (user edits + _sections registry)
 *
 * Required env vars:
 *   GITHUB_TOKEN, GITHUB_ORG, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */

const deployLimiter = createRateLimiter({ windowMs: 60_000, max: 3 })

// ─── R2 URL Resolution ──────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'])

/**
 * Recursively walk data and convert relative image paths to full R2 URLs.
 * e.g. "properties/building.png" → "https://pub-xxx.r2.dev/templates/minimal-luxury/properties/building.png"
 */
function resolveR2Urls(data: any, prefix: string, baseUrl: string): any {
    if (typeof data === 'string') {
        if (data && !data.startsWith('http') && !data.startsWith('//')) {
            const ext = path.extname(data).toLowerCase()
            if (IMAGE_EXTS.has(ext)) {
                return `${baseUrl}/${prefix}/${data}`
            }
        }
        return data
    }
    if (Array.isArray(data)) return data.map(item => resolveR2Urls(item, prefix, baseUrl))
    if (data !== null && typeof data === 'object') {
        return Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, resolveR2Urls(v, prefix, baseUrl)])
        )
    }
    return data
}

/**
 * Resolve R2 URLs in all section data within a manifest.
 * Uses the manifest's assetStorage config to determine prefix.
 */
function resolveManifestR2Urls(manifest: Record<string, any>, r2PublicUrl: string): Record<string, any> {
    const assetStorage = manifest.assetStorage
    if (assetStorage?.type !== 'r2' || !assetStorage.prefix) return manifest

    const resolved = JSON.parse(JSON.stringify(manifest))
    const prefix = assetStorage.prefix

    for (const section of resolved.sections ?? []) {
        if (section.data) {
            section.data = resolveR2Urls(section.data, prefix, r2PublicUrl)
        }
    }
    for (const collection of resolved.collections ?? []) {
        if (collection.data && Array.isArray(collection.data)) {
            collection.data = collection.data.map((item: any) =>
                resolveR2Urls(item, prefix, r2PublicUrl)
            )
        }
    }
    return resolved
}

// ─── GitHub Helpers ──────────────────────────────────────────────────────────

async function ghFetch(url: string, options: RequestInit = {}) {
    return fetch(url, {
        ...options,
        headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    })
}

// ─── Step 1: Create repo from template ───────────────────────────────────────

async function createRepoFromTemplate(
    templateSlug: string,
    siteSlug: string,
    org: string
): Promise<{ cloneUrl: string; repoUrl: string; created: boolean }> {
    const templateRepo = `template-${templateSlug}`
    const siteRepo = `site-${siteSlug}`

    // Check if template repo exists
    const checkTemplate = await ghFetch(`https://api.github.com/repos/${org}/${templateRepo}`)
    if (!checkTemplate.ok) {
        throw new Error(`Template repo not found: ${org}/${templateRepo}. Run deploy-template.ts first.`)
    }

    const templateData = await checkTemplate.json()

    // Ensure it's marked as a template
    if (!templateData.is_template) {
        await ghFetch(`https://api.github.com/repos/${org}/${templateRepo}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_template: true })
        })
    }

    // Check if site repo already exists
    const checkExisting = await ghFetch(`https://api.github.com/repos/${org}/${siteRepo}`)
    if (checkExisting.ok) {
        const existing = await checkExisting.json()
        return { cloneUrl: existing.clone_url, repoUrl: existing.html_url, created: false }
    }

    // Create from template
    const createResponse = await ghFetch(
        `https://api.github.com/repos/${org}/${templateRepo}/generate`,
        {
            method: 'POST',
            body: JSON.stringify({
                owner: org,
                name: siteRepo,
                description: `${siteSlug} — deployed from ${templateSlug} template`,
                private: false,
                include_all_branches: false
            })
        }
    )

    if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(`Failed to create repo: ${error.message}`)
    }

    const newRepo = await createResponse.json()

    // Wait for GitHub to set up the repo
    await new Promise(resolve => setTimeout(resolve, 3000))

    return { cloneUrl: newRepo.clone_url, repoUrl: newRepo.html_url, created: true }
}

// ─── Step 2: Inject manifest via GitHub API ──────────────────────────────────

async function injectManifestViaApi(
    siteSlug: string,
    org: string,
    manifest: Record<string, any>
) {
    const siteRepo = `site-${siteSlug}`
    const manifestContent = JSON.stringify(manifest, null, 4)
    const base64Content = Buffer.from(manifestContent).toString('base64')

    // Get existing file SHA (needed for update)
    const getFile = await ghFetch(
        `https://api.github.com/repos/${org}/${siteRepo}/contents/template.manifest.json`
    )

    const body: any = {
        message: 'Deploy: inject customer manifest',
        content: base64Content,
        branch: 'main'
    }

    if (getFile.ok) {
        const fileData = await getFile.json()
        body.sha = fileData.sha // Required for updating existing file
    }

    const updateResponse = await ghFetch(
        `https://api.github.com/repos/${org}/${siteRepo}/contents/template.manifest.json`,
        { method: 'PUT', body: JSON.stringify(body) }
    )

    if (!updateResponse.ok) {
        const error = await updateResponse.json()
        throw new Error(`Failed to inject manifest: ${error.message}`)
    }
}

// ─── Step 3: Deploy to Cloudflare Pages ──────────────────────────────────────

async function deployToCloudflare(siteSlug: string, org: string): Promise<string> {
    const projectName = `site-${siteSlug}`
    const siteUrl = `https://${projectName}.pages.dev`
    const cfToken = process.env.CLOUDFLARE_API_TOKEN
    const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!cfToken || !cfAccount) {
        return siteUrl // Manual setup required
    }

    const cfHeaders = {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json'
    }

    // Check if CF Pages project already exists
    const checkResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects/${projectName}`,
        { headers: cfHeaders }
    )

    if (checkResponse.ok) {
        // Project exists — update the SITE_URL env var so the template knows its own URL
        const updateResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects/${projectName}`,
            {
                method: 'PATCH',
                headers: cfHeaders,
                body: JSON.stringify({
                    deployment_configs: {
                        production: {
                            env_vars: {
                                SITE_URL: { type: 'plain_text', value: siteUrl }
                            }
                        }
                    }
                })
            }
        )
        if (!updateResponse.ok) {
            const error = await updateResponse.json().catch(() => ({}))
            console.warn('[deploy] CF env var update failed:', error?.errors?.[0]?.message ?? 'unknown')
        }
    } else {
        // New site — create CF Pages project connected to the GitHub repo
        const createResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects`,
            {
                method: 'POST',
                headers: cfHeaders,
                body: JSON.stringify({
                    name: projectName,
                    production_branch: 'main',
                    build_config: {
                        build_command: 'npm run build',
                        destination_dir: 'dist'
                    },
                    source: {
                        type: 'github',
                        config: {
                            owner: org,
                            repo_name: projectName,
                            production_branch: 'main'
                        }
                    }
                })
            }
        )

        if (!createResponse.ok) {
            const error = await createResponse.json().catch(() => ({}))
            throw new Error(`Failed to create CF Pages project: ${error?.errors?.[0]?.message ?? 'unknown'}`)
        }

        // Set SITE_URL env var after project creation
        const envResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects/${projectName}`,
            {
                method: 'PATCH',
                headers: cfHeaders,
                body: JSON.stringify({
                    deployment_configs: {
                        production: {
                            env_vars: {
                                SITE_URL: { type: 'plain_text', value: siteUrl }
                            }
                        }
                    }
                })
            }
        )
        if (!envResponse.ok) {
            const error = await envResponse.json().catch(() => ({}))
            console.warn('[deploy] CF env var set failed:', error?.errors?.[0]?.message ?? 'unknown')
        }
    }

    // Always explicitly trigger a build. We cannot rely solely on the GitHub
    // webhook because site-* repos created from a template may not be covered
    // by the Cloudflare GitHub App installation. This matches deploy-template.ts.
    const deployResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects/${projectName}/deployments`,
        { method: 'POST', headers: cfHeaders }
    )
    if (!deployResponse.ok) {
        const error = await deployResponse.json().catch(() => ({}))
        console.warn('[deploy] CF build trigger failed:', error?.errors?.[0]?.message ?? 'unknown')
    }

    return siteUrl
}

// ─── Route Handler (Streaming NDJSON) ────────────────────────────────────────

export async function POST(req: Request) {
    // Auth check
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit
    const { limited, remaining } = deployLimiter.check(user.id)
    if (limited) {
        return NextResponse.json(
            { error: 'Too many deploy requests. Please wait.' },
            { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
        )
    }

    // Parse body
    const body = await req.json()
    const { templateSlug, siteSlug, manifest, siteData, projectName } = body as {
        templateSlug?: string
        siteSlug?: string
        manifest?: Record<string, any>
        siteData?: Record<string, any>
        projectName?: string
    }

    if (!templateSlug || !siteSlug || !manifest) {
        return NextResponse.json(
            { error: 'templateSlug, siteSlug, and manifest are required' },
            { status: 400 }
        )
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(siteSlug)) {
        return NextResponse.json(
            { error: 'siteSlug must contain only lowercase letters, numbers, and hyphens' },
            { status: 400 }
        )
    }

    // Check required env vars
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN
    const GITHUB_ORG = process.env.GITHUB_ORG
    if (!GITHUB_TOKEN || !GITHUB_ORG) {
        return NextResponse.json(
            { error: 'GitHub credentials not configured' },
            { status: 500 }
        )
    }

    // Template lookup (pre-stream — errors return JSON, not stream)
    const { data: templateRow, error: templateLookupError } = await supabase
        .from('templates')
        .select('id, version')
        .eq('slug', templateSlug)
        .single()

    if (templateLookupError || !templateRow) {
        return NextResponse.json(
            { error: `Template not found: ${templateSlug}` },
            { status: 404 }
        )
    }

    // Resolve R2 URLs in manifest
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
    const resolvedManifest = R2_PUBLIC_URL
        ? resolveManifestR2Urls(manifest, R2_PUBLIC_URL)
        : manifest

    // Check for existing site_token (preserve on re-deploy)
    const { data: existingDeploy } = await supabase
        .from('deployments')
        .select('site_token')
        .eq('slug', siteSlug)
        .single()

    const siteToken = existingDeploy?.site_token ?? randomUUID()

    // Pre-stream upsert: create/update the deployment record with 'deploying' status
    const now = new Date().toISOString()
    const cfProjectName = `site-${siteSlug}`

    const { data: deploymentRow, error: upsertError } = await supabase
        .from('deployments')
        .upsert({
            project_name: projectName ?? siteSlug,
            slug: siteSlug,
            template_id: templateRow.id,
            template_version: templateRow.version,
            template_manifest: resolvedManifest,
            site_data: siteData ?? {},
            status: 'deploying' as const,
            deployed_by: user.id,
            deployed_at: now,
            cloudflare_project_name: cfProjectName,
            has_unpublished_changes: false,
            site_token: siteToken,
            error_message: null,
            status_log: [{
                status: 'deploying',
                step: 'started',
                message: 'Deployment initiated',
                at: now,
            }],
        }, { onConflict: 'slug' })
        .select('id')
        .single()

    if (upsertError || !deploymentRow) {
        console.error('[deploy] Pre-stream upsert failed:', upsertError?.message)
        return NextResponse.json(
            { error: 'Failed to create deployment record' },
            { status: 500 }
        )
    }

    const deploymentId = deploymentRow.id

    // Helper: append to status_log atomically via Postgres RPC
    async function logStep(status: string, step: string, message: string) {
        try {
            await supabase.rpc('append_status_log', {
                p_deployment_id: deploymentId,
                p_status: status,
                p_step: step,
                p_message: message,
            })
        } catch (err: any) {
            console.warn('[deploy] log step failed:', err?.message)
        }
    }

    // ─── Stream deploy steps as NDJSON ───────────────────────────────────────
    const encoder = new TextEncoder()
    let currentStep: DeployEvent['step'] = 'create_repo'

    const stream = new ReadableStream({
        async start(controller) {
            function emit(event: DeployEvent) {
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
            }

            let repoUrl = ''
            let siteUrl = ''

            try {
                // Step 1: Create GitHub repo
                currentStep = 'create_repo'
                emit({ step: 'create_repo', status: 'running', message: 'Creating GitHub repository...' })
                const repoResult = await createRepoFromTemplate(templateSlug!, siteSlug!, GITHUB_ORG!)
                repoUrl = repoResult.repoUrl
                await logStep('deploying', 'create_repo', repoResult.created ? 'Repository created' : 'Repository exists')
                emit({ step: 'create_repo', status: 'done', message: repoResult.created ? 'Repository created' : 'Repository already exists' })

                // Step 2: Inject manifest
                currentStep = 'inject_manifest'
                emit({ step: 'inject_manifest', status: 'running', message: 'Injecting site manifest...' })
                await injectManifestViaApi(siteSlug!, GITHUB_ORG!, resolvedManifest)
                await logStep('deploying', 'inject_manifest', 'Manifest injected into repository')
                emit({ step: 'inject_manifest', status: 'done', message: 'Manifest injected' })

                // Step 3: Cloudflare Pages setup + build trigger
                currentStep = 'cloudflare_setup'
                emit({ step: 'cloudflare_setup', status: 'running', message: 'Setting up Cloudflare Pages...' })
                siteUrl = await deployToCloudflare(siteSlug!, GITHUB_ORG!)
                await logStep('deploying', 'cloudflare_setup', 'Cloudflare Pages configured and build triggered')
                emit({ step: 'cloudflare_setup', status: 'done', message: 'Cloudflare Pages configured' })

                // Step 4: Save final deployment data
                currentStep = 'save_record'
                emit({ step: 'save_record', status: 'running', message: 'Saving deployment record...' })

                const { error: updateError } = await supabase
                    .from('deployments')
                    .update({
                        status: 'building',
                        github_repo: `${GITHUB_ORG}/site-${siteSlug}`,
                        github_repo_url: repoUrl,
                        live_url: siteUrl,
                    })
                    .eq('id', deploymentId)

                if (updateError) {
                    console.error('[deploy] Final update failed:', updateError.message)
                }

                await logStep('building', 'cloudflare_queued', 'Build queued on Cloudflare Pages')
                emit({
                    step: 'save_record',
                    status: 'done',
                    message: 'Deployment record saved',
                    data: { siteUrl, repoUrl, siteSlug },
                })

            } catch (error: any) {
                console.error(`[deploy] Error at step ${currentStep}:`, error.message)
                emit({ step: currentStep, status: 'error', message: error.message || 'Deployment failed' })

                // Record failure in DB (best-effort)
                try {
                    await supabase
                        .from('deployments')
                        .update({
                            status: 'failed',
                            error_message: error.message || 'Deployment failed',
                        })
                        .eq('id', deploymentId)
                } catch { /* best-effort */ }

                await logStep('failed', currentStep, error.message || 'Deployment failed')
            } finally {
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
