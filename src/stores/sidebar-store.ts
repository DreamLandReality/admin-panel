import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppStore {
    // Sidebar state
    sidebarCollapsed: boolean
    sidebarMobileOpen: boolean
    toggleSidebar: () => void
    closeMobile: () => void
    setMobileOpen: (open: boolean) => void
}

export const useStore = create<AppStore>()(
    persist(
        (set) => ({
            sidebarCollapsed: false,
            sidebarMobileOpen: false,
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
            closeMobile: () => set({ sidebarMobileOpen: false }),
            setMobileOpen: (open: boolean) => set({ sidebarMobileOpen: open }),
        }),
        {
            name: 'sidebar-state',
            partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
        }
    )
)
