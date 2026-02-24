'use client'

import { PanelPagePicker, PanelInput, PanelTextarea, PanelNumberInput, PanelColorInput, ImageUploadButton } from './panel-inputs'
import { CollectionPickerWidget } from './collection-picker'
import { useWizardStore } from '@/stores/wizard-store'

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
}: SchemaFieldRendererProps) {
  const storeCollectionData = useWizardStore((s) => s.collectionData)
  const collectionData = collectionDataProp ?? storeCollectionData

  const entries = fields
    ? fields.map((f) => [f, properties[f]] as const).filter(([, v]) => v)
    : Object.entries(properties)

  return (
    <div className="space-y-3">
      {entries.map(([key, fieldSchema]: [string, any]) => {
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

        return (
          <FieldDispatch
            key={fieldPath}
            fieldPath={fieldPath}
            fieldSchema={fieldSchema}
            label={label}
            value={value}
            widget={widget}
            onChange={onChange}
            onImageUpload={onImageUpload}
            collectionData={collectionData}
          />
        )
      })}
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
}: {
  fieldPath: string
  fieldSchema: any
  label: string
  value: any
  widget: string | undefined
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  collectionData: Record<string, any[]>
}) {
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
    return (
      <div>
        <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">{label}</label>
        {value && (
          <div className="aspect-video rounded-lg overflow-hidden bg-white/5 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value as string} alt="" className="w-full h-full object-cover" />
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

  // 3. Textarea
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

  // 4. Nested object
  if (fieldSchema.type === 'object' && fieldSchema.properties) {
    return (
      <div>
        <p className="text-label uppercase tracking-label text-muted-foreground mb-2 mt-4">{label}</p>
        <div className="space-y-3 pl-2 border-l border-white/5">
          <SchemaFieldRenderer
            properties={fieldSchema.properties}
            data={(value as Record<string, any>) ?? {}}
            onChange={onChange}
            onImageUpload={onImageUpload}
            prefix={fieldPath}
            collectionData={collectionData}
          />
        </div>
      </div>
    )
  }

  // 5. Number
  if (fieldSchema.type === 'number') {
    return (
      <PanelNumberInput
        label={label}
        value={(value as number) ?? 0}
        onChange={(v) => onChange(fieldPath, v)}
      />
    )
  }

  // 6. Collection picker (array + collectionPicker widget)
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

  // 7. Repeater (array + repeater widget)
  if (fieldSchema.type === 'array' && widget === 'repeater' && fieldSchema.items) {
    return (
      <RepeaterField
        label={label}
        fieldPath={fieldPath}
        fieldSchema={fieldSchema}
        items={(value as any[]) ?? []}
        onChange={onChange}
      />
    )
  }

  // 8. Simple array of strings
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

  // 9. Object array (e.g. gallery items)
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

// ─── RepeaterField ───────────────────────────────────────────────────────────

function RepeaterField({
  label,
  fieldPath,
  fieldSchema,
  items,
  onChange,
}: {
  label: string
  fieldPath: string
  fieldSchema: any
  items: any[]
  onChange: (fieldPath: string, value: any) => void
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
    }
    onChange(fieldPath, [...items, newItem])
  }

  function handleRemoveItem(index: number) {
    onChange(fieldPath, items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <p className="text-label uppercase tracking-label text-muted-foreground mb-2 mt-4">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-2.5 space-y-2 relative group/item">
            <button
              onClick={() => handleRemoveItem(i)}
              className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {Object.entries(itemProps).map(([itemKey, itemSchema]: [string, any]) => {
              if (itemSchema.uiWidget === 'pagePicker') {
                return (
                  <PanelPagePicker
                    key={itemKey}
                    label={itemSchema.uiLabel || itemKey}
                    value={(item[itemKey] as string) ?? ''}
                    onChange={(v) => handleItemChange(i, itemKey, v)}
                  />
                )
              }
              return (
                <PanelInput
                  key={itemKey}
                  label={itemSchema.uiLabel || itemKey}
                  value={(item[itemKey] as string) ?? ''}
                  placeholder={itemSchema.description}
                  onChange={(v) => handleItemChange(i, itemKey, v)}
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
      <p className="text-label uppercase tracking-label text-muted-foreground mb-2 mt-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((v, i) => (
          <div key={i} className="flex gap-1">
            <input
              value={v}
              onChange={(e) => {
                const updated = [...items]
                updated[i] = e.target.value
                onChange(fieldPath, updated)
              }}
              className="flex-1 bg-white/5 rounded-md px-2.5 py-1.5 text-sm text-foreground border border-transparent focus:border-white/20 focus:outline-none transition-colors"
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
          className="text-[10px] text-muted-foreground hover:text-foreground"
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

  return (
    <div>
      <p className="text-label uppercase tracking-label text-muted-foreground mb-2 mt-2">{label}</p>
      <div className="space-y-2">
        {items.map((arrItem, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-2.5 space-y-2 relative group/gitem">
            <button
              onClick={() => handleRemoveItem(i)}
              className="absolute top-2 right-2 opacity-0 group-hover/gitem:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {Object.entries(itemProps).map(([itemKey, itemSch]: [string, any]) => {
              if (itemSch.uiWidget === 'imageUpload') {
                const imgValue = (arrItem[itemKey] as string) ?? ''
                return (
                  <div key={itemKey}>
                    <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">
                      {itemSch.uiLabel || itemKey}
                    </label>
                    {imgValue && (
                      <div className="aspect-video rounded-lg overflow-hidden bg-white/5 mb-2">
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
