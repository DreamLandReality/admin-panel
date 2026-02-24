import { useMemo } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { buildPageList, type PageEntry } from '@/lib/utils/page-list'

export function usePageList(): PageEntry[] {
  const manifest = useWizardStore((s) => s.selectedTemplate?.manifest)
  const sectionData = useWizardStore((s) => s.sectionData)
  const collectionData = useWizardStore((s) => s.collectionData)
  return useMemo(() => buildPageList(manifest, sectionData, collectionData), [manifest, sectionData, collectionData])
}
