'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import { PanelPagePicker, PanelInput, PanelTextarea, PanelNumberInput, PanelSlider, PanelColorInput, PanelToggle, PanelSelect, ImageUploadButton, FileUploadButton } from './panel-inputs'
import { IconPickerField } from './icon-picker'
import { TextInput } from '@/components/forms'
import { CollectionPickerWidget } from './collection-picker'
import { StyleSection } from './style-controls'
import { useWizardStore } from '@/stores/wizard-store'
import { useContextualGroups } from '@/hooks/use-contextual-groups'
import type { StyleControl } from '@/types'
import type { ContextualGroup } from '@/lib/utils/contextual-group-manager'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SchemaFieldRendererProps {
  properties: Record<string, any>
  data: Record<string, any>
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  prefix?: string
  fields?: string[]
  collectionData?: Record<string, any[]>
  skipSystem?: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  sectionId?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

// ─── SchemaFieldRenderer ─────────────────────────────────────────────────────

export function SchemaFieldRenderer({
  properties,
  data,
  onChange,
  onImageUpload,
  prefix = '',
  fields,
  collectionData: collectionDataProp,
  skipSystem = true,
  fieldStyleControls,
  sectionId,
  iframeRef,
}: SchemaFieldRendererProps) {
  const storeCollectionData = useWizardStore((s) => s.collectionData)
  const collectionData = collectionDataProp ?? storeCollectionData

  // Use contextual grouping hook
  const { groups, hasContextualGroups } = useContextualGroups({
    properties,
    data,
    enableContextualGrouping: true,
    debug: false,
  })

  const entries = fields
    ? fields.map((f) => [f, properties[f]] as const).filter(([, v]) => v)
    : Object.entries(properties)

  // Use contextual rendering if dependencies exist, otherwise fallback to static sections
  if (hasContextualGroups) {
    return (
      <ContextualGroupRenderer
        groups={groups}
        properties={properties}
        data={data}
        onChange={onChange}
        onImageUpload={onImageUpload}
        prefix={prefix}
        collectionData={collectionData}
        skipSystem={skipSystem}
        fieldStyleControls={fieldStyleControls}
        sectionId={sectionId}
        iframeRef={iframeRef}
      />
    )
  }

  // Fallback to static section-based rendering for schemas without dependencies
  return (
    <StaticSectionRenderer
      entries={entries}
      properties={properties}
      data={data}
      onChange={onChange}
      onImageUpload={onImageUpload}
      prefix={prefix}
      collectionData={collectionData}
      skipSystem={skipSystem}
      fieldStyleControls={fieldStyleControls}
      sectionId={sectionId}
      iframeRef={iframeRef}
    />
  )
}

// ─── ContextualGroupRenderer ────────────────────────────────────────────────

interface ContextualGroupRendererProps {
  groups: ContextualGroup[]
  properties: Record<string, any>
  data: Record<string, any>
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  prefix: string
  collectionData: Record<string, any[]>
  skipSystem: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  sectionId?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

function ContextualGroupRenderer({
  groups,
  properties,
  data,
  onChange,
  onImageUpload,
  prefix,
  collectionData,
  skipSystem,
  fieldStyleControls,
  sectionId,
  iframeRef,
}: ContextualGroupRendererProps) {
  // Organize groups by section for better visual organization
  const groupsBySection = useMemo(() => {
    const sections: Record<string, ContextualGroup[]> = {
      content: [],
      media: [],
      layout: [],
      settings: [],
      default: [],
    }

    for (const group of groups) {
      // Determine section from trigger field or first field in group
      let section = 'default'
      
      if (group.triggerField) {
        // For contextual groups, get section from trigger field
        const triggerSchema = properties[group.triggerField]
        section = triggerSchema?.uiSection || 'default'
      } else if (group.fields.length > 0) {
        // For root group, get section from first field
        const firstField = group.fields[0]
        section = firstField.schema.uiSection || 'default'
      }

      const targetSection = sections[section] ? section : 'default'
      sections[targetSection].push(group)
    }

    return sections
  }, [groups, properties])

  const sectionLabels: Record<string, string> = {
    content: 'Content',
    media: 'Media',
    layout: 'Layout',
    settings: 'Settings',
    default: '',
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupsBySection).map(([sectionKey, sectionGroups]) => {
        if (sectionGroups.length === 0) return null

        return (
          <div key={sectionKey}>
            {sectionLabels[sectionKey] && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">
                  {sectionLabels[sectionKey]}
                </h4>
                <div className="mt-1 h-px bg-border-subtle"></div>
              </div>
            )}
            <div className="space-y-3">
              {sectionGroups.map((group) => (
                <ContextualGroupBlock
                  key={group.id}
                  group={group}
                  properties={properties}
                  data={data}
                  onChange={onChange}
                  onImageUpload={onImageUpload}
                  prefix={prefix}
                  collectionData={collectionData}
                  skipSystem={skipSystem}
                  fieldStyleControls={fieldStyleControls}
                  sectionId={sectionId}
                  iframeRef={iframeRef}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ContextualGroupBlock ───────────────────────────────────────────────────

interface ContextualGroupBlockProps {
  group: ContextualGroup
  properties: Record<string, any>
  data: Record<string, any>
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  prefix: string
  collectionData: Record<string, any[]>
  skipSystem: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  sectionId?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

function ContextualGroupBlock({
  group,
  properties,
  data,
  onChange,
  onImageUpload,
  prefix,
  collectionData,
  skipSystem,
  fieldStyleControls,
  sectionId,
  iframeRef,
}: ContextualGroupBlockProps) {
  if (!group.isVisible) return null

  return (
    <>
      {group.fields.map((groupedField) => {
        const { fieldKey, schema } = groupedField
        
        // Skip system-injected and style fields
        if (fieldKey === 'id') return null
        if (fieldKey.endsWith('__style')) return null
        if (skipSystem && (
          schema.description?.includes('System Injected') ||
          schema.description?.includes('Injected at deploy')
        )) return null

        const fieldPath = prefix ? `${prefix}.${fieldKey}` : fieldKey
        const label = schema.uiLabel || fieldKey
        const value = data?.[fieldKey]
        const widget = schema.uiWidget
        const styleControls = fieldStyleControls?.[fieldKey]

        // Apply indentation for nested groups
        const indentClass = group.depth > 0 ? 'ml-3 pl-3 border-l-2 border-border-subtle/50' : ''

        const fieldEl = (
          <FieldDispatch
            fieldPath={fieldPath}
            fieldSchema={schema}
            label={label}
            value={value}
            widget={widget}
            onChange={onChange}
            onImageUpload={onImageUpload}
            collectionData={collectionData}
            sectionId={sectionId}
            skipSystem={skipSystem}
            fieldStyleControls={fieldStyleControls}
            iframeRef={iframeRef}
          />
        )

        if (styleControls && styleControls.length > 0 && sectionId && iframeRef) {
          return (
            <div key={fieldPath} data-field-key={fieldKey} className={indentClass}>
              <FieldWithStyle
                fieldKey={fieldKey}
                sectionId={sectionId}
                styleControls={styleControls}
                iframeRef={iframeRef}
              >
                {fieldEl}
              </FieldWithStyle>
            </div>
          )
        }

        return (
          <div key={fieldPath} data-field-key={fieldKey} className={indentClass}>
            {fieldEl}
          </div>
        )
      })}
    </>
  )
}

// ─── StaticSectionRenderer ──────────────────────────────────────────────────

interface StaticSectionRendererProps {
  entries: Array<readonly [string, any]>
  properties: Record<string, any>
  data: Record<string, any>
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  prefix: string
  collectionData: Record<string, any[]>
  skipSystem: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  sectionId?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

function StaticSectionRenderer({
  entries,
  properties,
  data,
  onChange,
  onImageUpload,
  prefix,
  collectionData,
  skipSystem,
  fieldStyleControls,
  sectionId,
  iframeRef,
}: StaticSectionRendererProps) {
  // Group fields by uiSection and sort by uiOrder
  const groupedFields = entries.reduce((groups, [key, fieldSchema]) => {
    if (!fieldSchema) return groups
    
    const section = fieldSchema.uiSection || 'default'
    const order = fieldSchema.uiOrder || 999
    
    if (!groups[section]) {
      groups[section] = []
    }
    
    groups[section].push([key, fieldSchema, order])
    return groups
  }, {} as Record<string, [string, any, number][]>)

  // Sort fields within each section by uiOrder
  Object.keys(groupedFields).forEach(section => {
    groupedFields[section].sort((a, b) => a[2] - b[2])
  })

  // Define section labels
  const sectionLabels: Record<string, string> = {
    content: 'Content',
    media: 'Media',
    layout: 'Layout',
    settings: 'Settings',
    default: ''
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedFields).map(([sectionKey, sectionFields]) => (
        <div key={sectionKey}>
          {sectionLabels[sectionKey] && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">
                {sectionLabels[sectionKey]}
              </h4>
              <div className="mt-1 h-px bg-border-subtle"></div>
            </div>
          )}
          <div className="space-y-3">
            {sectionFields.map(([key, fieldSchema]) => {
              if (!fieldSchema) return null

              // Skip system-injected and style fields
              if (key === 'id') return null
              if (key.endsWith('__style')) return null
              if (skipSystem && (
                fieldSchema.description?.includes('System Injected') ||
                fieldSchema.description?.includes('Injected at deploy')
              )) return null

              const fieldPath = prefix ? `${prefix}.${key}` : key
              const label = fieldSchema.uiLabel || key
              const value = data?.[key]
              const widget = fieldSchema.uiWidget
              const styleControls = fieldStyleControls?.[key]

              const fieldEl = (
                <FieldDispatch
                  fieldPath={fieldPath}
                  fieldSchema={fieldSchema}
                  label={label}
                  value={value}
                  widget={widget}
                  onChange={onChange}
                  onImageUpload={onImageUpload}
                  collectionData={collectionData}
                  sectionId={sectionId}
                  skipSystem={skipSystem}
                  fieldStyleControls={fieldStyleControls}
                  iframeRef={iframeRef}
                />
              )

              if (styleControls && styleControls.length > 0 && sectionId && iframeRef) {
                return (
                  <div key={fieldPath} data-field-key={key}>
                    <FieldWithStyle
                      fieldKey={key}
                      sectionId={sectionId}
                      styleControls={styleControls}
                      iframeRef={iframeRef}
                    >
                      {fieldEl}
                    </FieldWithStyle>
                  </div>
                )
              }

              return <div key={fieldPath} data-field-key={key}>{fieldEl}</div>
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── NestedObjectField ───────────────────────────────────────────────────────

function NestedObjectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1">
      <div className="px-2.5 py-2 rounded-md bg-white/[0.05]">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
      </div>
      <div className="pl-2.5 mt-2 space-y-3 pb-1">
        {children}
      </div>
    </div>
  )
}

// ─── LockedFieldDisplay ──────────────────────────────────────────────────────

function LockedFieldDisplay({ label, value }: { label: string; value: any }) {
  // Handle different value types for display
  let display: string
  if (value == null || value === '') {
    display = '—'
  } else if (typeof value === 'object') {
    display = JSON.stringify(value)
  } else {
    display = String(value)
  }
  
  return (
    <div className="relative">
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-foreground/40">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {label}
        </span>
      </label>
      <div className="px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/5 text-xs text-muted-foreground/50 truncate">
        {display}
      </div>
    </div>
  )
}

// ─── FieldDispatch ───────────────────────────────────────────────────────────

function FieldDispatch({
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
  // ── Editability enforcement ──
  // Read editabilityMap from the store. If the field is marked non-editable,
  // render a locked read-only display instead of an interactive control.
  const editabilityMap = useWizardStore((s) => s.editabilityMap)
  if (sectionId && editabilityMap[sectionId]?.[fieldPath] === false) {
    return <LockedFieldDisplay label={label} value={value} />
  }

  // 1. Color
  if (fieldSchema.type === 'color') {
    return (
      <PanelColorInput
        label={label}
        value={(value as string) ?? '#000000'}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  // 2. Image upload
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
              // Skip rendering empty/invalid images
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
                      className="absolute top-3 right-3 opacity-0 group-hover/img:opacity-100 bg-black/50 hover:bg-red-500/80 text-white rounded-full p-1.5 transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
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
              className="absolute top-2 right-2 opacity-0 group-hover/sim:opacity-100 bg-black/50 hover:bg-red-500/80 text-white rounded-full p-1.5 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
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

  // 3. File upload (PDF, video, or other — driven by uiAccept in schema)
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

  // 4. Toggle (boolean type or toggle widget)
  if (fieldSchema.type === 'boolean' || widget === 'toggle') {
    return (
      <PanelToggle
        label={label}
        value={!!value}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  // 5. Standalone page picker
  if (widget === 'pagePicker') {
    return (
      <PanelPagePicker
        label={label}
        value={(value as string) ?? ''}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  // 6. Select/Dropdown
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

  // 7. Textarea
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

  // 10. Nested object
  if (fieldSchema.type === 'object' && fieldSchema.properties) {
    const propertyCount = Object.keys(fieldSchema.properties).length;
    
    // Flatten simple objects (1-2 fields) - render fields directly without grouping
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
    
    // Keep grouping for complex objects (3+ fields)
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

  // 11. Number with slider widget
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

  // 11. Number (regular input)
  if (fieldSchema.type === 'number') {
    return (
      <PanelNumberInput
        label={label}
        value={(value as number) ?? 0}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  // 12. Collection picker (array + collectionPicker widget)
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

  // 13. Repeater (array + repeater widget)
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

  // 14. Simple array of strings
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

  // 15. Object array (e.g. gallery items)
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

  // 8. Icon picker
  if (widget === 'iconPicker') {
    return (
      <IconPickerField
        label={label}
        value={(value as string) ?? ''}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  // 10. Default: string input
  return (
    <PanelInput
      label={label}
      value={(value as string)?.toString() ?? ''}
      placeholder={fieldSchema.description}
      onChange={(v) => onChange(fieldPath, v)}
    />
  )
}

// ─── FieldWithStyle ──────────────────────────────────────────────────────────

function FieldWithStyle({
  fieldKey,
  sectionId,
  styleControls,
  iframeRef,
  children,
}: {
  fieldKey: string
  sectionId: string
  styleControls: StyleControl[]
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {children}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'mt-1 w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors',
          open ? 'bg-accent/10 text-accent' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
        )}
      >
        <span className="text-[10px] uppercase tracking-wider">Style</span>
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={cn('transition-transform duration-150', open && 'rotate-90')}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {open && (
        <div className="mt-1.5 px-2 pt-2 pb-2 rounded bg-white/[0.03] border border-white/5 space-y-3">
          <StyleSection
            label=""
            sectionId={sectionId}
            styleKey={fieldKey}
            controls={styleControls}
            iframeRef={iframeRef}
          />
        </div>
      )}
    </div>
  )
}

// ─── RepeaterField ───────────────────────────────────────────────────────────

function RepeaterField({
  label,
  fieldPath,
  fieldSchema,
  items,
  onChange,
  onImageUpload,
}: {
  label: string
  fieldPath: string
  fieldSchema: any
  items: any[]
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
}) {
  const itemProps = fieldSchema.items?.properties ?? {}

  function handleItemChange(index: number, key: string, value: any) {
    const updated = [...items]
    updated[index] = { ...updated[index], [key]: value }
    onChange(fieldPath, updated)
  }

  function handleAddItem() {
    const newItem: Record<string, any> = {}
    for (const [k, schema] of Object.entries(itemProps) as [string, any][]) {
      if (schema.type === 'string') newItem[k] = ''
      else if (schema.type === 'number') newItem[k] = 0
      else if (schema.type === 'boolean') newItem[k] = false
    }
    onChange(fieldPath, [...items, newItem])
  }

  function handleRemoveItem(index: number) {
    onChange(fieldPath, items.filter((_, i) => i !== index))
  }

  // ── Constraint enforcement ──
  const constraints = fieldSchema.constraints
  const canRemove = constraints?.canRemove !== false
    && items.length > (constraints?.minItems ?? 0)
  const canAdd = constraints?.canAdd !== false
    && items.length < (constraints?.maxItems ?? Infinity)

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 mt-4">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-surface rounded-lg p-2.5 space-y-2 relative group/item border border-border-subtle hover:border-border-hover transition-colors">
            {canRemove && (
              <button
                onClick={() => handleRemoveItem(i)}
                className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            {(Object.entries(itemProps) as [string, any][]).map(([itemKey, itemSchema]) => {
              const itemWidget = itemSchema.uiWidget
              const itemLabel = itemSchema.uiLabel || itemKey
              const itemValue = item[itemKey]

              // uiShowWhen inside repeater items
              const showWhen = itemSchema.uiShowWhen
              if (showWhen) {
                const siblingValue = item[showWhen.sibling]
                const passes = showWhen.values
                  ? (showWhen.values as string[]).includes(siblingValue)
                  : siblingValue === showWhen.value
                if (!passes) return null
              }

              if (itemWidget === 'imageUpload') {
                return (
                  <div key={itemKey}>
                    <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{itemLabel}</label>
                    {itemValue && (
                      <div className="h-28 rounded-lg overflow-hidden bg-surface-hover mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={itemValue as string} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <ImageUploadButton
                      onSelect={(url, file) => {
                        onImageUpload?.(`${fieldPath}.${i}.${itemKey}`, url, file)
                        handleItemChange(i, itemKey, url)
                      }}
                    />
                  </div>
                )
              }
              if (itemWidget === 'fileUpload') {
                return (
                  <div key={itemKey}>
                    <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{itemLabel}</label>
                    <FileUploadButton
                      accept={itemSchema.uiAccept}
                      currentUrl={itemValue as string | undefined}
                      onSelect={(url, file) => {
                        onImageUpload?.(`${fieldPath}.${i}.${itemKey}`, url, file)
                        handleItemChange(i, itemKey, url)
                      }}
                    />
                  </div>
                )
              }
              if (itemWidget === 'textarea') {
                return (
                  <PanelTextarea
                    key={itemKey}
                    label={itemLabel}
                    value={(itemValue as string) ?? ''}
                    placeholder={itemSchema.description}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              if (itemWidget === 'toggle' || itemSchema.type === 'boolean') {
                return (
                  <PanelToggle
                    key={itemKey}
                    label={itemLabel}
                    value={!!itemValue}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              if (itemWidget === 'pagePicker') {
                return (
                  <PanelPagePicker
                    key={itemKey}
                    label={itemLabel}
                    value={(itemValue as string) ?? ''}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              if (itemSchema.type === 'number' && itemWidget === 'slider') {
                return (
                  <PanelSlider
                    key={itemKey}
                    label={itemLabel}
                    value={(itemValue as number) ?? (itemSchema.min ?? 0)}
                    min={itemSchema.min ?? 0}
                    max={itemSchema.max ?? 100}
                    step={itemSchema.step ?? 1}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              if (itemSchema.type === 'number') {
                return (
                  <PanelNumberInput
                    key={itemKey}
                    label={itemLabel}
                    value={(itemValue as number) ?? 0}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              if (itemWidget === 'iconPicker') {
                return (
                  <IconPickerField
                    key={itemKey}
                    label={itemLabel}
                    value={(itemValue as string) ?? ''}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              return (
                <PanelInput
                  key={itemKey}
                  label={itemLabel}
                  value={(itemValue as string) ?? ''}
                  placeholder={itemSchema.description}
                  onChange={(v) => handleItemChange(i, itemKey, v)}
                />
              )
            })}
          </div>
        ))}
        {canAdd && (
          <button
            onClick={handleAddItem}
            className="w-full py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors"
          >
            + Add Item
          </button>
        )}
      </div>
    </div>
  )
}

// ─── StringArrayField ────────────────────────────────────────────────────────

function StringArrayField({
  label,
  fieldPath,
  items,
  itemLabel,
  onChange,
}: {
  label: string
  fieldPath: string
  items: string[]
  itemLabel: string
  onChange: (fieldPath: string, value: any) => void
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 mt-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((v, i) => (
          <div key={i} className="flex gap-1">
            <TextInput
              variant="panel"
              value={v}
              onChange={(e) => {
                const updated = [...items]
                updated[i] = e.target.value
                onChange(fieldPath, updated)
              }}
              className="flex-1 text-sm"
            />
            <button
              onClick={() => onChange(fieldPath, items.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-red-400 px-1"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange(fieldPath, [...items, ''])}
          className="text-label text-muted-foreground hover:text-foreground"
        >
          + Add {itemLabel}
        </button>
      </div>
    </div>
  )
}

// ─── ObjectArrayField ────────────────────────────────────────────────────────

function ObjectArrayField({
  label,
  fieldPath,
  fieldSchema,
  items,
  onChange,
  onImageUpload,
}: {
  label: string
  fieldPath: string
  fieldSchema: any
  items: any[]
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
}) {
  const itemProps = fieldSchema.items.properties

  function handleItemFieldChange(index: number, key: string, value: any) {
    const updated = [...items]
    updated[index] = { ...updated[index], [key]: value }
    onChange(fieldPath, updated)
  }

  function handleAddItem() {
    const newItem: Record<string, any> = {}
    for (const [k, schema] of Object.entries(itemProps) as [string, any][]) {
      if (schema.type === 'string') newItem[k] = ''
      else if (schema.type === 'number') newItem[k] = 0
    }
    onChange(fieldPath, [...items, newItem])
  }

  function handleRemoveItem(index: number) {
    onChange(fieldPath, items.filter((_, i) => i !== index))
  }

  // ── Constraint enforcement ──
  const constraints = fieldSchema.constraints
  const canRemove = constraints?.canRemove !== false
    && items.length > (constraints?.minItems ?? 0)
  const canAdd = constraints?.canAdd !== false
    && items.length < (constraints?.maxItems ?? Infinity)

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 mt-2">{label}</p>
      <div className="space-y-2">
        {items.map((arrItem, i) => (
          <div key={i} className="bg-surface rounded-lg p-2.5 space-y-2 relative group/gitem border border-border-subtle hover:border-border-hover transition-colors">
            <button
              onClick={() => handleRemoveItem(i)}
              className="absolute top-2 right-2 opacity-0 group-hover/gitem:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {(Object.entries(itemProps) as [string, any][]).map(([itemKey, itemSch]) => {
              if (itemSch.uiWidget === 'imageUpload') {
                const imgValue = (arrItem[itemKey] as string) ?? ''
                return (
                  <div key={itemKey}>
                    <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">
                      {itemSch.uiLabel || itemKey}
                    </label>
                    {imgValue && (
                      <div className="aspect-video rounded-lg overflow-hidden bg-surface-hover mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgValue} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <ImageUploadButton
                      onSelect={(url, file) => {
                        onImageUpload?.(`${fieldPath}.${i}.${itemKey}`, url, file)
                        handleItemFieldChange(i, itemKey, url)
                      }}
                    />
                  </div>
                )
              }
              return (
                <PanelInput
                  key={itemKey}
                  label={itemSch.uiLabel || itemKey}
                  value={(arrItem[itemKey] as string) ?? ''}
                  placeholder={itemSch.description}
                  onChange={(v) => handleItemFieldChange(i, itemKey, v)}
                />
              )
            })}
          </div>
        ))}
        <button
          onClick={handleAddItem}
          className="w-full py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors"
        >
          + Add Item
        </button>
      </div>
    </div>
  )
}
