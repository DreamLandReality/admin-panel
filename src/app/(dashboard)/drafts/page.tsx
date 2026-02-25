import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DraftCardData } from '@/types'
import { DraftCard } from '@/components/drafts/draft-card'
import { EmptyState } from '@/components/dashboard/empty-state'

export const dynamic = 'force-dynamic'

export default async function DraftsPage() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch all drafts — for edit-site drafts, join the deployment to get project_name + thumbnail
  const { data: drafts, error: queryError } = await supabase
    .from('drafts')
    .select(
      'id, project_name, template_slug, template_id, current_step, updated_at, deployment_id, deployments(project_name, screenshot_url, status)'
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (queryError) {
    console.error('Failed to fetch drafts:', queryError)
  }

  const typedDrafts = (drafts ?? []) as DraftCardData[]

  // Split into edit-site drafts and new-site drafts
  const editDrafts = typedDrafts.filter((d) => d.deployment_id !== null)
  const newDrafts = typedDrafts.filter((d) => d.deployment_id === null)

  if (typedDrafts.length === 0) {
    return (
      <EmptyState
        heading="No drafts yet"
        description="Drafts will appear here when you save your work in the editor. Start a new commission to begin."
        ctaLabel="New Commission"
        ctaHref="/deployments/new"
      />
    )
  }

  return (
    <div className="space-y-10">
      {/* ── Edit-site drafts (in-progress edits of live sites) ── */}
      {editDrafts.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
            In Progress — Editing Live Sites
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {editDrafts.map((draft, idx) => (
              <DraftCard key={draft.id} draft={draft} index={idx} />
            ))}
          </div>
        </section>
      )}

      {/* ── New-site drafts (wizard in-progress) ── */}
      {newDrafts.length > 0 && (
        <section>
          {editDrafts.length > 0 && (
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              New Commissions
            </h2>
          )}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {newDrafts.map((draft, idx) => (
              <DraftCard key={draft.id} draft={draft} index={editDrafts.length + idx} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
