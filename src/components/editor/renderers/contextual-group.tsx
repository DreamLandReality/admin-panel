'use client'

import { useMemo } from 'react'
import { FieldDispatch } from './field-dispatch'
import { FieldWithStyle } from './field-with-style'
import type { RendererSharedProps } from './renderer-types'
import type { ContextualGroup } from '@/lib/utils/contextual-group-manager'

interface ContextualGroupRendererProps extends RendererSharedProps {
  groups: ContextualGroup[]
  properties: Record<string, any>
}

export function ContextualGroupRenderer({
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
  const groupsBySection = useMemo(() => {
    const sections: Record<string, ContextualGroup[]> = {
      content: [],
      media: [],
      layout: [],
      settings: [],
      default: [],
    }

    for (const group of groups) {
      let section = 'default'

      if (group.triggerField) {
        const triggerSchema = properties[group.triggerField]
        section = triggerSchema?.uiSection || 'default'
      } else if (group.fields.length > 0) {
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

interface ContextualGroupBlockProps extends RendererSharedProps {
  group: ContextualGroup
}

function ContextualGroupBlock({
  group,
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
