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

  const { data: deployments, error: queryError } = await supabase
    .from('deployments')
    .select(
      'id, project_name, slug, status, screenshot_url, template_id, has_unpublished_changes, site_data, updated_at'
    )
    .eq('deployed_by', user.id)
    .order('updated_at', { ascending: false })

  if (queryError) {
    console.error('Failed to fetch deployments:', queryError)
  }

  const typedDeployments = (deployments ?? []) as DeploymentCardData[]
  const stats = computeStats(typedDeployments)

  return (
    <>
      {/* Push stats into the header via zustand store */}
      <SyncHeaderStats stats={stats} />

      {typedDeployments.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {typedDeployments.map((deployment, idx) => (
            <DeploymentCard
              key={deployment.id}
              deployment={deployment}
              index={idx}
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
