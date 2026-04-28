import { create } from 'zustand'
import { useDeployStore } from './deploy-store'
import { revokeAllBlobs, setNested, setNestedMutable } from './store-helpers'
import type { EditorStore } from './store-types'
export const useEditorStore = create<EditorStore>((set, get) => ({
  sectionData: {},
  sectionsRegistry: {},
  collectionData: {},
  blobUrls: {},
  dataUrls: {},
  pendingImages: {},
  isDirty: false,
  updateField: (sectionId, field, value) =>
    set((state) => {
      const constraints = useDeployStore.getState().constraintsMap[sectionId]?.[field]
      let constrained = value
      if (constraints) {
        if (typeof constrained === 'string' && constraints.maxLength != null) {
          constrained = constrained.slice(0, constraints.maxLength)
        }
        if (typeof constrained === 'number') {
          if (constraints.min != null) constrained = Math.max(constraints.min, constrained)
          if (constraints.max != null) constrained = Math.min(constraints.max, constrained)
        }
      }
      let blobUrls = state.blobUrls
      let dataUrls = state.dataUrls
      const oldValue = state.sectionData[sectionId]?.[field]
      if (Array.isArray(oldValue) && Array.isArray(constrained) && constrained.length < oldValue.length) {
        oldValue.slice(constrained.length).forEach((_item, index) => {
          const itemKey = `${sectionId}.${field}.${constrained.length + index}`
          const blobUrl = blobUrls[itemKey]
          if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl)
          if (blobUrl && dataUrls[blobUrl]) {
            const nextDataUrls = { ...dataUrls }
            delete nextDataUrls[blobUrl]
            dataUrls = nextDataUrls
          }
          if (blobUrl) {
            const nextBlobUrls = { ...blobUrls }
            delete nextBlobUrls[itemKey]
            blobUrls = nextBlobUrls
          }
        })
      }
      const sectionData = { ...state.sectionData }
      sectionData[sectionId] = setNested(sectionData[sectionId] ?? {}, field.split('.'), constrained)
      useDeployStore.getState().setLastFieldUpdate({ sectionId, field, value: constrained, ts: Date.now() })
      return { sectionData, blobUrls, dataUrls, isDirty: true }
    }),
  updateStyle: (sectionId, field, styles) =>
    set((state) => {
      const sectionData = { ...state.sectionData }
      const styleKey = `${field}__style`
      if (Array.isArray(sectionData[sectionId])) {
        const wrapperKey = `${sectionId}__styles`
        const existing = (sectionData[wrapperKey] as Record<string, any>) ?? {}
        sectionData[wrapperKey] = { ...existing, [styleKey]: { ...existing[styleKey], ...styles } } as any
      } else {
        sectionData[sectionId] = sectionData[sectionId] ?? {}
        sectionData[sectionId][styleKey] = { ...sectionData[sectionId][styleKey], ...styles }
      }
      return { sectionData, isDirty: true }
    }),
  toggleSection: (sectionId, enabled) =>
    set((state) => ({
      sectionsRegistry: {
        ...state.sectionsRegistry,
        [sectionId]: { ...(state.sectionsRegistry[sectionId] ?? {}), enabled },
      },
      isDirty: true,
    })),
  toggleSectionNav: (sectionId, showInNav) =>
    set((state) => ({
      sectionsRegistry: {
        ...state.sectionsRegistry,
        [sectionId]: { ...(state.sectionsRegistry[sectionId] ?? { enabled: true }), showInNav },
      },
      isDirty: true,
    })),
  setBlobUrl: (key, url) =>
    set((state) => {
      const prev = state.blobUrls[key]
      if (prev) URL.revokeObjectURL(prev)
      return { blobUrls: { ...state.blobUrls, [key]: url } }
    }),
  setDataUrl: (blobUrl, dataUrl) => set((state) => ({ dataUrls: { ...state.dataUrls, [blobUrl]: dataUrl } })),
  addPendingImage: (key, pending) =>
    set((state) => {
      const prev = state.pendingImages[key]
      if (prev?.blobUrl.startsWith('blob:')) URL.revokeObjectURL(prev.blobUrl)
      return { pendingImages: { ...state.pendingImages, [key]: pending }, isDirty: true }
    }),
  removePendingImage: (key) =>
    set((state) => {
      const { [key]: removed, ...pendingImages } = state.pendingImages
      if (removed?.blobUrl.startsWith('blob:')) URL.revokeObjectURL(removed.blobUrl)
      return { pendingImages }
    }),
  addArrayItem: (sectionId, item, path) =>
    set((state) => {
      const sectionData = { ...state.sectionData }
      if (path) {
        const obj = structuredClone(sectionData[sectionId] ?? {}) as Record<string, any>
        obj[path] = [...(Array.isArray(obj[path]) ? obj[path] : []), item]
        sectionData[sectionId] = obj as any
      } else {
        sectionData[sectionId] = [...(Array.isArray(sectionData[sectionId]) ? sectionData[sectionId] as any[] : []), item] as any
      }
      return { sectionData, isDirty: true }
    }),
  removeArrayItem: (sectionId, index, path) =>
    set((state) => {
      const sectionData = { ...state.sectionData }
      if (path) {
        const obj = structuredClone(sectionData[sectionId] ?? {}) as Record<string, any>
        const arr = Array.isArray(obj[path]) ? [...obj[path]] : []
        arr.splice(index, 1)
        obj[path] = arr
        sectionData[sectionId] = obj as any
      } else {
        const arr = Array.isArray(sectionData[sectionId]) ? [...(sectionData[sectionId] as any[])] : []
        arr.splice(index, 1)
        sectionData[sectionId] = arr as any
      }
      return { sectionData, isDirty: true }
    }),
  updateArrayItemField: (sectionId, index, field, value, path) =>
    set((state) => {
      const sectionData = { ...state.sectionData }
      if (path) {
        const obj = structuredClone(sectionData[sectionId] ?? {}) as Record<string, any>
        const arr = Array.isArray(obj[path]) ? [...obj[path]] : []
        if (arr[index]) {
          arr[index] = structuredClone(arr[index])
          setNestedMutable(arr[index], field.split('.'), value)
          obj[path] = arr
          sectionData[sectionId] = obj as any
        }
      } else {
        const arr = Array.isArray(sectionData[sectionId]) ? [...(sectionData[sectionId] as any[])] : []
        if (arr[index]) {
          arr[index] = structuredClone(arr[index])
          setNestedMutable(arr[index], field.split('.'), value)
          sectionData[sectionId] = arr as any
        }
      }
      return { sectionData, isDirty: true }
    }),
  updateCollectionItem: (collectionId, itemId, field, value) =>
    set((state) => {
      const items = [...(state.collectionData[collectionId] ?? [])]
      const idx = items.findIndex((item) => item.id === itemId)
      if (idx < 0) return state
      items[idx] = structuredClone(items[idx])
      setNestedMutable(items[idx], field.split('.'), value)
      return { collectionData: { ...state.collectionData, [collectionId]: items }, isDirty: true }
    }),
  addCollectionItem: (collectionId, item) =>
    set((state) => ({
      collectionData: {
        ...state.collectionData,
        [collectionId]: [...(state.collectionData[collectionId] ?? []), { id: `${collectionId}_${Date.now()}`, ...item }],
      },
      isDirty: true,
    })),
  removeCollectionItem: (collectionId, itemId) =>
    set((state) => ({
      collectionData: {
        ...state.collectionData,
        [collectionId]: (state.collectionData[collectionId] ?? []).filter((item) => item.id !== itemId),
      },
      isDirty: true,
    })),
  reorderCollectionItems: (collectionId, fromIndex, toIndex) =>
    set((state) => {
      const items = [...(state.collectionData[collectionId] ?? [])]
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { collectionData: { ...state.collectionData, [collectionId]: items }, isDirty: true }
    }),
  setEditorState: (state) => set(state),
  revokeCurrentBlobs: () => revokeAllBlobs(get().blobUrls, get().pendingImages),
  resetEditorState: () => {
    revokeAllBlobs(get().blobUrls, get().pendingImages)
    set({
      sectionData: {},
      sectionsRegistry: {},
      collectionData: {},
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
    })
  },
}))
