import { create } from 'zustand'

interface DeployTransitionStore {
  isTransitioning: boolean
  setTransitioning: (v: boolean) => void
}

export const useDeployTransitionStore = create<DeployTransitionStore>((set) => ({
  isTransitioning: false,
  setTransitioning: (isTransitioning) => set({ isTransitioning }),
}))
