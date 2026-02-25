import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Deployment, Template, Draft } from '@/types'
import { EditDeploymentLoader } from './edit-deployment-loader'

export const dynamic = 'force-dynamic'

export default async function EditDeploymentPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')

  // Fetch deployment — scoped to the current user
  const { data: deployment } = await supabase
    .from('deployments')
    .select('*')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .single()

  if (!deployment) notFound()

  // Fetch the template used by this deployment
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', deployment.template_id)
    .single()

  if (!template) notFound()

  // Check for an existing edit-site draft for this deployment
  const { data: editDraft } = await supabase
    .from('drafts')
    .select('*')
    .eq('user_id', user.id)
    .eq('deployment_id', params.id)
    .maybeSingle()

  return (
    <EditDeploymentLoader
      deployment={deployment as Deployment}
      template={template as Template}
      editDraft={(editDraft as Draft) ?? null}
    />
  )
}
