'use client'

import { TextInput } from '@/components/forms'
import {
  FileUploadButton,
  ImageUploadButton,
  PanelInput,
  PanelNumberInput,
  PanelPagePicker,
  PanelSlider,
  PanelTextarea,
  PanelToggle,
} from '../inputs'
import { IconPickerField } from '../icon-picker'
import { XIcon } from '@/components/icons'

export function RepeaterField({
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
                className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-error transition-all"
              >
                <XIcon width={10} height={10} strokeWidth={1.5} />
              </button>
            )}
            {(Object.entries(itemProps) as [string, any][]).map(([itemKey, itemSchema]) => {
              const itemWidget = itemSchema.uiWidget
              const itemLabel = itemSchema.uiLabel || itemKey
              const itemValue = item[itemKey]
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

export function StringArrayField({
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
              className="text-muted-foreground hover:text-error px-1"
            >
              <XIcon width={8} height={8} strokeWidth={2} />
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

export function ObjectArrayField({
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
            {canRemove && (
              <button
                onClick={() => handleRemoveItem(i)}
                className="absolute top-2 right-2 opacity-0 group-hover/gitem:opacity-100 text-muted-foreground hover:text-error transition-all"
              >
                <XIcon width={10} height={10} strokeWidth={1.5} />
              </button>
            )}
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
