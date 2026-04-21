import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AiProvider = 'claude' | 'gemini'

interface AiProviderStore {
  provider: AiProvider
  setProvider: (p: AiProvider) => void
}

export const useAiProviderStore = create<AiProviderStore>()(
  persist(
    (set) => ({
      provider: 'gemini',
      setProvider: (provider) => set({ provider }),
    }),
    {
      name: 'ai-provider',
      partialize: (state) => ({ provider: state.provider }),
    }
  )
)
