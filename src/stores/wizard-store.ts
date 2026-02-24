import { create } from 'zustand'
import type { Template, ViewMode, Draft, PendingImage } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Selection {
  mode: null | 'section' | 'field' | 'image'
  sectionId: string | null
  field: string | null
  elementType: 'text' | 'image' | null
  content: string | null
}

interface WizardStore {
  // Wizard navigation
  currentStep: 1 | 2 | 3 | 4
  setStep: (step: 1 | 2 | 3 | 4) => void

  // Step 1 — Template selection + project name
  selectedTemplate: Template | null
  selectTemplate: (t: Template) => void
  projectName: string
  setProjectName: (name: string) => void

  // Draft tracking
  draftId: string | null
  setDraftId: (id: string | null) => void

  // Step 2 — Data input
  rawText: string
  setRawText: (t: string) => void

  // Step 3 — Editor (shared state)
  sectionData: Record<string, Record<string, any>>
  sectionsRegistry: Record<string, { enabled: boolean }>
  collectionData: Record<string, any[]>  // collectionId → items array
  blobUrls: Record<string, string> // key: "sectionId.field"
  dataUrls: Record<string, string> // key: blobUrl → data URL (for cross-origin iframe display)
  pendingImages: Record<string, PendingImage>  // key: "sectionId.field" → file + r2Key
  isDirty: boolean
  viewport: ViewMode
  activePage: string              // 'home' | '404' | '<property-slug>'
  selection: Selection

  // Field/style mutations
  updateField: (sectionId: string, field: string, value: any) => void
  updateStyle: (sectionId: string, field: string, styles: Record<string, string>) => void
  toggleSection: (sectionId: string, enabled: boolean) => void
  setBlobUrl: (key: string, url: string) => void
  setDataUrl: (blobUrl: string, dataUrl: string) => void
  addPendingImage: (key: string, pending: PendingImage) => void
  removePendingImage: (key: string) => void

  // Array mutations (for array-type sections like properties)
  // Optional `path` for object-with-items sections (e.g. path="items" → sectionData[sectionId].items[])
  addArrayItem: (sectionId: string, item: Record<string, any>, path?: string) => void
  removeArrayItem: (sectionId: string, index: number, path?: string) => void
  updateArrayItemField: (sectionId: string, index: number, field: string, value: any, path?: string) => void

  // Collection mutations (CMS/Phase 2)
  updateCollectionItem: (collectionId: string, itemId: string, field: string, value: any) => void
  addCollectionItem: (collectionId: string, item: Record<string, any>) => void
  removeCollectionItem: (collectionId: string, itemId: string) => void
  reorderCollectionItems: (collectionId: string, fromIndex: number, toIndex: number) => void

  // UI state
  panelMode: 'layers' | 'data'
  setPanelMode: (mode: 'layers' | 'data') => void
  selectedCollectionItem: { collectionId: string; itemId: string } | null
  setSelectedCollectionItem: (sel: { collectionId: string; itemId: string } | null) => void
  setViewport: (v: ViewMode) => void
  setActivePage: (pageId: string) => void
  setSelection: (s: Partial<Selection>) => void
  clearSelection: () => void

  // Bulk actions
  loadParseResult: (data: Record<string, any>, sections: Record<string, { enabled: boolean }>) => void
  loadManualDefaults: (template: Template) => void
  loadFromDraft: (draft: Draft, template: Template) => void
  reset: () => void
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultSelection: Selection = {
  mode: null,
  sectionId: null,
  field: null,
  elementType: null,
  content: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Immutable deep set via dot-notation parts — avoids structuredClone overhead */
function setNested(obj: Record<string, any>, parts: string[], value: any): Record<string, any> {
  if (parts.length === 1) return { ...obj, [parts[0]]: value }
  const key = parts[0]
  return {
    ...obj,
    [key]: setNested(
      obj[key] != null && typeof obj[key] === 'object' ? obj[key] : {},
      parts.slice(1),
      value
    ),
  }
}

/** Revoke all blob URLs and pending image blob URLs */
function revokeAllBlobs(blobUrls: Record<string, string>, pendingImages: Record<string, PendingImage>) {
  for (const url of Object.values(blobUrls)) {
    if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
  }
  for (const pending of Object.values(pendingImages)) {
    if (pending.blobUrl.startsWith('blob:')) URL.revokeObjectURL(pending.blobUrl)
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWizardStore = create<WizardStore>((set, get) => ({
  // Navigation
  currentStep: 1,
  setStep: (step) => set((s) => {
    if (step === 1) {
      return { currentStep: 1, selectedTemplate: null }
    }
    return { currentStep: step }
  }),

  // Step 1
  selectedTemplate: null,
  selectTemplate: (t) => set({ selectedTemplate: t }),
  projectName: '',
  setProjectName: (name) => set({ projectName: name }),

  // Draft tracking
  draftId: null,
  setDraftId: (id) => set({ draftId: id }),

  // Step 2
  rawText: '',
  setRawText: (t) => set({ rawText: t }),

  // Step 3 initial state
  sectionData: {},
  sectionsRegistry: {},
  collectionData: {},
  blobUrls: {},
  dataUrls: {},
  pendingImages: {},
  isDirty: false,
  viewport: 'desktop',
  activePage: 'home',
  selection: defaultSelection,
  panelMode: 'layers',
  setPanelMode: (mode) => set({ panelMode: mode }),
  selectedCollectionItem: null,
  setSelectedCollectionItem: (sel) => set({ selectedCollectionItem: sel }),

  // Field update — supports deep dot notation (e.g. "cta.text", "structuredData.address.street")
  updateField: (sectionId, field, value) =>
    set((s) => {
      const next = { ...s.sectionData }
      if (!next[sectionId]) next[sectionId] = {}
      const parts = field.split('.')
      next[sectionId] = setNested(next[sectionId] ?? {}, parts, value)
      return { sectionData: next, isDirty: true }
    }),

  // Style update — writes to fieldName__style key
  // For array sections, styles are stored in a parallel `${sectionId}__styles` key
  // to avoid writing named properties on arrays (which are lost during spread/clone)
  updateStyle: (sectionId, field, styles) =>
    set((s) => {
      const next = { ...s.sectionData }
      const styleKey = `${field}__style`
      if (Array.isArray(next[sectionId])) {
        const wrapperKey = `${sectionId}__styles`
        const existing = (next[wrapperKey] as Record<string, any>) ?? {}
        next[wrapperKey] = { ...existing, [styleKey]: { ...existing[styleKey], ...styles } } as any
      } else {
        if (!next[sectionId]) next[sectionId] = {}
        next[sectionId][styleKey] = { ...next[sectionId][styleKey], ...styles }
      }
      return { sectionData: next, isDirty: true }
    }),

  toggleSection: (sectionId, enabled) =>
    set((s) => ({
      sectionsRegistry: { ...s.sectionsRegistry, [sectionId]: { enabled } },
      isDirty: true,
    })),

  setBlobUrl: (key, url) =>
    set((s) => {
      const prev = s.blobUrls[key]
      if (prev) URL.revokeObjectURL(prev)
      return { blobUrls: { ...s.blobUrls, [key]: url } }
    }),

  setDataUrl: (blobUrl, dataUrl) =>
    set((s) => ({ dataUrls: { ...s.dataUrls, [blobUrl]: dataUrl } })),

  addPendingImage: (key, pending) =>
    set((s) => {
      const prev = s.pendingImages[key]
      if (prev && prev.blobUrl.startsWith('blob:')) URL.revokeObjectURL(prev.blobUrl)
      return {
        pendingImages: { ...s.pendingImages, [key]: pending },
        isDirty: true,
      }
    }),

  removePendingImage: (key) =>
    set((s) => {
      const { [key]: removed, ...rest } = s.pendingImages
      if (removed?.blobUrl.startsWith('blob:')) URL.revokeObjectURL(removed.blobUrl)
      return { pendingImages: rest }
    }),

  // Array mutations — supports both flat arrays (sectionData[sectionId] = []) and
  // nested arrays (sectionData[sectionId].items = []) via optional `path` parameter
  addArrayItem: (sectionId, item, path) =>
    set((s) => {
      const next = { ...s.sectionData }
      if (path) {
        const obj = structuredClone(next[sectionId] ?? {}) as Record<string, any>
        const arr = Array.isArray(obj[path]) ? obj[path] : []
        arr.push(item)
        obj[path] = arr
        next[sectionId] = obj as any
      } else {
        const arr = Array.isArray(next[sectionId]) ? [...(next[sectionId] as any[])] : []
        arr.push(item)
        next[sectionId] = arr as any
      }
      return { sectionData: next, isDirty: true }
    }),

  removeArrayItem: (sectionId, index, path) =>
    set((s) => {
      const next = { ...s.sectionData }
      if (path) {
        const obj = structuredClone(next[sectionId] ?? {}) as Record<string, any>
        const arr = Array.isArray(obj[path]) ? obj[path] : []
        arr.splice(index, 1)
        obj[path] = arr
        next[sectionId] = obj as any
      } else {
        const arr = Array.isArray(next[sectionId]) ? [...(next[sectionId] as any[])] : []
        arr.splice(index, 1)
        next[sectionId] = arr as any
      }
      return { sectionData: next, isDirty: true }
    }),

  updateArrayItemField: (sectionId, index, field, value, path) =>
    set((s) => {
      const next = { ...s.sectionData }
      if (path) {
        const obj = structuredClone(next[sectionId] ?? {}) as Record<string, any>
        const arr = Array.isArray(obj[path]) ? obj[path] : []
        if (arr[index]) {
          // Support dot-notation for nested fields (e.g. "specs.bedrooms")
          const parts = field.split('.')
          if (parts.length === 1) {
            arr[index] = { ...arr[index], [field]: value }
          } else {
            let cursor: any = arr[index]
            for (let i = 0; i < parts.length - 1; i++) {
              if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {}
              cursor = cursor[parts[i]]
            }
            cursor[parts[parts.length - 1]] = value
          }
          obj[path] = arr
          next[sectionId] = obj as any
        }
      } else {
        const arr = Array.isArray(next[sectionId]) ? [...(next[sectionId] as any[])] : []
        if (arr[index]) {
          // Support dot-notation for nested fields
          const parts = field.split('.')
          if (parts.length === 1) {
            arr[index] = { ...arr[index], [field]: value }
          } else {
            arr[index] = structuredClone(arr[index])
            let cursor: any = arr[index]
            for (let i = 0; i < parts.length - 1; i++) {
              if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {}
              cursor = cursor[parts[i]]
            }
            cursor[parts[parts.length - 1]] = value
          }
          next[sectionId] = arr as any
        }
      }
      return { sectionData: next, isDirty: true }
    }),

  // Collection mutations (CMS/Phase 2)
  updateCollectionItem: (collectionId, itemId, field, value) =>
    set((s) => {
      const items = [...(s.collectionData[collectionId] ?? [])]
      const idx = items.findIndex((i) => i.id === itemId)
      if (idx < 0) return s
      const parts = field.split('.')
      if (parts.length === 1) {
        items[idx] = { ...items[idx], [field]: value }
      } else {
        items[idx] = structuredClone(items[idx])
        let cursor: any = items[idx]
        for (let i = 0; i < parts.length - 1; i++) {
          if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {}
          cursor = cursor[parts[i]]
        }
        cursor[parts[parts.length - 1]] = value
      }
      return {
        collectionData: { ...s.collectionData, [collectionId]: items },
        isDirty: true,
      }
    }),

  addCollectionItem: (collectionId, item) =>
    set((s) => ({
      collectionData: {
        ...s.collectionData,
        [collectionId]: [
          ...(s.collectionData[collectionId] ?? []),
          { id: `${collectionId}_${Date.now()}`, ...item },
        ],
      },
      isDirty: true,
    })),

  removeCollectionItem: (collectionId, itemId) =>
    set((s) => ({
      collectionData: {
        ...s.collectionData,
        [collectionId]: (s.collectionData[collectionId] ?? []).filter((i) => i.id !== itemId),
      },
      isDirty: true,
    })),

  reorderCollectionItems: (collectionId, fromIndex, toIndex) =>
    set((s) => {
      const items = [...(s.collectionData[collectionId] ?? [])]
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return {
        collectionData: { ...s.collectionData, [collectionId]: items },
        isDirty: true,
      }
    }),

  setViewport: (v) => set({ viewport: v }),

  setActivePage: (pageId) => set({ activePage: pageId }),

  setSelection: (partial) =>
    set((s) => ({ selection: { ...s.selection, ...partial } })),

  clearSelection: () => set({ selection: defaultSelection }),

  // Load AI parse result and advance to editor
  loadParseResult: (data, sections) => {
    // Initialize collection data from manifest if available
    const template = get().selectedTemplate
    const collectionData: Record<string, any[]> = {}
    for (const col of template?.manifest?.collections ?? []) {
      collectionData[col.id] = col.data ?? []
    }
    set({
      sectionData: data,
      sectionsRegistry: sections,
      collectionData,
      currentStep: 3,
      isDirty: false,
    })
  },

  // Load template defaults without AI parse and advance to editor
  loadManualDefaults: (template) => {
    const sections: Record<string, { enabled: boolean }> = {}
    template.manifest?.sections?.forEach((s) => {
      sections[s.id] = { enabled: true }
    })

    // Initialize collection data from manifest
    const collectionData: Record<string, any[]> = {}
    for (const col of template.manifest?.collections ?? []) {
      collectionData[col.id] = col.data ?? []
    }

    const sectionData: Record<string, any> = { ...((template.default_data as Record<string, Record<string, any>>) ?? {}) }

    // Legacy migration: if section items are full objects (not string IDs),
    // populate collectionData from them and convert to references
    for (const section of template.manifest?.sections ?? []) {
      const sData = sectionData[section.id]
      if (!sData || typeof sData !== 'object') continue
      for (const [key, fieldSchema] of Object.entries(section.schema?.properties ?? {}) as [string, any][]) {
        if (fieldSchema.uiWidget === 'collectionPicker' && fieldSchema.collectionId && Array.isArray(sData[key])) {
          const items = sData[key]
          if (items.length > 0 && typeof items[0] === 'object') {
            // Legacy format: items are full objects — migrate to collection + references
            collectionData[fieldSchema.collectionId] = items.map((item: any, i: number) => ({
              id: item.id ?? `${fieldSchema.collectionId}_${i + 1}`,
              ...item,
            }))
            sectionData[section.id] = {
              ...sData,
              [key]: collectionData[fieldSchema.collectionId].map((item: any) => item.id),
            }
          }
        }
      }
    }

    // Seed any manifest sections missing from template.default_data with their section.data defaults.
    // This handles sections added to the manifest after the saved DB record was created.
    for (const section of template.manifest?.sections ?? []) {
      if (!(section.id in sectionData) && section.data) {
        sectionData[section.id] = section.data
      }
    }

    set({
      sectionData,
      sectionsRegistry: sections,
      collectionData,
      currentStep: 3,
      isDirty: false,
    })
  },

  // Load from a saved draft and resume editing
  loadFromDraft: (draft, template) => {
    // Revoke existing blob URLs
    revokeAllBlobs(get().blobUrls, get().pendingImages)

    set({
      draftId: draft.id,
      projectName: draft.project_name ?? '',
      selectedTemplate: template,
      currentStep: (draft.current_step as 1 | 2 | 3 | 4) ?? 3,
      rawText: draft.raw_text ?? '',
      sectionData: draft.section_data ?? {},
      sectionsRegistry: draft.sections_registry ?? {},
      collectionData: draft.collection_data ?? {},
      activePage: draft.last_active_page ?? 'home',
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
      viewport: 'desktop',
      selection: defaultSelection,
      panelMode: 'layers',
      selectedCollectionItem: null,
    })
  },

  reset: () => {
    // Revoke all blob URLs to prevent memory leaks
    revokeAllBlobs(get().blobUrls, get().pendingImages)
    return set({
      currentStep: 1,
      selectedTemplate: null,
      projectName: '',
      draftId: null,
      rawText: '',
      sectionData: {},
      sectionsRegistry: {},
      collectionData: {},
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
      viewport: 'desktop',
      activePage: 'home',
      selection: defaultSelection,
      panelMode: 'layers',
      selectedCollectionItem: null,
    })
  },
}))
