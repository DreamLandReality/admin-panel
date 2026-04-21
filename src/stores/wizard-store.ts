import { create } from 'zustand'
import type { Template, ViewMode, Draft, PendingImage, Deployment, FieldConstraints, DeploymentStatus } from '@/types'
import { buildFieldMaps } from '@/lib/utils/build-field-maps'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Selection {
  mode: null | 'section' | 'field' | 'image'
  sectionId: string | null
  field: string | null
  elementType: 'text' | 'image' | null
  content: string | null
  itemIndex: number | null
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

  // Deployment edit tracking
  deploymentId: string | null
  setDeploymentId: (id: string | null) => void
  deploymentStatus: DeploymentStatus | null

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

  // Incremental update tracking: set by updateField so PreviewCanvas can send
  // lightweight field-update messages instead of full data syncs.
  lastFieldUpdate: { sectionId: string; field: string; value: any; ts: number } | null

  // Field-level editability & constraints (derived from manifest on load)
  editabilityMap: Record<string, Record<string, boolean>>
  constraintsMap: Record<string, Record<string, FieldConstraints>>

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
  isViewOnly: boolean
  setViewOnly: (v: boolean) => void
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
  loadFromDeployment: (deployment: Deployment, template: Template) => void
  reset: () => void
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultSelection: Selection = {
  mode: null,
  sectionId: null,
  field: null,
  elementType: null,
  content: null,
  itemIndex: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Immutable deep-set using pre-split dot-notation path segments.
 * Spreads each level rather than cloning the full tree, keeping mutation O(depth).
 *
 * @example
 *   // Called via updateField('hero', 'cta.text', 'Book Now')
 *   setNested({ cta: { text: 'old' } }, ['cta', 'text'], 'Book Now')
 *   // → { cta: { text: 'Book Now' } }
 */
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

/**
 * Seed any sections that exist in the manifest but are missing from a saved sectionsRegistry.
 * This handles templates that gain new sections after a site was first saved.
 */
function seedSectionsRegistry(
  registry: Record<string, { enabled: boolean }>,
  manifest: any
): Record<string, { enabled: boolean }> {
  const result = { ...registry }
  for (const section of manifest?.sections ?? []) {
    if (!(section.id in result)) {
      result[section.id] = { enabled: section.enabled !== false }
    }
  }
  return result
}

/**
 * Seed any undefined/null fields in sectionData with manifest section defaults.
 * Also seeds entirely missing sections. Does NOT override empty strings or existing values.
 */
function seedManifestDefaults(
  sectionData: Record<string, any>,
  manifest: any
): Record<string, any> {
  const result = { ...sectionData }
  for (const section of manifest?.sections ?? []) {
    if (!section.data) continue
    if (!(section.id in result)) {
      // Entire section missing — use manifest defaults
      result[section.id] = section.data
    } else if (result[section.id] !== null && typeof result[section.id] === 'object' && !Array.isArray(result[section.id])) {
      // Section is an object — fill in any undefined/null fields
      const existing = result[section.id] as Record<string, any>
      const defaults = section.data as Record<string, any>
      const merged: Record<string, any> = { ...existing }
      for (const [key, defaultVal] of Object.entries(defaults)) {
        if (merged[key] === undefined || merged[key] === null) {
          merged[key] = defaultVal
        }
      }
      result[section.id] = merged
    }
  }
  return result
}

/**
 * Revoke all blob URLs and pending image blob URLs.
 * Each revocation is wrapped in try/catch so a bad URL string
 * never aborts cleanup of the remaining entries.
 */
function revokeAllBlobs(blobUrls: Record<string, string>, pendingImages: Record<string, PendingImage>) {
  for (const url of Object.values(blobUrls)) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url) } catch { /* non-fatal */ }
    }
  }
  for (const pending of Object.values(pendingImages)) {
    if (pending.blobUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(pending.blobUrl) } catch { /* non-fatal */ }
    }
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWizardStore = create<WizardStore>((set, get) => ({
  // Navigation
  currentStep: 1,
  setStep: (step) => set((s) => {
    if (step < 1 || step > 4) {
      console.warn(`[wizard] Invalid step: ${step}`)
      return s
    }
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

  // Deployment edit tracking
  deploymentId: null,
  setDeploymentId: (id) => set({ deploymentId: id }),
  deploymentStatus: null,

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
  isViewOnly: false,
  lastFieldUpdate: null,
  editabilityMap: {},
  constraintsMap: {},
  setViewOnly: (v) => set({ isViewOnly: v }),
  panelMode: 'layers',
  setPanelMode: (mode) => set({ panelMode: mode }),
  selectedCollectionItem: null,
  setSelectedCollectionItem: (sel) => set({ selectedCollectionItem: sel }),

  // Field update — supports deep dot notation (e.g. "cta.text", "structuredData.address.street")
  // Enforces constraints (maxLength, min/max) before writing to sectionData.
  updateField: (sectionId, field, value) =>
    set((s) => {
      // Apply constraints if present
      const constraints = s.constraintsMap[sectionId]?.[field]
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

      // Cleanup: if the new value is an array that's shorter than before, revoke blob URLs for removed items
      const oldValue = s.sectionData[sectionId]?.[field]
      if (Array.isArray(oldValue) && Array.isArray(constrained) && constrained.length < oldValue.length) {
        const removedItems = oldValue.slice(constrained.length)
        removedItems.forEach((item, index) => {
          const actualIndex = constrained.length + index
          const itemKey = `${sectionId}.${field}.${actualIndex}`
          
          // Revoke blob URL if it exists
          const blobUrl = s.blobUrls[itemKey]
          if (blobUrl && blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(blobUrl)
          }
          
          // Clean up dataUrls map
          if (blobUrl && s.dataUrls[blobUrl]) {
            const newDataUrls = { ...s.dataUrls }
            delete newDataUrls[blobUrl]
            s.dataUrls = newDataUrls
          }
          
          // Clean up blobUrls map
          if (blobUrl) {
            const newBlobUrls = { ...s.blobUrls }
            delete newBlobUrls[itemKey]
            s.blobUrls = newBlobUrls
          }
        })
      }

      const next = { ...s.sectionData }
      if (!next[sectionId]) next[sectionId] = {}
      const parts = field.split('.')
      next[sectionId] = setNested(next[sectionId] ?? {}, parts, constrained)
      return {
        sectionData: next,
        isDirty: true,
        lastFieldUpdate: { sectionId, field, value: constrained, ts: Date.now() },
      }
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
    const template = get().selectedTemplate
    const collectionData: Record<string, any[]> = {}
    for (const col of template?.manifest?.collections ?? []) {
      collectionData[col.id] = col.data ?? []
    }
    const { editabilityMap, constraintsMap } = buildFieldMaps(template?.manifest)
    set({
      sectionData: data,
      sectionsRegistry: sections,
      collectionData,
      editabilityMap,
      constraintsMap,
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

    const { editabilityMap, constraintsMap } = buildFieldMaps(template.manifest)
    set({
      sectionData,
      sectionsRegistry: sections,
      collectionData,
      editabilityMap,
      constraintsMap,
      currentStep: 3,
      isDirty: false,
    })
  },

  // Load from a deployed site and open for re-editing.
  // Prefers the live template manifest so schema changes (removed fields, new widgets)
  // propagate to existing sites automatically. Falls back to frozen snapshot only if
  // the template no longer exists.
  loadFromDeployment: (deployment, template) => {
    revokeAllBlobs(get().blobUrls, get().pendingImages)

    // Separate _sections from the rest of site_data to get sectionData + sectionsRegistry
    const { _sections, ...sectionData } = (deployment.site_data ?? {}) as Record<string, any>
    const sectionsRegistry = (_sections ?? {}) as Record<string, { enabled: boolean }>

    // Use live template manifest so the editor always reflects the current schema.
    // Fall back to frozen snapshot only when the template has been deleted.
    const manifest = template.manifest ?? deployment.template_manifest

    // Rebuild collectionData from the manifest
    const collectionData: Record<string, any[]> = {}
    for (const col of manifest?.collections ?? []) {
      collectionData[col.id] = col.data ?? []
    }

    const { editabilityMap, constraintsMap } = buildFieldMaps(manifest)
    set({
      deploymentId: deployment.id,
      deploymentStatus: deployment.status,
      draftId: null,
      projectName: deployment.project_name,
      selectedTemplate: { ...template, manifest },
      currentStep: 3,
      rawText: '',
      sectionData: seedManifestDefaults(sectionData, manifest),
      sectionsRegistry: seedSectionsRegistry(sectionsRegistry, manifest),
      collectionData,
      editabilityMap,
      constraintsMap,
      activePage: 'home',
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
      viewport: 'desktop',
      selection: defaultSelection,
      isViewOnly: false,
      panelMode: 'layers',
      selectedCollectionItem: null,
    })
  },

  // Load from a saved draft and resume editing (new-commission drafts only).
  loadFromDraft: (draft, template) => {
    // Revoke existing blob URLs
    revokeAllBlobs(get().blobUrls, get().pendingImages)

    const { editabilityMap, constraintsMap } = buildFieldMaps(template.manifest)
    set({
      draftId: draft.id,
      deploymentId: null,
      projectName: draft.project_name ?? '',
      selectedTemplate: template,
      currentStep: (draft.current_step as 1 | 2 | 3 | 4) ?? 3,
      rawText: draft.raw_text ?? '',
      sectionData: seedManifestDefaults(draft.section_data ?? {}, template.manifest),
      sectionsRegistry: seedSectionsRegistry(draft.sections_registry ?? {}, template.manifest),
      collectionData: draft.collection_data ?? {},
      editabilityMap,
      constraintsMap,
      activePage: draft.last_active_page ?? 'home',
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
      viewport: 'desktop',
      selection: defaultSelection,
      isViewOnly: false,
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
      deploymentId: null,
      deploymentStatus: null,
      rawText: '',
      sectionData: {},
      sectionsRegistry: {},
      collectionData: {},
      editabilityMap: {},
      constraintsMap: {},
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
      lastFieldUpdate: null,
      viewport: 'desktop',
      activePage: 'home',
      selection: defaultSelection,
      isViewOnly: false,
      panelMode: 'layers',
      selectedCollectionItem: null,
    })
  },
}))
