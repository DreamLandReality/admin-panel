import { requirePageCapability } from '@/lib/auth/page-guards'
import type { DeploymentCardData, DraftCardData } from '@/types'
import { computeStats } from '@/lib/utils/dashboard'
import { generateSignedUrl } from '@/lib/utils/r2-storage'
import { log } from '@/lib/log'
import { DeploymentCard } from '@/components/dashboard/deployment-card'
import { DraftCard } from '@/components/drafts/draft-card'
import { EmptyState } from '@/components/dashboard/empty-state'
import { SyncHeaderStats } from '@/components/dashboard/sync-header-stats'
import { SyncHeaderAction } from '@/components/dashboard/sync-header-action'
import { DashboardPagination } from '@/components/dashboard/dashboard-pagination'
import { DEPLOY_TIMEOUTS, ROUTES } from '@/lib/constants'
import { CardGrid } from '@/components/layout/CardGrid'

export const dynamic = 'force-dynamic'

// ─── Page Component ────────────────────────────────────────────────────────

/**
 * Deployments stuck in 'deploying' or 'building' longer than this many minutes
 * are considered "zombie" deployments — likely abandoned or crashed — and are
 * automatically reset to 'failed' so the user can retry from the editor.
 */
const ZOMBIE_DEPLOYMENT_TIMEOUT_MINUTES = DEPLOY_TIMEOUTS.HARD_CANCEL_MS / 60_000
const SALES_PAGE_SIZE = 40

function getPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams?: { page?: string | string[] }
}) {
  const { supabase, user, role } = await requirePageCapability('canViewSites')
  const isSales = role === 'sales'
  const salesPage = getPage(searchParams?.page)
  const salesFrom = (salesPage - 1) * SALES_PAGE_SIZE
  const salesTo = salesFrom + SALES_PAGE_SIZE - 1

  if (!isSales) {
    // Auto-recover zombie deployments stuck in 'deploying' or 'building'
    const zombieCutoff = new Date(Date.now() - DEPLOY_TIMEOUTS.HARD_CANCEL_MS).toISOString()
    await supabase
      .from('deployments')
      .update({
        status: 'failed' as const,
        error_message: `Deployment timed out (no progress for ${ZOMBIE_DEPLOYMENT_TIMEOUT_MINUTES} minutes). You can retry from the editor.`,
      })
      .eq('deployed_by', user.id)
      .in('status', ['deploying', 'building'])
      .lt('updated_at', zombieCutoff)
  }

  const deploymentsQuery = supabase
    .from('deployments')
    .select(
      'id, project_name, slug, status, screenshot_url, template_id, has_unpublished_changes, site_data, live_url, stable_url, updated_at, templates(slug)',
      { count: isSales ? 'exact' : undefined }
    )

  const deploymentsRequest = isSales
    ? deploymentsQuery
      .eq('status', 'live')
      .order('updated_at', { ascending: false })
      .range(salesFrom, salesTo)
    : deploymentsQuery
      .eq('deployed_by', user.id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })

  const draftsRequest = isSales
    ? Promise.resolve({ data: [], error: null })
    : supabase
      .from('drafts')
      .select(
        'id, project_name, template_slug, template_id, current_step, updated_at, deployment_id, screenshot_url, deployments(project_name, screenshot_url, status), templates(preview_url)'
      )
      .eq('user_id', user.id)
      .is('deployment_id', null)
      .order('updated_at', { ascending: false })

  const [deploymentsResult, draftsResult] = await Promise.all([
    deploymentsRequest,
    draftsRequest,
  ])

  if (deploymentsResult.error) {
    log.error('Failed to fetch deployments:', deploymentsResult.error)
  }

  const deploymentTotal = isSales ? deploymentsResult.count ?? 0 : deploymentsResult.data?.length ?? 0

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
  const stats = isSales
    ? [{ label: 'Live Sites', value: deploymentTotal, colorClass: 'text-success' }]
    : computeStats(typedDeployments)

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
          {!isSales && <SyncHeaderAction href={ROUTES.newDeployment} label="New Commission" />}
          <CardGrid columns={4}>
            {allItems.map((entry, idx) =>
              entry.type === 'deployment' ? (
                <DeploymentCard
                  key={entry.item.id}
                  deployment={entry.item}
                  index={idx}
                  canEdit={!isSales}
                  canDelete={!isSales}
                />
              ) : (
                <DraftCard key={entry.item.id} draft={entry.item} index={idx} />
              )
            )}
          </CardGrid>
          {isSales && (
            <DashboardPagination
              page={salesPage}
              total={deploymentTotal}
              pageSize={SALES_PAGE_SIZE}
            />
          )}
        </>
      ) : (
        <EmptyState
          heading={isSales ? 'No live sites yet' : 'Your portfolio is empty'}
          description={isSales
            ? 'Live property sites will appear here when they are ready for sales follow-up.'
            : 'Begin your first architectural masterpiece. Our AI-powered studio will guide you through every detail.'}
          ctaLabel={isSales ? undefined : 'New Commission'}
          ctaHref={isSales ? undefined : ROUTES.newDeployment}
        />
      )}
    </>
  )
}
