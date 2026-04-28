import { useMemo } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { useEditorStore } from '@/stores/editor-store'
import { buildPageList, type PageEntry } from '@/lib/utils/page-list'

export function usePageList(): PageEntry[] {
  const manifest = useWizardStore((s) => s.selectedTemplate?.manifest)
  const sectionData = useEditorStore((s) => s.sectionData)
  const collectionData = useEditorStore((s) => s.collectionData)
  return useMemo(() => buildPageList(manifest, sectionData, collectionData), [manifest, sectionData, collectionData])
}
