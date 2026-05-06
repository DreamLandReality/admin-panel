'use client'

import {
  FileUploadButton,
  ImageUploadButton,
  PanelColorInput,
  PanelInput,
  PanelNumberInput,
  PanelPagePicker,
  PanelSelect,
  PanelSlider,
  PanelTextarea,
  PanelToggle,
} from '../inputs'
import { IconPickerField } from '../icon-picker'
import { CollectionPickerWidget } from '../collection-picker'
import { useDeployStore } from '@/stores/deploy-store'
import { XIcon } from '@/components/icons'
import { LockedFieldDisplay } from './locked-field-display'
import { NestedObjectField } from './nested-object-field'
import { ObjectArrayField, RepeaterField, StringArrayField } from './field-types'
import { SchemaFieldRenderer } from '../schema-field-renderer'
import type { StyleControl } from '@/types'

export function FieldDispatch({
  fieldPath,
  fieldSchema,
  label,
  value,
  widget,
  onChange,
  onImageUpload,
  collectionData,
  sectionId,
  skipSystem,
  fieldStyleControls,
  iframeRef,
}: {
  fieldPath: string
  fieldSchema: any
  label: string
  value: any
  widget: string | undefined
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  collectionData: Record<string, any[]>
  sectionId?: string
  skipSystem?: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}) {
  const editabilityMap = useDeployStore((s) => s.editabilityMap)
  if (sectionId && editabilityMap[sectionId]?.[fieldPath] === false) {
    return <LockedFieldDisplay label={label} value={value} />
  }

  if (fieldSchema.type === 'color') {
    return (
      <PanelColorInput
        label={label}
        value={(value as string) ?? ''}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (widget === 'imageUpload') {
    if (fieldSchema.imageMode === 'carousel') {
      const imageArray = Array.isArray(value) ? value : (value ? [value] : [])
      const constraints = fieldSchema.constraints
      const canAdd = constraints?.canAdd !== false && imageArray.length < (constraints?.maxItems ?? Infinity)
      const canRemove = constraints?.canRemove !== false && imageArray.length > (constraints?.minItems ?? 0)

      return (
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
          <div className="space-y-2">
            {imageArray.map((img: string, i: number) => {
              if (!img || img.trim() === '') return null

              return (
                <div key={i} className="relative group/img bg-surface-hover rounded-lg p-2 border border-border-subtle">
                  <div className="h-24 rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                  {canRemove && (
                    <button
                      onClick={() => {
                        const updated = [...imageArray]
                        updated.splice(i, 1)
                        onChange(fieldPath, updated)
                      }}
                      className="absolute top-3 right-3 opacity-0 group-hover/img:opacity-100 bg-black/50 hover:bg-error/80 text-white rounded-full p-1.5 transition-all"
                    >
                      <XIcon width={12} height={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )
            })}
            {canAdd && (
              <ImageUploadButton
                onSelect={(url, file) => {
                  const updated = [...imageArray, url]
                  onImageUpload?.(`${fieldPath}.${imageArray.length}`, url, file)
                  onChange(fieldPath, updated)
                }}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
        {value && (
          <div className="h-28 rounded-lg overflow-hidden bg-surface-hover mb-2 relative group/sim">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value as string} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => onChange(fieldPath, '')}
              className="absolute top-2 right-2 opacity-0 group-hover/sim:opacity-100 bg-black/50 hover:bg-error/80 text-white rounded-full p-1.5 transition-all"
            >
              <XIcon width={12} height={12} strokeWidth={2} />
            </button>
          </div>
        )}
        <ImageUploadButton
          onSelect={(url, file) => {
            onImageUpload?.(fieldPath, url, file)
            onChange(fieldPath, url)
          }}
        />
      </div>
    )
  }

  if (widget === 'fileUpload') {
    return (
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
        <FileUploadButton
          accept={fieldSchema.uiAccept}
          currentUrl={value as string | undefined}
          onSelect={(url, file) => {
            onImageUpload?.(fieldPath, url, file)
            onChange(fieldPath, url)
          }}
        />
      </div>
    )
  }

  if (fieldSchema.type === 'boolean' || widget === 'toggle') {
    return (
      <PanelToggle
        label={label}
        value={!!value}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (widget === 'pagePicker') {
    return (
      <PanelPagePicker
        label={label}
        value={(value as string) ?? ''}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (widget === 'select') {
    const options = fieldSchema.options || fieldSchema.enum || []
    return (
      <PanelSelect
        label={label}
        value={(value as string) ?? ''}
        options={options}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (widget === 'textarea') {
    return (
      <PanelTextarea
        label={label}
        value={(value as string) ?? ''}
        placeholder={fieldSchema.description}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (fieldSchema.type === 'object' && fieldSchema.properties) {
    const propertyCount = Object.keys(fieldSchema.properties).length

    if (propertyCount <= 2) {
      return (
        <div className="space-y-3">
          <SchemaFieldRenderer
            properties={fieldSchema.properties}
            data={(value as Record<string, any>) ?? {}}
            onChange={onChange}
            onImageUpload={onImageUpload}
            prefix={fieldPath}
            collectionData={collectionData}
            skipSystem={skipSystem}
            fieldStyleControls={fieldStyleControls}
            sectionId={sectionId}
            iframeRef={iframeRef}
          />
        </div>
      )
    }

    return (
      <NestedObjectField label={label}>
        <SchemaFieldRenderer
          properties={fieldSchema.properties}
          data={(value as Record<string, any>) ?? {}}
          onChange={onChange}
          onImageUpload={onImageUpload}
          prefix={fieldPath}
          collectionData={collectionData}
          skipSystem={skipSystem}
          fieldStyleControls={fieldStyleControls}
          sectionId={sectionId}
          iframeRef={iframeRef}
        />
      </NestedObjectField>
    )
  }

  if (fieldSchema.type === 'number' && widget === 'slider') {
    return (
      <PanelSlider
        label={label}
        value={(value as number) ?? (fieldSchema.min ?? 0)}
        min={fieldSchema.min ?? 0}
        max={fieldSchema.max ?? 100}
        step={fieldSchema.step ?? 1}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (fieldSchema.type === 'number') {
    return (
      <PanelNumberInput
        label={label}
        value={(value as number) ?? 0}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  if (fieldSchema.type === 'array' && widget === 'collectionPicker' && fieldSchema.collectionId) {
    const allItems = collectionData[fieldSchema.collectionId] ?? []
    return (
      <CollectionPickerWidget
        label={label}
        selectedIds={(value as string[]) ?? []}
        allItems={allItems}
        onChange={(ids) => onChange(fieldPath, ids)}
      />
    )
  }

  if (fieldSchema.type === 'array' && widget === 'repeater' && fieldSchema.items) {
    return (
      <RepeaterField
        label={label}
        fieldPath={fieldPath}
        fieldSchema={fieldSchema}
        items={(value as any[]) ?? []}
        onChange={onChange}
        onImageUpload={onImageUpload}
      />
    )
  }

  if (fieldSchema.type === 'array' && fieldSchema.items?.type === 'string') {
    return (
      <StringArrayField
        label={label}
        fieldPath={fieldPath}
        items={(value as string[]) ?? []}
        itemLabel={fieldSchema.items?.uiLabel ?? 'item'}
        onChange={onChange}
      />
    )
  }

  if (fieldSchema.type === 'array' && fieldSchema.items?.properties) {
    return (
      <ObjectArrayField
        label={label}
        fieldPath={fieldPath}
        fieldSchema={fieldSchema}
        items={(value as any[]) ?? []}
        onChange={onChange}
        onImageUpload={onImageUpload}
      />
    )
  }

  if (widget === 'iconPicker') {
    return (
      <IconPickerField
        label={label}
        value={(value as string) ?? ''}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  return (
    <PanelInput
      label={label}
      value={(value as string)?.toString() ?? ''}
      placeholder={fieldSchema.description}
      onChange={(v) => onChange(fieldPath, v)}
    />
  )
}
