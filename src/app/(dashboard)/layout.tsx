import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background w-full">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden relative">
                <Header />
                <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-10 focus:outline-none">
                    {children}
                </main>
            </div>
        </div>
    )
}
