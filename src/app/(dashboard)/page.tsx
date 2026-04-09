import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DeploymentCardData, DraftCardData } from '@/types'
import { computeStats } from '@/lib/utils/dashboard'
import { generateSignedUrl } from '@/lib/utils/r2-storage'
import { DeploymentCard } from '@/components/dashboard/deployment-card'
import { DraftCard } from '@/components/drafts/draft-card'
import { EmptyState } from '@/components/dashboard/empty-state'
import { SyncHeaderStats } from '@/components/dashboard/sync-header-stats'
import { SyncHeaderAction } from '@/components/dashboard/sync-header-action'
import { ROUTES } from '@/lib/constants'
import { CardGrid } from '@/components/layout/CardGrid'

export const dynamic = 'force-dynamic'

// ─── Page Component ────────────────────────────────────────────────────────

/**
 * Deployments stuck in 'deploying' or 'building' longer than this many minutes
 * are considered "zombie" deployments — likely abandoned or crashed — and are
 * automatically reset to 'failed' so the user can retry from the editor.
 */
const ZOMBIE_DEPLOYMENT_TIMEOUT_MINUTES = 15

export default async function DashboardHomePage() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Auto-recover zombie deployments stuck in 'deploying' or 'building'
  const zombieCutoff = new Date(Date.now() - ZOMBIE_DEPLOYMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString()
  await supabase
    .from('deployments')
    .update({
      status: 'failed' as const,
      error_message: `Deployment timed out (no progress for ${ZOMBIE_DEPLOYMENT_TIMEOUT_MINUTES} minutes). You can retry from the editor.`,
    })
    .eq('deployed_by', user.id)
    .in('status', ['deploying', 'building'])
    .lt('updated_at', zombieCutoff)

  const [deploymentsResult, draftsResult] = await Promise.all([
    supabase
      .from('deployments')
      .select(
        'id, project_name, slug, status, screenshot_url, template_id, has_unpublished_changes, site_data, live_url, stable_url, updated_at, templates(slug)'
      )
      .eq('deployed_by', user.id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false }),
    // Fetch new-commission drafts (no deployment linked yet)
    supabase
      .from('drafts')
      .select(
        'id, project_name, template_slug, template_id, current_step, updated_at, deployment_id, screenshot_url, deployments(project_name, screenshot_url, status), templates(preview_url)'
      )
      .eq('user_id', user.id)
      .is('deployment_id', null)
      .order('updated_at', { ascending: false }),
  ])

  if (deploymentsResult.error) {
    console.error('Failed to fetch deployments:', deploymentsResult.error)
  }

  // Resolve deployment screenshots: object keys (from private bucket) → signed URLs
  const rawDeployments = (deploymentsResult.data ?? []) as unknown as DeploymentCardData[]
  const typedDeployments = await Promise.all(
    rawDeployments.map(async (dep) => {
      if (dep.screenshot_url && !dep.screenshot_url.startsWith('http')) {
        try {
          return { ...dep, screenshot_url: await generateSignedUrl(dep.screenshot_url) }
        } catch {
          return { ...dep, screenshot_url: null }
        }
      }
      return dep
    })
  )
  const stats = computeStats(typedDeployments)

  // Resolve draft screenshots
  const rawDrafts = (draftsResult.data ?? []) as unknown as DraftCardData[]
  const typedDrafts = await Promise.all(
    rawDrafts.map(async (draft) => {
      if (draft.screenshot_url && !draft.screenshot_url.startsWith('http')) {
        try {
          return { ...draft, screenshot_url: await generateSignedUrl(draft.screenshot_url) }
        } catch {
          return { ...draft, screenshot_url: null }
        }
      }
      return draft
    })
  )

  // Merge and sort by updated_at descending
  type SiteItem =
    | { type: 'deployment'; item: DeploymentCardData; updatedAt: string }
    | { type: 'draft'; item: DraftCardData; updatedAt: string }

  const allItems: SiteItem[] = [
    ...typedDeployments.map((d) => ({ type: 'deployment' as const, item: d, updatedAt: d.updated_at })),
    ...typedDrafts.map((d) => ({ type: 'draft' as const, item: d, updatedAt: d.updated_at })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const isEmpty = allItems.length === 0

  return (
    <>
      {/* Push stats into the header via zustand store */}
      <SyncHeaderStats stats={stats} />

      {!isEmpty ? (
        <>
          <SyncHeaderAction href={ROUTES.newDeployment} label="New Commission" />
          <CardGrid columns={4}>
            {allItems.map((entry, idx) =>
              entry.type === 'deployment' ? (
                <DeploymentCard key={entry.item.id} deployment={entry.item} index={idx} />
              ) : (
                <DraftCard key={entry.item.id} draft={entry.item} index={idx} />
              )
            )}
          </CardGrid>
        </>
      ) : (
        <EmptyState
          heading="Your portfolio is empty"
          description="Begin your first architectural masterpiece. Our AI-powered studio will guide you through every detail."
          ctaLabel="New Commission"
          ctaHref={ROUTES.newDeployment}
        />
      )}
    </>
  )
}
