import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileGate } from '@/components/layout/mobile-gate'
import { ThemedToaster } from '@/components/themed-toaster'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <MobileGate>
            <div className="flex h-screen overflow-hidden bg-background w-full">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden relative">
                    <Header />
                    <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10 focus:outline-none">
                        {children}
                    </main>
                </div>
            </div>
            <ThemedToaster />
        </MobileGate>
    )
}
