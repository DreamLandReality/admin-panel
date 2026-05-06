import type { ReactNode } from 'react'
import { requirePageCapability } from '@/lib/auth/page-guards'

export default async function NewDeploymentLayout({ children }: { children: ReactNode }) {
  await requirePageCapability('canCreateSites')
  return children
}
