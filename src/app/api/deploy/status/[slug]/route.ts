import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/deploy/status/[slug]
 *
 * Polls Cloudflare Pages for the real build status of a deployed site,
 * syncs it to Supabase via the append_status_log RPC, and returns
 * the current status with CF stage details.
 */

// Map Cloudflare's stage status → our DeploymentStatus
function mapCfStatus(
    stageName: string,
    stageStatus: string
): 'building' | 'live' | 'failed' {
    if (stageStatus === 'failure' || stageStatus === 'canceled') return 'failed'
    if (stageName === 'deploy' && stageStatus === 'success') return 'live'
    return 'building'
}

export async function GET(
    _req: Request,
    { params }: { params: { slug: string } }
) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug } = params
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

    const cfToken = process.env.CLOUDFLARE_API_TOKEN
    const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!cfToken || !cfAccount) {
        // No CF credentials — fall back to what's in the DB
        const { data } = await supabase
            .from('deployments')
            .select('status')
            .eq('slug', slug)
            .single()
        return NextResponse.json({ status: data?.status ?? 'building' })
    }

    const projectName = `site-${slug}`

    try {
        // Fetch the latest deployment from Cloudflare Pages
        const cfRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects/${projectName}/deployments?per_page=1`,
            {
                headers: {
                    Authorization: `Bearer ${cfToken}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!cfRes.ok) {
            // CF project may not exist yet (first deploy still initializing)
            return NextResponse.json({ status: 'building' })
        }

        const cfData = await cfRes.json()
        const latestDeployment = cfData.result?.[0]

        if (!latestDeployment) {
            return NextResponse.json({ status: 'building' })
        }

        const latestStage = latestDeployment.latest_stage
        const status = mapCfStatus(latestStage?.name ?? '', latestStage?.status ?? '')

        // Sync status back to Supabase only on terminal states
        if (status === 'live' || status === 'failed') {
            // Fetch current deployment to check if status actually changed
            const { data: existing } = await supabase
                .from('deployments')
                .select('id, status')
                .eq('slug', slug)
                .single()

            if (existing && existing.status !== status) {
                const stepName = status === 'live' ? 'deploy_complete' : 'deploy_failed'
                const message = status === 'live'
                    ? 'Build completed and deployed to Cloudflare Pages'
                    : `Build failed at stage: ${latestStage?.name ?? 'unknown'}`

                // Use atomic append_status_log RPC
                try {
                    await supabase.rpc('append_status_log', {
                        p_deployment_id: existing.id,
                        p_status: status,
                        p_step: stepName,
                        p_message: message,
                    })
                } catch (err: any) {
                    console.warn('[deploy/status] log failed:', err?.message)
                }

                // Update additional fields on terminal state
                if (status === 'live') {
                    try {
                        await supabase
                            .from('deployments')
                            .update({
                                cloudflare_project_id: latestDeployment.project_id ?? null,
                            })
                            .eq('id', existing.id)
                    } catch { /* best-effort */ }
                }

                if (status === 'failed') {
                    try {
                        await supabase
                            .from('deployments')
                            .update({
                                error_message: `Build failed at stage: ${latestStage?.name ?? 'unknown'}`,
                            })
                            .eq('id', existing.id)
                    } catch { /* best-effort */ }
                }
            }
        }

        // Return richer CF data
        return NextResponse.json({
            status,
            cfStage: latestStage?.name,
            cfStageStatus: latestStage?.status,
            cfDeploymentId: latestDeployment?.id,
            stages: latestDeployment?.stages?.map((s: any) => ({
                name: s.name,
                status: s.status,
            })),
        })
    } catch (err: any) {
        console.error('[deploy/status] Error:', err.message)
        return NextResponse.json({ status: 'building' })
    }
}
