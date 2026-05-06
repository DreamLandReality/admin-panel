'use client'

import { PathIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import type { FieldGroup, ManifestPage, ManifestSection } from '@/types'
import type { Selection } from '@/stores/store-types'
import { getSectionIcon } from './section-icons'

interface CollapsedLayerListProps {
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
  onComponentClick: (sectionId: string) => void
}

export function CollapsedLayerList({
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
  onComponentClick,
}: CollapsedLayerListProps) {
  return (
    <div className="flex-1 flex flex-col items-center py-2 gap-1">
      {isDynamicParent
        ? renderDynamicParentButtons({
            parentLabelTarget,
            sharedFieldGroups,
            dynamicPageDef,
            allSections,
            selection,
            onComponentClick,
          })
        : isDynamicPage
          ? fieldGroups.map((group) => (
              <IconButton
                key={`detail:${group.id}`}
                id={`detail:${group.id}`}
                iconPath={group.icon}
                label={group.label}
                selection={selection}
                onComponentClick={onComponentClick}
              />
            ))
          : [...pageSections, ...globalSections].map((section) => (
              <IconButton
                key={section.id}
                id={section.id}
                iconPath={getSectionIcon(section.id)}
                label={section.name}
                selection={selection}
                onComponentClick={onComponentClick}
              />
            ))}
    </div>
  )
}

function renderDynamicParentButtons({
  parentLabelTarget,
  sharedFieldGroups,
  dynamicPageDef,
  allSections,
  selection,
  onComponentClick,
}: Pick<
  CollapsedLayerListProps,
  'parentLabelTarget' | 'sharedFieldGroups' | 'dynamicPageDef' | 'allSections' | 'selection' | 'onComponentClick'
>) {
  if (!parentLabelTarget) return null

  if (sharedFieldGroups.length > 0) {
    return sharedFieldGroups.map((group) => (
      <IconButton
        key={`labels:${parentLabelTarget}:${group.id}`}
        id={`labels:${parentLabelTarget}:${group.id}`}
        iconPath={group.icon}
        label={group.label}
        selection={selection}
        onComponentClick={onComponentClick}
      />
    ))
  }

  const labelRowId = `labels:${parentLabelTarget}`
  const sharedSection = dynamicPageDef?.sharedSectionId
    ? allSections.find((section) => section.id === dynamicPageDef.sharedSectionId)
    : null

  return (
    <IconButton
      id={labelRowId}
      iconPath="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
      label={sharedSection?.name ?? 'Detail Page Labels'}
      selection={selection}
      onComponentClick={onComponentClick}
    />
  )
}

function IconButton({
  id,
  iconPath,
  label,
  selection,
  onComponentClick,
}: {
  id: string
  iconPath: string
  label: string
  selection: Selection
  onComponentClick: (sectionId: string) => void
}) {
  return (
    <button
      onClick={() => onComponentClick(id)}
      title={label}
      className={cn(
        'w-5 h-5 rounded flex items-center justify-center transition-colors',
        selection.sectionId === id
          ? 'bg-white/15 text-foreground'
          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
      )}
    >
      <PathIcon path={iconPath} width={10} height={10} strokeWidth={1.5} />
    </button>
  )
}
