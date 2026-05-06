'use client'

import { useEffect, useState } from 'react'
import { PanelHeader } from '@/components/layout/PanelHeader'
import { useEditorStore } from '@/stores/editor-store'
import { useUiStore } from '@/stores/ui-store'
import { useWizardStore } from '@/stores/wizard-store'
import { SchemaFieldRenderer } from '../schema-field-renderer'
import { ArraySectionEditor } from './section-fields/array-section-editor'
import { NavVisibilityControl } from './section-fields/nav-visibility-control'
import { SectionStyleControls } from './section-fields/section-style-controls'
import { findEmbeddedArrayKey } from './section-fields/section-field-utils'
import { useSectionFieldActions } from './section-fields/use-section-field-actions'

interface SectionFieldsViewProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
}

interface SelectedSectionFieldsViewProps extends SectionFieldsViewProps {
  sectionId: string
}

export function SectionFieldsView({ iframeRef }: SectionFieldsViewProps) {
  const sectionId = useUiStore((state) => state.selection.sectionId)

  if (!sectionId) return null

  return <SelectedSectionFieldsView sectionId={sectionId} iframeRef={iframeRef} />
}

function SelectedSectionFieldsView({
  sectionId,
  iframeRef,
}: SelectedSectionFieldsViewProps) {
  const selectionItemIndex = useUiStore((state) => state.selection.itemIndex)
  const selectionField = useUiStore((state) => state.selection.field)
  const sectionData = useEditorStore((state) => state.sectionData)
  const collectionData = useEditorStore((state) => state.collectionData)
  const sectionsRegistry = useEditorStore((state) => state.sectionsRegistry)
  const toggleSectionNav = useEditorStore((state) => state.toggleSectionNav)
  const addArrayItem = useEditorStore((state) => state.addArrayItem)
  const removeArrayItem = useEditorStore((state) => state.removeArrayItem)
  const selectedTemplate = useWizardStore((state) => state.selectedTemplate)
  const [expandedItem, setExpandedItem] = useState<number | null>(null)

  useEffect(() => {
    if (selectionItemIndex !== null && selectionItemIndex !== undefined) {
      setExpandedItem(selectionItemIndex)
    }
  }, [selectionItemIndex, selectionField])

  const manifest = selectedTemplate?.manifest
  const section = manifest?.sections?.find((candidate) => candidate.id === sectionId)
  const schema = section?.schema
  const data = sectionData[sectionId]
  const styleDef = section?.styleControls
  const sectionStyleControls = (
    <SectionStyleControls
      sectionId={sectionId}
      controls={styleDef?.section ?? []}
      iframeRef={iframeRef}
    />
  )
  const {
    handleArrayItemChange,
    handleArrayItemImageUpload,
    handleFieldChange,
    handleImageUpload,
  } = useSectionFieldActions({ sectionId, iframeRef })

  if (!schema) return null

  const isArraySection = schema.type === 'array' || Boolean(findEmbeddedArrayKey(schema))

  return (
    <div>
      <PanelHeader title={section?.name ?? sectionId} sticky />
      <NavVisibilityControl
        sectionId={sectionId}
        section={section}
        manifest={manifest}
        sectionsRegistry={sectionsRegistry}
        onToggle={toggleSectionNav}
      />

      {isArraySection ? (
        <ArraySectionEditor
          sectionId={sectionId}
          sectionName={section?.name}
          schema={schema}
          data={data}
          collectionData={collectionData}
          fieldStyleControls={styleDef?.fields ?? {}}
          iframeRef={iframeRef}
          expandedItem={expandedItem}
          onExpandedItemChange={setExpandedItem}
          onFieldChange={handleFieldChange}
          onImageUpload={handleImageUpload}
          onArrayItemChange={handleArrayItemChange}
          onArrayItemImageUpload={handleArrayItemImageUpload}
          onAddItem={addArrayItem}
          onRemoveItem={removeArrayItem}
          footer={sectionStyleControls}
        />
      ) : (
        <div className="px-4 space-y-3 pb-4 pt-3">
          <SchemaFieldRenderer
            properties={schema.properties ?? {}}
            data={data as Record<string, unknown>}
            onChange={handleFieldChange}
            onImageUpload={handleImageUpload}
            collectionData={collectionData}
            fieldStyleControls={styleDef?.fields ?? {}}
            sectionId={sectionId}
            iframeRef={iframeRef}
          />
          {sectionStyleControls}
        </div>
      )}
    </div>
  )
}
