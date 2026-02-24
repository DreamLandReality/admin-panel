'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { usePageList } from '@/hooks/use-page-list'
import { CollectionsPanel } from './collections-panel'
import type { ManifestSection, FieldGroup } from '@/types'

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronDown({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="10" height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className={cn('transition-transform duration-150 flex-shrink-0', rotated && 'rotate-180')}
      aria-hidden="true"
    >
      <path d="M2 3.5L5 6.5l3-3" />
    </svg>
  )
}

function SidebarCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      {collapsed
        ? <path d="M5 3l4 4-4 4" />
        : <path d="M9 3L5 7l4 4" />
      }
    </svg>
  )
}

function getSectionIcon(id: string): string {
  const icons: Record<string, string> = {
    navigation:     'M3 12h18M3 6h18M3 18h18',
    hero:           'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
    properties:     'M3 5h18M3 10h18M3 15h18',
    'contact-form': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    footer:         'M3 19h18M3 15h18M8 11h8',
    'error-page':   'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    seo:            'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  }
  return icons[id] ?? 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative h-[14px] w-[24px] rounded-full transition-colors",
        enabled ? "bg-white/50" : "bg-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-[1px] left-[1px] h-3 w-3 rounded-full bg-background transition-transform duration-200",
          enabled ? "translate-x-[10px]" : "translate-x-0"
        )}
      />
    </button>
  )
}

// ─── ComponentRow ─────────────────────────────────────────────────────────────

function ComponentRow({
  iconPath,
  label,
  active,
  enabled,
  onToggle,
  onClick,
}: {
  iconPath: string
  label: string
  active: boolean
  enabled?: boolean
  onToggle?: (v: boolean) => void
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md cursor-pointer transition-colors',
        active
          ? 'bg-white/10 text-foreground'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      )}
    >
      <div className="w-5 h-5 rounded flex items-center justify-center bg-white/5 flex-shrink-0">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={iconPath} />
        </svg>
      </div>
      <span className="flex-1 text-xs truncate">{label}</span>
      {onToggle && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <Toggle enabled={enabled ?? true} onChange={onToggle} />
        </div>
      )}
    </div>
  )
}

// ─── LeftPanel ────────────────────────────────────────────────────────────────

export function LeftPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [pagePickerOpen, setPagePickerOpen] = useState(false)
  const panelMode = useWizardStore((s) => s.panelMode)
  const setPanelMode = useWizardStore((s) => s.setPanelMode)

  const {
    selectedTemplate,
    activePage,
    setActivePage,
    sectionsRegistry,
    toggleSection,
    setSelection,
    clearSelection,
    selection,
  } = useWizardStore()

  const manifest = selectedTemplate?.manifest
  const allSections: ManifestSection[] = manifest?.sections ?? []
  const hasCollections = Array.isArray(manifest?.collections) && manifest.collections.length > 0
  const pages = usePageList()

  const staticPages = pages.filter((p) => p.kind === 'static')
  const dynamicParents = pages.filter((p) => p.kind === 'dynamic-parent')
  const dynamicChildren = pages.filter((p) => p.kind === 'dynamic')

  // Current page entry for dropdown label + dynamic page checks
  const currentPageEntry = pages.find((p) => p.id === activePage)
  const currentPageName = currentPageEntry?.name ?? activePage
  const isDynamicPage = currentPageEntry?.kind === 'dynamic'
  const isDynamicParent = currentPageEntry?.kind === 'dynamic-parent'

  // Resolve field groups for dynamic pages from manifest
  const dynamicPageDef = isDynamicPage || isDynamicParent
    ? manifest?.pages?.find((p: any) => p.dynamic && (p.id === currentPageEntry?.dynamicPageId || p.sourceSection === currentPageEntry?.sourceSection))
    : null
  const fieldGroups: FieldGroup[] = dynamicPageDef?.fieldGroups ?? []

  // Resolve shared field groups for the dynamic-parent context
  const parentLabelTarget = dynamicPageDef?.sharedSectionId ?? currentPageEntry?.sourceSection
  const sharedFieldGroups: FieldGroup[] = isDynamicParent ? (dynamicPageDef?.sharedFieldGroups ?? []) : []

  // Resolve sections for the active page
  // New manifest: uses pages[].sections + globalSections
  // Fallback: uses section.page field (backward compat with DB manifests not yet updated)
  const currentManifestPage = manifest?.pages?.find((p) => p.id === activePage)
  const hasNewStructure = !!(currentManifestPage?.sections || manifest?.globalSections)

  let pageSections: ManifestSection[]
  let globalSections: ManifestSection[]

  if (hasNewStructure) {
    const pageSectionIds = currentManifestPage?.sections ?? []
    const globalSectionIds = manifest?.globalSections ?? []
    pageSections = pageSectionIds
      .map((id) => allSections.find((s) => s.id === id))
      .filter((s): s is ManifestSection => !!s)
    globalSections = globalSectionIds
      .map((id) => allSections.find((s) => s.id === id))
      .filter((s): s is ManifestSection => !!s)
  } else {
    // Fallback: filter by section.page field
    const allVisible = allSections.filter((s) => {
      if (!s.page || s.page === '*') return true
      if (s.page === activePage) return true
      return false
    })
    globalSections = allVisible.filter((s) => s.page === '*')
    pageSections = allVisible.filter((s) => s.page !== '*')
  }

  // Get the first component ID for a page (used for auto-selection)
  function getFirstComponentId(pageId: string): string | null {
    const targetPage = pages.find((p) => p.id === pageId)
    if (targetPage?.kind === 'dynamic-parent') {
      const dynDef = manifest?.pages?.find((p: any) => p.dynamic && (p.id === targetPage.dynamicPageId || p.sourceSection === targetPage.sourceSection))
      const labelTarget = dynDef?.sharedSectionId ?? targetPage.sourceSection
      const groups: FieldGroup[] = dynDef?.sharedFieldGroups ?? []
      return groups.length > 0 ? `labels:${labelTarget}:${groups[0].id}` : `labels:${labelTarget}`
    }
    if (targetPage?.kind === 'dynamic') {
      const dynDef = manifest?.pages?.find((p: any) => p.dynamic && (p.id === targetPage.dynamicPageId || p.sourceSection === targetPage.sourceSection))
      const groups: FieldGroup[] = dynDef?.fieldGroups ?? []
      return groups.length > 0 ? `detail:${groups[0].id}` : null
    }
    if (hasNewStructure) {
      const page = manifest?.pages?.find((p) => p.id === pageId)
      const firstPageSection = (page?.sections ?? [])
        .map((id) => allSections.find((s) => s.id === id))
        .find((s) => !!s)
      if (firstPageSection) return firstPageSection.id
      const globalSectionIds = manifest?.globalSections ?? []
      const firstGlobal = globalSectionIds
        .map((id) => allSections.find((s) => s.id === id))
        .find((s) => !!s)
      return firstGlobal?.id ?? null
    }
    // Fallback
    const pageSecs = allSections.filter((s) => s.page === pageId)
    if (pageSecs.length > 0) return pageSecs[0].id
    const globalSecs = allSections.filter((s) => !s.page || s.page === '*')
    return globalSecs[0]?.id ?? null
  }

  function handlePageSelect(pageId: string) {
    setPagePickerOpen(false)
    setActivePage(pageId)
    clearSelection()
    const firstComp = getFirstComponentId(pageId)
    if (firstComp) {
      setSelection({ mode: 'section', sectionId: firstComp, field: null, elementType: null, content: null })
    }
  }

  function handleComponentClick(sectionId: string) {
    setSelection({ mode: 'section', sectionId, field: null, elementType: null, content: null })
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 border-r border-white/10 bg-editor-bg flex flex-col transition-all duration-200 overflow-hidden relative',
        isCollapsed ? 'w-9' : 'w-52'
      )}
    >
      {/* ── Header ── */}
      <div className={cn(
        'h-10 flex items-center flex-shrink-0 border-b border-white/10',
        isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
      )}>
        {!isCollapsed && hasCollections ? (
          <div className="flex gap-0.5 bg-white/5 rounded p-0.5">
            <button
              onClick={() => setPanelMode('layers')}
              className={cn(
                'px-2 py-0.5 rounded text-xs uppercase tracking-label transition-colors',
                panelMode === 'layers'
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Layers
            </button>
            <button
              onClick={() => setPanelMode('data')}
              className={cn(
                'px-2 py-0.5 rounded text-xs uppercase tracking-label transition-colors',
                panelMode === 'data'
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Data
            </button>
          </div>
        ) : !isCollapsed ? (
          <span className="text-label uppercase tracking-label text-muted-foreground">Layers</span>
        ) : null}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded flex-shrink-0"
        >
          <SidebarCollapseIcon collapsed={isCollapsed} />
        </button>
      </div>

      {/* ── Expanded: Data mode ── */}
      {!isCollapsed && panelMode === 'data' && hasCollections && (
        <CollectionsPanel />
      )}

      {/* ── Expanded: Layers mode ── */}
      {!isCollapsed && panelMode === 'layers' && (
        <>
          {/* Page picker dropdown */}
          <div className="relative border-b border-white/10 flex-shrink-0">
            <button
              onClick={() => setPagePickerOpen(!pagePickerOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-foreground hover:bg-white/5 transition-colors"
            >
              <span className="truncate text-left font-medium">{currentPageName}</span>
              <ChevronDown rotated={pagePickerOpen} />
            </button>

            {pagePickerOpen && (
              <div className="absolute top-full left-0 right-0 bg-editor-bg border border-white/10 z-30 py-1 shadow-2xl">
                {staticPages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePageSelect(p.id)}
                    className={cn(
                      'w-full flex items-center px-3 py-1.5 text-xs text-left transition-colors',
                      activePage === p.id
                        ? 'text-foreground bg-white/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    {p.name}
                  </button>
                ))}

                {dynamicParents.map((parent) => {
                  const children = dynamicChildren.filter(
                    (c) => c.dynamicPageId === parent.dynamicPageId
                  )
                  return (
                    <div key={parent.id} className="border-t border-white/5 mt-1 pt-1">
                      <button
                        onClick={() => handlePageSelect(parent.id)}
                        className={cn(
                          'w-full flex items-center px-3 py-1.5 text-xs text-left transition-colors font-medium',
                          activePage === parent.id
                            ? 'text-foreground bg-white/5'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        )}
                      >
                        {parent.name}
                      </button>
                      {children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handlePageSelect(child.id)}
                          className={cn(
                            'w-full flex items-center pl-6 pr-3 py-1.5 text-xs text-left transition-colors',
                            activePage === child.id
                              ? 'text-foreground bg-white/5'
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                          )}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Component list */}
          <div className="flex-1 overflow-y-auto py-1.5">
            {/* Dynamic parent pages: shared label component groups (or single fallback row) */}
            {isDynamicParent && parentLabelTarget && (
              sharedFieldGroups.length > 0
                ? sharedFieldGroups.map((group) => {
                    const rowId = `labels:${parentLabelTarget}:${group.id}`
                    return (
                      <ComponentRow
                        key={rowId}
                        iconPath={group.icon}
                        label={group.label}
                        active={selection.sectionId === rowId}
                        onClick={() => handleComponentClick(rowId)}
                      />
                    )
                  })
                : (() => {
                    const sharedSection = dynamicPageDef?.sharedSectionId
                      ? allSections.find((s) => s.id === dynamicPageDef.sharedSectionId)
                      : null
                    const labelRowId = `labels:${parentLabelTarget}`
                    return (
                      <ComponentRow
                        key="shared-labels"
                        iconPath="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        label={sharedSection?.name ?? 'Detail Page Labels'}
                        active={selection.sectionId === labelRowId}
                        onClick={() => handleComponentClick(labelRowId)}
                      />
                    )
                  })()
            )}

            {/* Dynamic pages: manifest-driven field groups */}
            {isDynamicPage && fieldGroups.map((group) => (
              <ComponentRow
                key={`detail:${group.id}`}
                iconPath={group.icon}
                label={group.label}
                active={selection.sectionId === `detail:${group.id}`}
                onClick={() => handleComponentClick(`detail:${group.id}`)}
              />
            ))}

            {/* Home / 404 pages: manifest sections */}
            {!isDynamicPage && !isDynamicParent && (
              <>
                {pageSections.map((section) => (
                  <ComponentRow
                    key={section.id}
                    iconPath={getSectionIcon(section.id)}
                    label={section.name}
                    active={selection.sectionId === section.id}
                    enabled={sectionsRegistry[section.id]?.enabled ?? true}
                    onToggle={(v) => toggleSection(section.id, v)}
                    onClick={() => handleComponentClick(section.id)}
                  />
                ))}

                {pageSections.length > 0 && globalSections.length > 0 && (
                  <div className="mx-2 my-1 border-t border-white/5" />
                )}

                {globalSections.map((section) => (
                  <ComponentRow
                    key={section.id}
                    iconPath={getSectionIcon(section.id)}
                    label={section.name}
                    active={selection.sectionId === section.id}
                    enabled={sectionsRegistry[section.id]?.enabled ?? true}
                    onToggle={(v) => toggleSection(section.id, v)}
                    onClick={() => handleComponentClick(section.id)}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Collapsed state: icon-only dots ── */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-2 gap-1">
          {isDynamicParent
            ? (() => {
                if (!parentLabelTarget) return null
                if (sharedFieldGroups.length > 0) {
                  return sharedFieldGroups.map((group) => {
                    const rowId = `labels:${parentLabelTarget}:${group.id}`
                    return (
                      <button
                        key={rowId}
                        onClick={() => handleComponentClick(rowId)}
                        title={group.label}
                        className={cn(
                          'w-5 h-5 rounded flex items-center justify-center transition-colors',
                          selection.sectionId === rowId
                            ? 'bg-white/15 text-foreground'
                            : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
                        )}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={group.icon} />
                        </svg>
                      </button>
                    )
                  })
                }
                const labelRowId = `labels:${parentLabelTarget}`
                const sharedSection = dynamicPageDef?.sharedSectionId
                  ? allSections.find((s) => s.id === dynamicPageDef.sharedSectionId)
                  : null
                return (
                  <button
                    onClick={() => handleComponentClick(labelRowId)}
                    title={sharedSection?.name ?? 'Detail Page Labels'}
                    className={cn(
                      'w-5 h-5 rounded flex items-center justify-center transition-colors',
                      selection.sectionId === labelRowId
                        ? 'bg-white/15 text-foreground'
                        : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
                    )}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </button>
                )
              })()
            : isDynamicPage
            ? fieldGroups.map((group) => (
                <button
                  key={`detail:${group.id}`}
                  onClick={() => handleComponentClick(`detail:${group.id}`)}
                  title={group.label}
                  className={cn(
                    'w-5 h-5 rounded flex items-center justify-center transition-colors',
                    selection.sectionId === `detail:${group.id}`
                      ? 'bg-white/15 text-foreground'
                      : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
                  )}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={group.icon} />
                  </svg>
                </button>
              ))
            : [...pageSections, ...globalSections].map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleComponentClick(section.id)}
                  title={section.name}
                  className={cn(
                    'w-5 h-5 rounded flex items-center justify-center transition-colors',
                    selection.sectionId === section.id
                      ? 'bg-white/15 text-foreground'
                      : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
                  )}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={getSectionIcon(section.id)} />
                  </svg>
                </button>
              ))
          }
        </div>
      )}
    </div>
  )
}
