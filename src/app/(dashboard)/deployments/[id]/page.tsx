import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default function EditDeploymentPage({ params }: { params: { id: string } }) {
  redirect(ROUTES.editor(params.id))
}
