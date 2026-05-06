import { requireCapability } from '@/lib/api/auth'
import { apiData, apiError, apiOk } from '@/lib/api/response'

/**
 * GET /api/drafts/:id — Fetch a single draft (for resume flow)
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return apiError(error.message, 404)
  }

  return apiData(data)
}

/**
 * DELETE /api/drafts/:id — Delete a draft
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return apiError(error.message, 500)
  }

  return apiOk({ success: true })
}
