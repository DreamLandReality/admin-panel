import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { requireCapability } from '@/lib/api/auth'
import { env } from '@/lib/env'
import { log } from '@/lib/log'
import { runDeployPipeline, runRedeployPipeline } from '@/lib/deploy/pipeline'
import type { Deployment, DeployEvent, Template, TemplateConfig, TemplateManifest } from '@/types'

type RouteContext = { params: { id: string } }

/** Create a Supabase client using the service role key (bypasses RLS). */
function createServiceClient() {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

function sseEvent(event: DeployEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

function sseResponse(event: DeployEvent): Response {
  return new Response(sseEvent(event), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function buildFallbackTemplate(deployment: Deployment): Template {
  const manifest = deployment.template_manifest as TemplateManifest
  const config: TemplateConfig = {
    id: deployment.template_id,
    name: deployment.project_name,
    description: 'Frozen deployment template snapshot',
    category: 'luxury',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    previewUrl: null,
    version: deployment.template_version,
    sectionCount: manifest.sections.length,
    previewRuntimeVersion: 'unknown',
  }

  return {
    id: deployment.template_id,
    slug: manifest.templateId ?? deployment.slug,
    name: deployment.project_name,
    description: null,
    category: config.category,
    framework: 'astro',
    github_repo: `${env.GITHUB_ORG}/template-${manifest.templateId ?? 'unknown'}`,
    manifest,
    config,
    default_data: null,
    preview_url: null,
    preview_image: null,
    version: deployment.template_version,
    is_active: false,
    created_at: deployment.created_at,
    updated_at: deployment.updated_at,
  }
}

export const dynamic = 'force-dynamic'

/**
 * GET /api/deploy/[id]/stream
 *
 * Runs the deploy or redeploy pipeline for the given deployment ID
 * and streams progress as Server-Sent Events.
 *
 * The client (progress page) connects here immediately after navigating
 * from the editor. If the SSE connection drops, the client falls back
 * to polling GET /api/deployments/[id].
 *
 * Events: data: {"step":"...","status":"running|done|error","message":"..."}
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const auth = await requireCapability('canManageSites')
  if (!auth.ok) {
    return new Response(auth.response.status === 401 ? 'Unauthorized' : 'Forbidden', { status: auth.response.status })
  }
  const { user } = auth

  const svc = createServiceClient()

  // ── 2. Fetch deployment ───────────────────────────────────────────────────
  const { data: deployment, error: depError } = await svc
    .from('deployments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (depError || !deployment) {
    return new Response('Deployment not found', { status: 404 })
  }
  const typedDeployment = deployment as unknown as Deployment

  // Only the owner can stream their own deployment
  if (typedDeployment.deployed_by !== user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  // If already live or failed — send a synthetic done/error event and close
  if (typedDeployment.status === 'live') {
    const event: DeployEvent = {
      step: 'cf_build',
      status: 'done',
      message: 'Site is already live',
      data: { siteUrl: typedDeployment.stable_url ?? typedDeployment.live_url ?? undefined },
    }
    return sseResponse(event)
  }

  if (typedDeployment.status === 'failed') {
    const event: DeployEvent = {
      step: 'cf_build',
      status: 'error',
      message: typedDeployment.error_message ?? 'Deployment failed',
    }
    return sseResponse(event)
  }

  // ── 3. Fetch template (fall back to frozen manifest if deleted) ───────────
  let template: Template

  const { data: liveTemplate } = await svc
    .from('templates')
    .select('*')
    .eq('id', typedDeployment.template_id)
    .maybeSingle()

  if (liveTemplate) {
    template = liveTemplate as unknown as Template
  } else {
    // Template was deleted — reconstruct minimal object from frozen snapshot
    template = buildFallbackTemplate(typedDeployment)
  }

  // ── 4. Stream pipeline ────────────────────────────────────────────────────
  const isRepublish = !!typedDeployment.github_repo

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (s: string) => new TextEncoder().encode(s)

      function emit(event: DeployEvent) {
        try {
          controller.enqueue(encode(sseEvent(event)))
        } catch {
          // Client disconnected — pipeline continues server-side
        }
      }

      try {
        if (isRepublish) {
          await runRedeployPipeline(typedDeployment, template, svc, emit)
        } else {
          await runDeployPipeline(typedDeployment, template, svc, emit)
        }
      } catch (err: unknown) {
        // Mark as failed if pipeline threw without already handling it
        const { error: updateError } = await svc
          .from('deployments')
          .update({
            status: 'failed',
            error_message: getErrorMessage(err),
            updated_at: new Date().toISOString(),
          })
          .eq('id', typedDeployment.id)
          .in('status', ['deploying', 'building'])

        if (updateError) {
          log.error(`[Stream] Failed to mark deployment ${typedDeployment.id} as failed:`, updateError.message)
        }
      } finally {
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
