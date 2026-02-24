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

  const { data: drafts, error: queryError } = await supabase
    .from('drafts')
    .select('id, project_name, template_slug, template_id, current_step, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (queryError) {
    console.error('Failed to fetch drafts:', queryError)
  }

  const typedDrafts = (drafts ?? []) as DraftCardData[]

  return (
    <>
      {typedDrafts.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {typedDrafts.map((draft, idx) => (
            <DraftCard key={draft.id} draft={draft} index={idx} />
          ))}
        </div>
      ) : (
        <EmptyState
          heading="No drafts yet"
          description="Drafts will appear here when you save your work in the editor. Start a new commission to begin."
          ctaLabel="New Commission"
          ctaHref="/deployments/new"
        />
      )}
    </>
  )
}
