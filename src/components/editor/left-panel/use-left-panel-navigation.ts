'use client'

import { useMemo, type RefObject } from 'react'
import { usePageList } from '@/hooks/use-page-list'
import { postToIframe } from '@/lib/utils/iframe'
import type { PageEntry } from '@/lib/utils/page-list'
import { useEditorStore } from '@/stores/editor-store'
import { useUiStore } from '@/stores/ui-store'
import { useWizardStore } from '@/stores/wizard-store'
import type { FieldGroup, ManifestPage, ManifestSection } from '@/types'

interface UseLeftPanelNavigationOptions {
  iframeRef?: RefObject<HTMLIFrameElement | null>
  onPageSelected: () => void
}

export function useLeftPanelNavigation({
  iframeRef,
  onPageSelected,
}: UseLeftPanelNavigationOptions) {
  const selectedTemplate = useWizardStore((state) => state.selectedTemplate)
  const activePage = useUiStore((state) => state.activePage)
  const sectionsRegistry = useEditorStore((state) => state.sectionsRegistry)
  const selection = useUiStore((state) => state.selection)

  const setActivePage = useUiStore((state) => state.setActivePage)
  const toggleSection = useEditorStore((state) => state.toggleSection)
  const setSelection = useUiStore((state) => state.setSelection)
  const clearSelection = useUiStore((state) => state.clearSelection)

  const manifest = selectedTemplate?.manifest
  const allSections: ManifestSection[] = useMemo(() => manifest?.sections ?? [], [manifest])
  const hasCollections = Array.isArray(manifest?.collections) && manifest.collections.length > 0
  const pages = usePageList()

  const staticPages = useMemo(() => pages.filter((page) => page.kind === 'static'), [pages])
  const dynamicParents = useMemo(() => pages.filter((page) => page.kind === 'dynamic-parent'), [pages])
  const dynamicChildren = useMemo(() => pages.filter((page) => page.kind === 'dynamic'), [pages])

  const currentPageEntry = pages.find((page) => page.id === activePage)
  const currentPageName = currentPageEntry?.name ?? activePage
  const isDynamicPage = currentPageEntry?.kind === 'dynamic'
  const isDynamicParent = currentPageEntry?.kind === 'dynamic-parent'
  const dynamicPageDef = isDynamicPage || isDynamicParent
    ? findDynamicPage(manifest?.pages, currentPageEntry)
    : undefined
  const fieldGroups: FieldGroup[] = dynamicPageDef?.fieldGroups ?? []
  const parentLabelTarget = dynamicPageDef?.sharedSectionId ?? currentPageEntry?.sourceSection
  const sharedFieldGroups: FieldGroup[] = isDynamicParent ? (dynamicPageDef?.sharedFieldGroups ?? []) : []

  const currentManifestPage = manifest?.pages?.find((page) => page.id === activePage)
  const hasNewStructure = !!(currentManifestPage?.sections || manifest?.globalSections)
  const { pageSections, globalSections } = resolveVisibleSections({
    activePage,
    allSections,
    currentManifestPage,
    globalSectionIds: manifest?.globalSections,
    hasNewStructure,
  })

  function getFirstComponentId(pageId: string): string | null {
    const targetPage = pages.find((page) => page.id === pageId)

    if (targetPage?.kind === 'dynamic-parent') {
      const dynamicPage = findDynamicPage(manifest?.pages, targetPage)
      const labelTarget = dynamicPage?.sharedSectionId ?? targetPage.sourceSection
      const groups: FieldGroup[] = dynamicPage?.sharedFieldGroups ?? []
      return groups.length > 0 ? `labels:${labelTarget}:${groups[0].id}` : `labels:${labelTarget}`
    }

    if (targetPage?.kind === 'dynamic') {
      const dynamicPage = findDynamicPage(manifest?.pages, targetPage)
      const groups: FieldGroup[] = dynamicPage?.fieldGroups ?? []
      return groups.length > 0 ? `detail:${groups[0].id}` : null
    }

    if (hasNewStructure) {
      const page = manifest?.pages?.find((manifestPage) => manifestPage.id === pageId)
      const firstPageSection = (page?.sections ?? [])
        .map((sectionId) => allSections.find((section) => section.id === sectionId))
        .find((section): section is ManifestSection => !!section)
      if (firstPageSection) return firstPageSection.id

      const firstGlobal = (manifest?.globalSections ?? [])
        .map((sectionId) => allSections.find((section) => section.id === sectionId))
        .find((section): section is ManifestSection => !!section)
      return firstGlobal?.id ?? null
    }

    const pageSpecificSections = allSections.filter((section) => section.page === pageId)
    if (pageSpecificSections.length > 0) return pageSpecificSections[0].id

    const globalOnlySections = allSections.filter((section) => !section.page || section.page === '*')
    return globalOnlySections[0]?.id ?? null
  }

  function handlePageSelect(pageId: string) {
    onPageSelected()
    setActivePage(pageId)
    clearSelection()

    const firstComponentId = getFirstComponentId(pageId)
    if (firstComponentId) {
      setSelection({ mode: 'section', sectionId: firstComponentId, field: null, elementType: null, content: null })
    }
  }

  function handleComponentClick(sectionId: string) {
    setSelection({ mode: 'section', sectionId, field: null, elementType: null, content: null })
    if (iframeRef) {
      postToIframe(iframeRef, { type: 'scroll-to-section', sectionId })
    }
  }

  return {
    activePage,
    allSections,
    currentPageName,
    dynamicChildren,
    dynamicPageDef,
    dynamicParents,
    fieldGroups,
    globalSections,
    handleComponentClick,
    handlePageSelect,
    hasCollections,
    isDynamicPage,
    isDynamicParent,
    pageSections,
    parentLabelTarget,
    sectionsRegistry,
    selection,
    sharedFieldGroups,
    staticPages,
    toggleSection,
  }
}

function findDynamicPage(
  pages: ManifestPage[] | undefined,
  pageEntry: PageEntry | undefined
): ManifestPage | undefined {
  if (!pageEntry) return undefined

  return pages?.find(
    (page) => page.dynamic && (page.id === pageEntry.dynamicPageId || page.sourceSection === pageEntry.sourceSection)
  )
}

function resolveVisibleSections({
  activePage,
  allSections,
  currentManifestPage,
  globalSectionIds,
  hasNewStructure,
}: {
  activePage: string
  allSections: ManifestSection[]
  currentManifestPage?: ManifestPage
  globalSectionIds?: string[]
  hasNewStructure: boolean
}): {
  pageSections: ManifestSection[]
  globalSections: ManifestSection[]
} {
  if (hasNewStructure) {
    const pageSections = (currentManifestPage?.sections ?? [])
      .map((sectionId) => allSections.find((section) => section.id === sectionId))
      .filter((section): section is ManifestSection => !!section)
    const globalSections = (globalSectionIds ?? [])
      .map((sectionId) => allSections.find((section) => section.id === sectionId))
      .filter((section): section is ManifestSection => !!section)

    return { pageSections, globalSections }
  }

  const visibleSections = allSections.filter((section) => {
    if (!section.page || section.page === '*') return true
    if (section.page === activePage) return true
    return false
  })

  return {
    globalSections: visibleSections.filter((section) => section.page === '*'),
    pageSections: visibleSections.filter((section) => section.page !== '*'),
  }
}
