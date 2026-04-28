import { create } from 'zustand'
import type { ViewMode } from '@/types'
import { defaultSelection } from './store-helpers'
import type { PanelMode, Selection } from './store-types'

interface UiStore {
  viewport: ViewMode
  activePage: string
  selection: Selection
  isViewOnly: boolean
  panelMode: PanelMode
  selectedCollectionItem: { collectionId: string; itemId: string } | null
  setViewport: (viewport: ViewMode) => void
  setActivePage: (pageId: string) => void
  setSelection: (selection: Partial<Selection>) => void
  clearSelection: () => void
  setViewOnly: (value: boolean) => void
  setPanelMode: (mode: PanelMode) => void
  setSelectedCollectionItem: (selection: { collectionId: string; itemId: string } | null) => void
  resetUiState: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  viewport: 'desktop',
  activePage: '',
  selection: defaultSelection,
  isViewOnly: false,
  panelMode: 'layers',
  selectedCollectionItem: null,
  setViewport: (viewport) => set({ viewport }),
  setActivePage: (pageId) => set({ activePage: pageId }),
  setSelection: (selection) => set((state) => ({ selection: { ...state.selection, ...selection } })),
  clearSelection: () => set({ selection: defaultSelection }),
  setViewOnly: (value) => set({ isViewOnly: value }),
  setPanelMode: (mode) => set({ panelMode: mode }),
  setSelectedCollectionItem: (selection) => set({ selectedCollectionItem: selection }),
  resetUiState: () => set({
    viewport: 'desktop',
    activePage: '',
    selection: defaultSelection,
    isViewOnly: false,
    panelMode: 'layers',
    selectedCollectionItem: null,
  }),
}))
