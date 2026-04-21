import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DeploymentCardData } from '@/types'
import { generateSignedUrl } from '@/lib/utils/r2-storage'
import { ArchivedCard } from '@/components/dashboard/archived-card'
import { CardGrid } from '@/components/layout/CardGrid'
import { EmptyState } from '@/components/dashboard/empty-state'

export const dynamic = 'force-dynamic'

export default async function ArchivedPage() {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data, error } = await supabase
    .from('deployments')
    .select('id, project_name, slug, status, screenshot_url, template_id, has_unpublished_changes, site_data, live_url, stable_url, updated_at, templates(slug)')
    .eq('deployed_by', user.id)
    .eq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) console.error('Failed to fetch archived deployments:', error)

  const raw = (data ?? []) as unknown as DeploymentCardData[]
  const deployments = await Promise.all(
    raw.map(async (dep) => {
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

  if (deployments.length === 0) {
    return (
      <EmptyState
        heading="No archived sites"
        description="Sites you delete will appear here. You can restore them at any time."
        ctaLabel="Back to Dashboard"
        ctaHref="/"
      />
    )
  }

  return (
    <CardGrid columns={4}>
      {deployments.map((dep, idx) => (
        <ArchivedCard key={dep.id} deployment={dep} index={idx} />
      ))}
    </CardGrid>
  )
}
