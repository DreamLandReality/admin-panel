'use client'

import { FieldDispatch } from './field-dispatch'
import { FieldWithStyle } from './field-with-style'
import type { RendererSharedProps } from './renderer-types'

interface StaticSectionRendererProps extends RendererSharedProps {
  entries: Array<readonly [string, any]>
}

export function StaticSectionRenderer({
  entries,
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

  Object.keys(groupedFields).forEach(section => {
    groupedFields[section].sort((a, b) => a[2] - b[2])
  })

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
