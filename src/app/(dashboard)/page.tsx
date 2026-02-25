import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DeploymentCardData } from '@/types'
import { computeStats } from '@/lib/utils/dashboard'
import { DeploymentCard, AddNewCard } from '@/components/dashboard/deployment-card'
import { EmptyState } from '@/components/dashboard/empty-state'
import { SyncHeaderStats } from '@/components/dashboard/sync-header-stats'

export const dynamic = 'force-dynamic'

// ─── Page Component ────────────────────────────────────────────────────────

export default async function DashboardHomePage() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const [deploymentsResult, editDraftsResult] = await Promise.all([
    supabase
      .from('deployments')
      .select(
        'id, project_name, slug, status, screenshot_url, template_id, has_unpublished_changes, site_data, live_url, updated_at'
      )
      .eq('deployed_by', user.id)
      .order('updated_at', { ascending: false }),
    // Fetch which deployments have an in-progress edit draft
    supabase
      .from('drafts')
      .select('deployment_id')
      .eq('user_id', user.id)
      .not('deployment_id', 'is', null),
  ])

  if (deploymentsResult.error) {
    console.error('Failed to fetch deployments:', deploymentsResult.error)
  }

  const typedDeployments = (deploymentsResult.data ?? []) as DeploymentCardData[]
  const stats = computeStats(typedDeployments)

  // Build a set of deployment IDs that have an active edit draft
  const editDraftIds = new Set(
    (editDraftsResult.data ?? []).map((d) => d.deployment_id as string)
  )

  return (
    <>
      {/* Push stats into the header via zustand store */}
      <SyncHeaderStats stats={stats} />

      {typedDeployments.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {typedDeployments.map((deployment, idx) => (
            <DeploymentCard
              key={deployment.id}
              deployment={deployment}
              index={idx}
              hasEditDraft={editDraftIds.has(deployment.id)}
            />
          ))}
          <AddNewCard index={typedDeployments.length} />
        </div>
      ) : (
        <EmptyState />
      )}
    </>
  )
}
