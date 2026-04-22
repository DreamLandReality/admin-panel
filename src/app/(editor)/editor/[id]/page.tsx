import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Deployment, Template } from '@/types'
import { EditDeploymentLoader } from './edit-deployment-loader'

export const dynamic = 'force-dynamic'

export default async function EditorPage({
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

  const { data: deployment } = await supabase
    .from('deployments')
    .select('*')
    .eq('id', params.id)
    .eq('deployed_by', user.id)
    .single()

  if (!deployment) notFound()

  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', deployment.template_id)
    .single()

  if (!template) notFound()

  return (
    <EditDeploymentLoader
      deployment={deployment as Deployment}
      template={template as Template}
    />
  )
}
