import { create } from 'zustand'
import type { StatItemData } from '@/types'

export type HeaderRightContent =
    | { kind: 'none' }
    | { kind: 'page-action'; href: string; label: string }
    | { kind: 'step-counter'; currentStep: number; totalSteps: number; label: string }

interface HeaderState {
    stats: StatItemData[]
    setStats: (stats: StatItemData[]) => void
    clearStats: () => void

    headerRight: HeaderRightContent
    setHeaderAction: (action: { href: string; label: string }) => void
    setHeaderStepCounter: (counter: { currentStep: number; totalSteps: number; label: string }) => void
    clearHeaderRight: () => void
}

export const useHeaderStore = create<HeaderState>((set) => ({
    stats: [],
    setStats: (stats) => set({ stats }),
    clearStats: () => set({ stats: [] }),

    headerRight: { kind: 'none' },
    setHeaderAction: ({ href, label }) => set({ headerRight: { kind: 'page-action', href, label } }),
    setHeaderStepCounter: ({ currentStep, totalSteps, label }) => {
        set({ headerRight: { kind: 'step-counter', currentStep, totalSteps, label } })
    },
    clearHeaderRight: () => set({ headerRight: { kind: 'none' } }),
}))
