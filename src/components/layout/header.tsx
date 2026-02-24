'use client'

import { usePathname } from 'next/navigation'
import { useStore } from '@/stores/sidebar-store'
import { useHeaderStore } from '@/stores/header-store'
import { Menu } from 'lucide-react'

const ROUTE_LABELS: Record<string, { overline: string; title: string }> = {
    '/': { overline: 'WORKSPACE', title: 'Portfolio' },
    '/deployments/new': { overline: 'WORKSPACE', title: 'Conceptualization' },
    '/templates': { overline: 'WORKSPACE', title: 'Templates' },
    '/settings': { overline: 'WORKSPACE', title: 'Settings' },
}

function resolveBreadcrumb(pathname: string) {
    if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]

    // Quick dynamic routes evaluation
    if (pathname.startsWith('/deployments/') && !pathname.endsWith('/new')) {
        // if edit, shell isn't active anyway
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
        <header className="min-h-[7rem] px-10 py-6 flex items-center justify-between shrink-0 bg-background z-10 w-full relative">
            <div className="flex items-center">
                {/* Mobile Hamburger Trigger */}
                <button
                    className="mr-2 md:hidden h-8 w-8 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground transition-colors"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation menu"
                >
                    <Menu size={20} />
                </button>

                {/* Breadcrumbs */}
                <div key={pathname} className="flex flex-col justify-center gap-1.5 animate-fade-in">
                    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-foreground-muted whitespace-nowrap max-w-[400px] text-ellipsis overflow-hidden">
                        {overline}
                    </span>
                    <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground">
                        {title}
                    </h1>
                </div>
            </div>

            {/* Right-side content — custom or stats fallback */}
            {rightContent ? (
                <div className="hidden sm:flex items-center gap-8 lg:gap-10">
                    {rightContent}
                </div>
            ) : stats.length > 0 ? (
                <div className="hidden sm:flex items-center gap-8 lg:gap-10">
                    {stats.map((stat) => (
                        <div key={stat.label} className="text-center min-w-[52px]">
                            <p className={`font-serif text-3xl font-light tabular-nums leading-none ${stat.colorClass ?? 'text-foreground'}`}>
                                {stat.value}
                            </p>
                            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-foreground-muted">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}
        </header>
    )
}
