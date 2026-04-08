'use client'

import { usePathname } from 'next/navigation'
import { useStore } from '@/stores/sidebar-store'
import { useHeaderStore } from '@/stores/header-store'
import { Menu } from 'lucide-react'
import { Heading } from '@/components/primitives'
import { Button } from '@/components/ui/button'

const ROUTE_LABELS: Record<string, { overline: string; title: string }> = {
    '/': { overline: 'WORKSPACE', title: 'Portfolio' },
    '/deployments/new': { overline: 'WORKSPACE', title: 'Conceptualization' },
    '/templates': { overline: 'WORKSPACE', title: 'Templates' },
    '/settings': { overline: 'WORKSPACE', title: 'Settings' },
    '/enquiry': { overline: 'WORKSPACE', title: 'Enquiries' },
}

function resolveBreadcrumb(pathname: string) {
    if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]

    // Quick dynamic routes evaluation
    if (pathname.startsWith('/deployments/') && !pathname.endsWith('/new')) {
        return { overline: 'WORKSPACE > PORTFOLIO', title: 'Deployment Details' }
    }
    if (pathname.startsWith('/templates/') && !pathname.endsWith('/new')) {
        return { overline: 'WORKSPACE > TEMPLATES', title: 'Template View' }
    }

    return { overline: 'WORKSPACE', title: 'Dashboard' }
}

export function Header() {
    const pathname = usePathname()
    const { overline, title } = resolveBreadcrumb(pathname)
    const { setMobileOpen } = useStore()
    const stats = useHeaderStore((s) => s.stats)
    const rightContent = useHeaderStore((s) => s.rightContent)

    return (
        <header className="min-h-28 px-10 py-6 flex items-center justify-between shrink-0 bg-background z-10 w-full relative">
            <div className="flex items-center">
                {/* Mobile Hamburger Trigger */}
                <Button
                    variant="icon"
                    className="mr-2 md:hidden h-8 w-8"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation menu"
                >
                    <Menu size={20} />
                </Button>

                {/* Breadcrumbs */}
                <div key={pathname} className="flex flex-col justify-center gap-1.5 animate-fade-in">
                    <span className="font-sans text-overline text-foreground-muted whitespace-nowrap max-w-[400px] text-ellipsis overflow-hidden" title={overline}>
                        {overline}
                    </span>
                    <Heading variant="display">
                        {title}
                    </Heading>
                </div>
            </div>

            {/* Right-side: stats + optional action */}
            {(stats.length > 0 || rightContent) && (
                <div className="hidden sm:flex items-center gap-8 lg:gap-10">
                    {rightContent}
                    {stats.map((stat) => (
                        <div key={stat.label} className="text-center min-w-[52px]">
                            <Heading variant="stat" className={stat.colorClass ?? 'text-foreground'}>
                                {stat.value}
                            </Heading>
                            <p className="mt-1.5 text-micro font-bold uppercase tracking-label text-foreground-muted">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </header>
    )
}
