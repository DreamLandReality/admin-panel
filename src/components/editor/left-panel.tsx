'use client'

import React, { useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { ButtonGroup } from '@/components/primitives'
import { useLeftPanelFocus } from '@/hooks/use-left-panel-focus'
import { useLeftPanelNavigation } from '@/hooks/use-left-panel-navigation'
import { cn } from '@/lib/utils/cn'
import { useUiStore } from '@/stores/ui-store'
import { CollectionsPanel } from './collections-panel'
import { CollapsedLayerList } from './left-panel/collapsed-layer-list'
import { ExpandedLayerList } from './left-panel/expanded-layer-list'
import { PagePicker } from './left-panel/page-picker'

interface LeftPanelProps {
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

export const LeftPanel = React.memo(function LeftPanel({
  iframeRef,
}: LeftPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [pagePickerOpen, setPagePickerOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const panelMode = useUiStore((state) => state.panelMode)
  const setPanelMode = useUiStore((state) => state.setPanelMode)
  const {
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
  } = useLeftPanelNavigation({
    iframeRef,
    onPageSelected: () => setPagePickerOpen(false),
  })

  useLeftPanelFocus({
    selectedSectionId: selection.sectionId,
    listRef,
  })

  return (
    <div
      className={cn(
        'flex-shrink-0 border-r border-white/10 bg-editor-bg flex flex-col transition-all duration-200 overflow-hidden relative',
        isCollapsed ? 'w-9' : 'w-52'
      )}
    >
      <div className={cn(
        'h-10 flex items-center flex-shrink-0 border-b border-white/10',
        isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
      )}>
        {!isCollapsed && hasCollections ? (
          <ButtonGroup
            size="sm"
            options={[
              { value: 'layers', label: 'Layers' },
              { value: 'data', label: 'Data' },
            ]}
            value={panelMode}
            onChange={(value) => setPanelMode(value as 'layers' | 'data')}
            className="bg-white/10 rounded p-0.5 gap-1"
          />
        ) : !isCollapsed ? (
          <span className="text-label uppercase tracking-label text-muted-foreground">Layers</span>
        ) : null}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded flex-shrink-0"
        >
          {isCollapsed ? (
            <ChevronRightIcon width={14} height={14} strokeWidth={1.4} />
          ) : (
            <ChevronLeftIcon width={14} height={14} strokeWidth={1.4} />
          )}
        </button>
      </div>

      {!isCollapsed && panelMode === 'data' && hasCollections && (
        <CollectionsPanel />
      )}

      {!isCollapsed && panelMode === 'layers' && (
        <>
          <PagePicker
            activePage={activePage}
            currentPageName={currentPageName}
            open={pagePickerOpen}
            onToggle={() => setPagePickerOpen(!pagePickerOpen)}
            onSelect={handlePageSelect}
            staticPages={staticPages}
            dynamicParents={dynamicParents}
            dynamicChildren={dynamicChildren}
          />

          <ExpandedLayerList
            listRef={listRef}
            isDynamicParent={isDynamicParent}
            parentLabelTarget={parentLabelTarget}
            sharedFieldGroups={sharedFieldGroups}
            dynamicPageDef={dynamicPageDef}
            allSections={allSections}
            isDynamicPage={isDynamicPage}
            fieldGroups={fieldGroups}
            pageSections={pageSections}
            globalSections={globalSections}
            selection={selection}
            sectionsRegistry={sectionsRegistry}
            onToggleSection={toggleSection}
            onComponentClick={handleComponentClick}
          />
        </>
      )}

      {isCollapsed && (
        <CollapsedLayerList
          isDynamicParent={isDynamicParent}
          parentLabelTarget={parentLabelTarget}
          sharedFieldGroups={sharedFieldGroups}
          dynamicPageDef={dynamicPageDef}
          allSections={allSections}
          isDynamicPage={isDynamicPage}
          fieldGroups={fieldGroups}
          pageSections={pageSections}
          globalSections={globalSections}
          selection={selection}
          onComponentClick={handleComponentClick}
        />
      )}
    </div>
  )
})
