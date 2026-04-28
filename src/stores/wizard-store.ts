import { create } from 'zustand'
import type { Deployment, DeploymentStatus, Draft, SectionRegistry, Template } from '@/types'
import { buildFieldMaps } from '@/lib/utils/build-field-maps'
import { getManifestDefaultPageId, seedSectionDataFromManifest } from '@/lib/utils/manifest-contract'
import { useDeployStore } from './deploy-store'
import { useEditorStore } from './editor-store'
import { useUiStore } from './ui-store'
import {
  buildCollectionData,
  buildSectionsRegistry,
  migrateLegacyCollectionReferences,
  seedMissingSectionData,
  seedSectionsRegistry,
} from './store-helpers'
import type { WizardStep } from './store-types'

interface WizardStore {
  currentStep: WizardStep
  selectedTemplate: Template | null
  projectName: string
  draftId: string | null
  deploymentId: string | null
  deploymentStatus: DeploymentStatus | null
  rawText: string
  setStep: (step: WizardStep) => void
  selectTemplate: (template: Template) => void
  setProjectName: (name: string) => void
  setDraftId: (id: string | null) => void
  setDeploymentId: (id: string | null) => void
  setRawText: (text: string) => void
  loadParseResult: (data: Record<string, any>, sections: Record<string, SectionRegistry>) => void
  loadManualDefaults: (template: Template) => void
  loadFromDraft: (draft: Draft, template: Template) => void
  loadFromDeployment: (deployment: Deployment, template: Template) => void
  reset: () => void
}

function setFieldMaps(manifest: any) {
  const { editabilityMap, constraintsMap } = buildFieldMaps(manifest)
  useDeployStore.getState().setFieldMaps({ editabilityMap, constraintsMap })
}

function resetSupportingStores() {
  useEditorStore.getState().resetEditorState()
  useUiStore.getState().resetUiState()
  useDeployStore.getState().resetDeployState()
}

export const useWizardStore = create<WizardStore>((set, get) => ({
  currentStep: 1,
  selectedTemplate: null,
  projectName: '',
  draftId: null,
  deploymentId: null,
  deploymentStatus: null,
  rawText: '',

  setStep: (step) => set((state) => {
    if (step < 1 || step > 4) {
      console.warn(`[wizard] Invalid step: ${step}`)
      return state
    }
    if (step === 1) {
      return { currentStep: 1, selectedTemplate: null }
    }
    return { currentStep: step }
  }),

  selectTemplate: (template) => set({ selectedTemplate: template }),
  setProjectName: (name) => set({ projectName: name }),
  setDraftId: (id) => set({ draftId: id }),
  setDeploymentId: (id) => set({ deploymentId: id }),
  setRawText: (text) => set({ rawText: text }),

  loadParseResult: (data, sections) => {
    const template = get().selectedTemplate
    const manifest = template?.manifest
    setFieldMaps(manifest)
    useEditorStore.getState().setEditorState({
      sectionData: seedSectionDataFromManifest(data, manifest),
      sectionsRegistry: seedSectionsRegistry(sections, manifest),
      collectionData: buildCollectionData(manifest),
      isDirty: false,
    })
    useUiStore.getState().setActivePage(getManifestDefaultPageId(manifest))
    set({ currentStep: 3 })
  },

  loadManualDefaults: (template) => {
    const manifest = template.manifest
    const collectionData = buildCollectionData(manifest)
    const sectionData = { ...((template.default_data as Record<string, Record<string, any>>) ?? {}) }
    migrateLegacyCollectionReferences(sectionData, collectionData, manifest)
    seedMissingSectionData(sectionData, manifest)
    setFieldMaps(manifest)
    useEditorStore.getState().setEditorState({
      sectionData: seedSectionDataFromManifest(sectionData, manifest),
      sectionsRegistry: buildSectionsRegistry(manifest),
      collectionData,
      isDirty: false,
    })
    useUiStore.getState().setActivePage(getManifestDefaultPageId(manifest))
    set({ selectedTemplate: template, currentStep: 3 })
  },

  loadFromDeployment: (deployment, template) => {
    useEditorStore.getState().revokeCurrentBlobs()
    const { _sections, ...sectionData } = (deployment.site_data ?? {}) as Record<string, any>
    const sectionsRegistry = (_sections ?? {}) as Record<string, SectionRegistry>
    const manifest = template.manifest ?? deployment.template_manifest
    setFieldMaps(manifest)
    useEditorStore.getState().setEditorState({
      sectionData: seedSectionDataFromManifest(sectionData, manifest),
      sectionsRegistry: seedSectionsRegistry(sectionsRegistry, manifest),
      collectionData: buildCollectionData(manifest),
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
    })
    useUiStore.getState().resetUiState()
    useUiStore.getState().setActivePage(getManifestDefaultPageId(manifest))
    set({
      deploymentId: deployment.id,
      deploymentStatus: deployment.status,
      draftId: null,
      projectName: deployment.project_name,
      selectedTemplate: { ...template, manifest },
      currentStep: 3,
      rawText: '',
    })
  },

  loadFromDraft: (draft, template) => {
    useEditorStore.getState().revokeCurrentBlobs()
    const manifest = template.manifest
    setFieldMaps(manifest)
    useEditorStore.getState().setEditorState({
      sectionData: seedSectionDataFromManifest(draft.section_data ?? {}, manifest),
      sectionsRegistry: seedSectionsRegistry(draft.sections_registry ?? {}, manifest),
      collectionData: draft.collection_data ?? {},
      blobUrls: {},
      dataUrls: {},
      pendingImages: {},
      isDirty: false,
    })
    useUiStore.getState().resetUiState()
    useUiStore.getState().setActivePage(draft.last_active_page ?? getManifestDefaultPageId(manifest))
    set({
      draftId: draft.id,
      deploymentId: null,
      deploymentStatus: null,
      projectName: draft.project_name ?? '',
      selectedTemplate: template,
      currentStep: (draft.current_step as WizardStep) ?? 3,
      rawText: draft.raw_text ?? '',
    })
  },

  reset: () => {
    resetSupportingStores()
    set({
      currentStep: 1,
      selectedTemplate: null,
      projectName: '',
      draftId: null,
      deploymentId: null,
      deploymentStatus: null,
      rawText: '',
    })
  },
}))
