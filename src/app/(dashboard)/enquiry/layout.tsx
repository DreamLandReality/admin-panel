import type { ReactNode } from 'react'
import { requirePageCapability } from '@/lib/auth/page-guards'

export default async function EnquiryLayout({ children }: { children: ReactNode }) {
  await requirePageCapability('canViewEnquiries')
  return children
}
