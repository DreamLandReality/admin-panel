'use client'

import { SchemaFieldRenderer } from '../../schema-field-renderer'
import type { FieldData, FieldProperties, FieldValue } from './section-field-utils'

interface ArrayItemFieldsProps {
  item: FieldData
  index: number
  itemProperties: FieldProperties
  arrayPath?: string
  onFieldChange: (index: number, field: string, value: FieldValue, path?: string) => void
  onImageUpload: (index: number, key: string, url: string, arrayPath?: string, file?: File) => void
}

export function ArrayItemFields({
  item,
  index,
  itemProperties,
  arrayPath,
  onFieldChange,
  onImageUpload,
}: ArrayItemFieldsProps) {
  return (
    <SchemaFieldRenderer
      properties={itemProperties}
      data={item}
      onChange={(fieldPath, value) => onFieldChange(index, fieldPath, value, arrayPath)}
      onImageUpload={(fieldPath, url, file) => onImageUpload(index, fieldPath, url, arrayPath, file)}
    />
  )
}
