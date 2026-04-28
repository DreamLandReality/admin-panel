import type { PendingImage, SectionRegistry, ViewMode } from '@/types'

export interface Selection {
  mode: null | 'section' | 'field' | 'image'
  sectionId: string | null
  field: string | null
  elementType: 'text' | 'image' | null
  content: string | null
  itemIndex: number | null
}

export type WizardStep = 1 | 2 | 3 | 4
export type PanelMode = 'layers' | 'data'

export interface LastFieldUpdate {
  sectionId: string
  field: string
  value: any
  ts: number
}

export interface UiStateSnapshot {
  viewport: ViewMode
  activePage: string
  selection: Selection
  isViewOnly: boolean
  panelMode: PanelMode
  selectedCollectionItem: { collectionId: string; itemId: string } | null
}

export interface EditorStore {
  sectionData: Record<string, Record<string, any>>
  sectionsRegistry: Record<string, SectionRegistry>
  collectionData: Record<string, any[]>
  blobUrls: Record<string, string>
  dataUrls: Record<string, string>
  pendingImages: Record<string, PendingImage>
  isDirty: boolean
  updateField: (sectionId: string, field: string, value: any) => void
  updateStyle: (sectionId: string, field: string, styles: Record<string, string>) => void
  toggleSection: (sectionId: string, enabled: boolean) => void
  toggleSectionNav: (sectionId: string, showInNav: boolean) => void
  setBlobUrl: (key: string, url: string) => void
  setDataUrl: (blobUrl: string, dataUrl: string) => void
  addPendingImage: (key: string, pending: PendingImage) => void
  removePendingImage: (key: string) => void
  addArrayItem: (sectionId: string, item: Record<string, any>, path?: string) => void
  removeArrayItem: (sectionId: string, index: number, path?: string) => void
  updateArrayItemField: (sectionId: string, index: number, field: string, value: any, path?: string) => void
  updateCollectionItem: (collectionId: string, itemId: string, field: string, value: any) => void
  addCollectionItem: (collectionId: string, item: Record<string, any>) => void
  removeCollectionItem: (collectionId: string, itemId: string) => void
  reorderCollectionItems: (collectionId: string, fromIndex: number, toIndex: number) => void
  setEditorState: (state: Partial<Pick<EditorStore, 'sectionData' | 'sectionsRegistry' | 'collectionData' | 'blobUrls' | 'dataUrls' | 'pendingImages' | 'isDirty'>>) => void
  resetEditorState: () => void
  revokeCurrentBlobs: () => void
}
