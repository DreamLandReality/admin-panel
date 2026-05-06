import { requireCapability } from '@/lib/api/auth'
import { apiData, apiError } from '@/lib/api/response'

export async function GET() {
  const auth = await requireCapability('canManageTemplates')
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)
  return apiData(data)
}
