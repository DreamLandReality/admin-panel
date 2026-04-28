import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { runDeployPipeline, runRedeployPipeline } from '@/lib/deploy/pipeline'
import type { Deployment, Template, DeployEvent } from '@/types'

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
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

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

  // Only the owner can stream their own deployment
  if (deployment.deployed_by !== user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  // If already live or failed — send a synthetic done/error event and close
  if (deployment.status === 'live') {
    const event: DeployEvent = {
      step: 'cf_build',
      status: 'done',
      message: 'Site is already live',
      data: { siteUrl: (deployment as any).stable_url ?? deployment.live_url ?? undefined },
    }
    return new Response(`data: ${JSON.stringify(event)}\n\n`, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  if (deployment.status === 'failed') {
    const event: DeployEvent = {
      step: 'cf_build',
      status: 'error',
      message: deployment.error_message ?? 'Deployment failed',
    }
    return new Response(`data: ${JSON.stringify(event)}\n\n`, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // ── 3. Fetch template (fall back to frozen manifest if deleted) ───────────
  let template: Template

  const { data: liveTemplate } = await svc
    .from('templates')
    .select('*')
    .eq('id', deployment.template_id)
    .maybeSingle()

  if (liveTemplate) {
    template = liveTemplate as unknown as Template
  } else {
    // Template was deleted — reconstruct minimal object from frozen snapshot
    const manifest = deployment.template_manifest as any
    template = {
      id: deployment.template_id,
      slug: manifest?.templateId ?? deployment.slug,
      name: deployment.project_name,
      description: null,
      category: 'luxury',
      framework: 'astro',
      github_repo: `${env.GITHUB_ORG}/template-${manifest?.templateId ?? 'unknown'}`,
      manifest,
      config: {} as any,
      default_data: null,
      preview_url: null,
      preview_image: null,
      version: deployment.template_version,
      is_active: false,
      created_at: deployment.created_at,
      updated_at: deployment.updated_at,
    }
  }

  // ── 4. Stream pipeline ────────────────────────────────────────────────────
  const isRepublish = !!deployment.github_repo
  const typedDeployment = deployment as unknown as Deployment

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
      } catch (err: any) {
        // Mark as failed if pipeline threw without already handling it
        const { error: updateError } = await svc
          .from('deployments')
          .update({
            status: 'failed',
            error_message: err.message ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', deployment.id)
          .in('status', ['deploying', 'building'])

        if (updateError) {
          console.error(`[Stream] Failed to mark deployment ${deployment.id} as failed:`, updateError.message)
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
