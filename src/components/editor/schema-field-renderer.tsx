'use client'

import { useEditorStore } from '@/stores/editor-store'
import { useContextualGroups } from '@/hooks/use-contextual-groups'
import { ContextualGroupRenderer } from './renderers/contextual-group'
import { StaticSectionRenderer } from './renderers/static-section'
import type { SchemaFieldRendererProps } from './renderers/renderer-types'

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
  const storeCollectionData = useEditorStore((s) => s.collectionData)
  const collectionData = collectionDataProp ?? storeCollectionData

  const { groups, hasContextualGroups } = useContextualGroups({
    properties,
    data,
    enableContextualGrouping: true,
    debug: false,
  })

  const entries = fields
    ? fields.map((f) => [f, properties[f]] as const).filter(([, v]) => v)
    : Object.entries(properties)

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

  return (
    <StaticSectionRenderer
      entries={entries}
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
