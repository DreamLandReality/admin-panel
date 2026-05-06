'use client'

import type { Ref } from 'react'
import { ComponentRow } from './component-row'
import { getSectionIcon } from './section-icons'
import type { FieldGroup, ManifestPage, ManifestSection, SectionRegistry } from '@/types'
import type { Selection } from '@/stores/store-types'

interface ExpandedLayerListProps {
  listRef: Ref<HTMLDivElement>
  isDynamicParent: boolean
  parentLabelTarget?: string
  sharedFieldGroups: FieldGroup[]
  dynamicPageDef?: ManifestPage
  allSections: ManifestSection[]
  isDynamicPage: boolean
  fieldGroups: FieldGroup[]
  pageSections: ManifestSection[]
  globalSections: ManifestSection[]
  selection: Selection
  sectionsRegistry: Record<string, SectionRegistry>
  onToggleSection: (sectionId: string, enabled: boolean) => void
  onComponentClick: (sectionId: string) => void
}

export function ExpandedLayerList({
  listRef,
  isDynamicParent,
  parentLabelTarget,
  sharedFieldGroups,
  dynamicPageDef,
  allSections,
  isDynamicPage,
  fieldGroups,
  pageSections,
  globalSections,
  selection,
  sectionsRegistry,
  onToggleSection,
  onComponentClick,
}: ExpandedLayerListProps) {
  return (
    <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
      {isDynamicParent && parentLabelTarget && (
        sharedFieldGroups.length > 0
          ? sharedFieldGroups.map((group) => {
              const rowId = `labels:${parentLabelTarget}:${group.id}`
              return (
                <ComponentRow
                  key={rowId}
                  sectionId={rowId}
                  iconPath={group.icon}
                  label={group.label}
                  active={selection.sectionId === rowId}
                  onClick={() => onComponentClick(rowId)}
                />
              )
            })
          : (() => {
              const sharedSection = dynamicPageDef?.sharedSectionId
                ? allSections.find((section) => section.id === dynamicPageDef.sharedSectionId)
                : null
              const labelRowId = `labels:${parentLabelTarget}`
              return (
                <ComponentRow
                  key="shared-labels"
                  sectionId={labelRowId}
                  iconPath="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  label={sharedSection?.name ?? 'Detail Page Labels'}
                  active={selection.sectionId === labelRowId}
                  onClick={() => onComponentClick(labelRowId)}
                />
              )
            })()
      )}

      {isDynamicPage && fieldGroups.map((group) => (
        <ComponentRow
          key={`detail:${group.id}`}
          sectionId={`detail:${group.id}`}
          iconPath={group.icon}
          label={group.label}
          active={selection.sectionId === `detail:${group.id}`}
          onClick={() => onComponentClick(`detail:${group.id}`)}
        />
      ))}

      {!isDynamicPage && !isDynamicParent && (
        <>
          {pageSections.map((section) => (
            <ComponentRow
              key={section.id}
              sectionId={section.id}
              iconPath={getSectionIcon(section.id)}
              label={section.name}
              active={selection.sectionId === section.id}
              enabled={sectionsRegistry[section.id]?.enabled ?? true}
              onToggle={(enabled) => onToggleSection(section.id, enabled)}
              onClick={() => onComponentClick(section.id)}
            />
          ))}

          {pageSections.length > 0 && globalSections.length > 0 && (
            <div className="mx-2 my-1 border-t border-white/5" />
          )}

          {globalSections.map((section) => (
            <ComponentRow
              key={section.id}
              sectionId={section.id}
              iconPath={getSectionIcon(section.id)}
              label={section.name}
              active={selection.sectionId === section.id}
              enabled={sectionsRegistry[section.id]?.enabled ?? true}
              onToggle={(enabled) => onToggleSection(section.id, enabled)}
              onClick={() => onComponentClick(section.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}
