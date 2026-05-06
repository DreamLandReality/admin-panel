'use client'

import type { RefObject, ReactNode } from 'react'
import { ChevronRightIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import { SchemaFieldRenderer } from '../../schema-field-renderer'
import { ArrayItemFields } from './array-item-fields'
import {
  createEmptyArrayItem,
  findEmbeddedArrayKey,
  getArrayItemLabel,
  getArrayItemProperties,
  getArrayItems,
  getObjectFieldProperties,
  type FieldData,
  type FieldValue,
} from './section-field-utils'
import type { FieldSchema, SectionSchema, StyleControl } from '@/types'

interface ArraySectionEditorProps {
  sectionId: string
  sectionName: string | undefined
  schema: SectionSchema
  data: unknown
  collectionData: Record<string, unknown[]>
  fieldStyleControls: Record<string, StyleControl[]>
  iframeRef: RefObject<HTMLIFrameElement | null>
  expandedItem: number | null
  onExpandedItemChange: (index: number | null) => void
  onFieldChange: (fieldPath: string, value: FieldValue) => void
  onImageUpload: (fieldPath: string, url: string, file?: File) => void
  onArrayItemChange: (index: number, field: string, value: FieldValue, path?: string) => void
  onArrayItemImageUpload: (index: number, key: string, url: string, arrayPath?: string, file?: File) => void
  onAddItem: (sectionId: string, item: FieldData, path?: string) => void
  onRemoveItem: (sectionId: string, index: number, path?: string) => void
  footer: ReactNode
}

export function ArraySectionEditor({
  sectionId,
  sectionName,
  schema,
  data,
  collectionData,
  fieldStyleControls,
  iframeRef,
  expandedItem,
  onExpandedItemChange,
  onFieldChange,
  onImageUpload,
  onArrayItemChange,
  onArrayItemImageUpload,
  onAddItem,
  onRemoveItem,
  footer,
}: ArraySectionEditorProps) {
  const embeddedArrayKey = findEmbeddedArrayKey(schema)
  const items = getArrayItems(data, embeddedArrayKey)
  const itemProperties = getArrayItemProperties(schema, embeddedArrayKey)
  const arrayPath = embeddedArrayKey || undefined
  const objectFieldProperties = getObjectFieldProperties(schema, embeddedArrayKey)
  const addLabel = sectionName?.replace(/s$/, '') || 'Item'

  return (
    <div className="px-2 pb-4 pt-3">
      {Object.keys(objectFieldProperties).length > 0 && (
        <div className="px-2 pb-3 mb-2 border-b border-white/5 space-y-3">
          <SchemaFieldRenderer
            properties={objectFieldProperties}
            data={data as Record<string, unknown>}
            onChange={onFieldChange}
            onImageUpload={onImageUpload}
            collectionData={collectionData as Record<string, unknown[]>}
            fieldStyleControls={fieldStyleControls}
            sectionId={sectionId}
            iframeRef={iframeRef}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map((item, index) => {
          const isExpanded = expandedItem === index
          return (
            <div key={index} className="rounded-lg overflow-hidden">
              <button
                onClick={() => onExpandedItemChange(isExpanded ? null : index)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-foreground hover:bg-white/5 transition-colors"
              >
                <span className="truncate">{getArrayItemLabel(item, index)}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemoveItem(sectionId, index, arrayPath)
                      if (expandedItem === index) onExpandedItemChange(null)
                    }}
                    className="text-muted-foreground hover:text-error transition-colors"
                  >
                    <XIcon width={12} height={12} strokeWidth={1.4} />
                  </button>
                  <ChevronRightIcon
                    width={12}
                    height={12}
                    strokeWidth={1.4}
                    className={cn('transition-transform', isExpanded && 'rotate-90')}
                  />
                </div>
              </button>
              {isExpanded && itemProperties && (
                <div className="px-3 pb-3 space-y-3">
                  <ArrayItemFields
                    item={item}
                    index={index}
                    itemProperties={itemProperties as Record<string, FieldSchema>}
                    arrayPath={arrayPath}
                    onFieldChange={onArrayItemChange}
                    onImageUpload={onArrayItemImageUpload}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={() => onAddItem(sectionId, createEmptyArrayItem(itemProperties), arrayPath)}
        className="w-full mt-2 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors"
      >
        + Add {addLabel}
      </button>

      {footer}
    </div>
  )
}
