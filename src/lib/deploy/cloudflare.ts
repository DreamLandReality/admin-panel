import { env } from '@/lib/env'
import { log } from '@/lib/log'

interface CloudflareError {
  code?: string | number
  message?: string
}

interface CloudflareEnvelope<T> {
  success: boolean
  errors?: CloudflareError[]
  result?: T
}

interface CloudflarePagesProject {
  id?: string
  subdomain?: string
}

interface CloudflareDeploymentStage {
  name: string
  status: DeploymentStage['status'] | 'running' | string
}

interface CloudflareDeployment {
  id?: string
  url?: string
  latest_stage?: CloudflareDeploymentStage
  stages?: CloudflareDeploymentStage[]
}

function cfBase() {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}`
}

function cfHeaders() {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${cfBase()}${path}`
  log.info(`[Cloudflare] ${init?.method ?? 'GET'} ${path}`)

  const res = await fetch(url, {
    ...init,
    headers: { ...cfHeaders(), ...(init?.headers ?? {}) },
  })
  const json = (await res.json()) as CloudflareEnvelope<T>

  if (!json.success) {
    const errors = json.errors ?? []
    // Log full error details so we can see the code + message
    log.error(`[Cloudflare] API failure on ${init?.method ?? 'GET'} ${path}`)
    log.error(`[Cloudflare] HTTP status: ${res.status}`)
    log.error(`[Cloudflare] Errors:`, JSON.stringify(errors, null, 2))
    if (init?.body) {
      log.error(`[Cloudflare] Request body:`, init.body)
    }
    // Include error code in the thrown message so it surfaces in the UI
    const first = errors[0]
    const code = first?.code ? ` (code ${first.code})` : ''
    const msg = first?.message
      ? `${first.message}${code}`
      : `Cloudflare API error ${res.status} on ${path}`
    throw new Error(msg)
  }
  return json.result as T
}

/** Check if a Cloudflare Pages project already exists. */
export async function getProject(
  projectName: string
): Promise<{ exists: boolean; projectId?: string; projectUrl?: string }> {
  try {
    const result = await cfFetch<CloudflarePagesProject>(`/pages/projects/${projectName}`)
    return {
      exists: true,
      projectId: result?.id,
      projectUrl: result?.subdomain ? `https://${result.subdomain}` : undefined,
    }
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    if (msg.toLowerCase().includes('not found') || msg.includes('10006')) {
      return { exists: false }
    }
    throw err  // propagate auth / network errors
  }
}

/** Create a Cloudflare Pages project connected to the given GitHub repo. */
export async function createPagesProject(
  projectName: string,
  githubOwner: string,
  githubRepoName: string,
  siteUrl: string
): Promise<{ projectId: string; projectUrl: string }> {
  const base = cfBase()
  const headers = cfHeaders()

  // Step 1: Create project
  log.info(`[Cloudflare] Creating Pages project: ${projectName}`)
  const createRes = await fetch(`${base}/pages/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      build_config: {
        build_command: 'npm run build',
        destination_dir: 'dist',
      },
      source: {
        type: 'github',
        config: {
          owner: githubOwner,
          repo_name: githubRepoName,
          production_branch: 'main',
        },
      },
    }),
  })

  if (!createRes.ok) {
    const body = await createRes.json().catch(() => ({ errors: [] }))
    log.error('[Cloudflare] Project creation failed:', JSON.stringify(body, null, 2))
    const msg = body?.errors?.[0]?.message ?? `Cloudflare API error ${createRes.status}`
    throw new Error(msg)
  }

  const created = await createRes.json()
  const projectId: string = created?.result?.id ?? ''
  // Read subdomain from CF response (e.g. "my-site.pages.dev"); fall back to constructed value
  const cfSubdomain: string = created?.result?.subdomain ?? ''

  // Step 2: Set SITE_URL env var (non-fatal — same as deploy-template.ts)
  const envRes = await fetch(`${base}/pages/projects/${projectName}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      deployment_configs: {
        production: { env_vars: { SITE_URL: { type: 'plain_text', value: siteUrl } } },
      },
    }),
  })
  if (!envRes.ok) {
    const err = await envRes.json().catch(() => ({ errors: [] }))
    log.warn(`[Cloudflare] Failed to set SITE_URL (non-fatal): ${err?.errors?.[0]?.message ?? envRes.status}`)
  }

  return { projectId, projectUrl: cfSubdomain ? `https://${cfSubdomain}` : `https://${projectName}.pages.dev` }
}

/** Update production environment variables on a Cloudflare Pages project. */
export async function updateProjectEnvVars(
  projectName: string,
  vars: Record<string, string>
): Promise<void> {
  const envVars = Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [
      key,
      { type: 'plain_text', value },
    ])
  )

  await cfFetch(`/pages/projects/${projectName}`, {
    method: 'PATCH',
    body: JSON.stringify({
      deployment_configs: {
        production: { env_vars: envVars },
      },
    }),
  })
}

/** Manually trigger a deployment (used for republish). */
export async function triggerDeployment(projectName: string): Promise<{ deploymentId: string }> {
  const result = await cfFetch<CloudflareDeployment>(`/pages/projects/${projectName}/deployments`, {
    method: 'POST',
  })
  return { deploymentId: result.id ?? '' }
}

/** Delete a Cloudflare Pages project. Site goes offline immediately. */
export async function deleteProject(projectName: string): Promise<void> {
  await cfFetch(`/pages/projects/${projectName}`, { method: 'DELETE' })
}

export interface DeploymentStage {
  name: string
  status: 'idle' | 'active' | 'canceled' | 'success' | 'failure'
}

/**
 * Poll until the latest Cloudflare Pages deployment succeeds or fails.
 * Calls onProgress with each stage transition for SSE streaming.
 *
 * @param triggeredDeploymentId — if provided, only match this specific CF deployment ID.
 *   Pass the ID returned by triggerDeployment() on redeploy to avoid matching a stale
 *   previously-succeeded build that is still showing in the API response.
 */
export async function waitForDeployment(
  projectName: string,
  maxWaitMs = 300_000,
  onProgress?: (stage: string, status: string) => void,
  triggeredDeploymentId?: string
): Promise<{ success: boolean; url: string; logs?: string }> {
  const deadline = Date.now() + maxWaitMs
  let lastStage = ''

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000))

    let deployments: CloudflareDeployment[]
    try {
      deployments = await cfFetch<CloudflareDeployment[]>(`/pages/projects/${projectName}/deployments`)
    } catch {
      // Transient network error — keep polling
      continue
    }

    if (!Array.isArray(deployments) || deployments.length === 0) continue

    // Scan all deployments (not just [0]) — multiple may be queued at once.
    // If triggeredDeploymentId is provided, only match that specific deployment to avoid
    // returning a stale previously-succeeded build (P0: redeploy stale match bug).
    const succeeded = deployments.find(
      (deployment) => deployment.latest_stage?.name === 'deploy' && deployment.latest_stage?.status === 'success'
        && (!triggeredDeploymentId || deployment.id === triggeredDeploymentId)
    )
    if (succeeded) {
      onProgress?.('deploy', 'success')
      // Return the deployment-specific hash URL (e.g. abc123.projectName.pages.dev)
      // so Puppeteer can screenshot the exact build that was just completed.
      const url = succeeded.url ?? ''
      return { success: true, url }
    }

    // Report progress from the most active (non-idle) deployment
    const active = deployments.find(
      (deployment) => deployment.latest_stage?.status === 'active' || deployment.latest_stage?.status === 'running'
    ) ?? deployments[0]
    const stage = active?.latest_stage
    if (!stage) continue

    const currentStage = `${stage.name}:${stage.status}`
    if (currentStage !== lastStage) {
      lastStage = currentStage
      onProgress?.(stage.name, stage.status)
    }

    // Only treat as failed if ALL deployments have failed/canceled
    const allDone = deployments.every(
      (deployment) => deployment.latest_stage?.status === 'failure' || deployment.latest_stage?.status === 'canceled'
    )
    if (allDone) {
      const failed = deployments[0]
      const logs = failed?.stages
        ?.map((stage) => `[${stage.name}] ${stage.status}`)
        .join('\n')
      return { success: false, url: '', logs }
    }
  }

  // Timed out — return partial success (caller sets status=building)
  return {
    success: false,
    url: '',
    logs: 'Build timed out after 5 minutes. Check Cloudflare dashboard.',
  }
}
