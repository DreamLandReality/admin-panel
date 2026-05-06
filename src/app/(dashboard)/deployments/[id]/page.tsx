import { redirect } from 'next/navigation'
import { requirePageCapability } from '@/lib/auth/page-guards'
import { ROUTES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function EditDeploymentPage({ params }: { params: { id: string } }) {
  await requirePageCapability('canEditSites')
  redirect(ROUTES.editor(params.id))
}
