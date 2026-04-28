import { create } from 'zustand'
import type { FieldConstraints } from '@/types'
import type { LastFieldUpdate } from './store-types'

interface DeployStore {
  lastFieldUpdate: LastFieldUpdate | null
  editabilityMap: Record<string, Record<string, boolean>>
  constraintsMap: Record<string, Record<string, FieldConstraints>>
  setLastFieldUpdate: (update: LastFieldUpdate | null) => void
  setFieldMaps: (maps: {
    editabilityMap: Record<string, Record<string, boolean>>
    constraintsMap: Record<string, Record<string, FieldConstraints>>
  }) => void
  resetDeployState: () => void
}

export const useDeployStore = create<DeployStore>((set) => ({
  lastFieldUpdate: null,
  editabilityMap: {},
  constraintsMap: {},
  setLastFieldUpdate: (update) => set({ lastFieldUpdate: update }),
  setFieldMaps: ({ editabilityMap, constraintsMap }) => set({ editabilityMap, constraintsMap }),
  resetDeployState: () => set({ lastFieldUpdate: null, editabilityMap: {}, constraintsMap: {} }),
}))
