import { create } from 'zustand'
import type { StatItemData } from '@/types'

interface HeaderState {
    stats: StatItemData[]
    setStats: (stats: StatItemData[]) => void
    clearStats: () => void

    // Generic right-side content
    rightContent: React.ReactNode | null
    setRightContent: (content: React.ReactNode) => void
    clearRightContent: () => void
}

export const useHeaderStore = create<HeaderState>((set) => ({
    stats: [],
    setStats: (stats) => set({ stats }),
    clearStats: () => set({ stats: [] }),

    rightContent: null,
    setRightContent: (content) => set({ rightContent: content }),
    clearRightContent: () => set({ rightContent: null }),
}))
