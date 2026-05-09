'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/stores/sidebar-store'
import { useHeaderStore, type HeaderRightContent as HeaderRightContentData } from '@/stores/header-store'
import { MenuIcon } from '@/components/icons'
import { Heading } from '@/components/primitives'
import { Button } from '@/components/ui/button'

const ROUTE_LABELS: Record<string, { overline: string; title: string }> = {
    '/': { overline: 'WORKSPACE', title: 'Portfolio' },
    '/deployments/new': { overline: 'WORKSPACE', title: 'Conceptualization' },
    '/templates': { overline: 'WORKSPACE', title: 'Templates' },
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

function HeaderRightContent({ content }: { content: HeaderRightContentData }) {
    if (content.kind === 'none') return null

    if (content.kind === 'page-action') {
        return (
            <Link href={content.href} className="group text-center min-w-[52px]">
                <p className="font-primary text-3xl font-light leading-none text-foreground-muted group-hover:text-foreground transition-colors duration-200">
                    +
                </p>
                <p className="mt-1.5 text-micro font-bold uppercase tracking-label text-foreground-muted">
                    {content.label}
                </p>
            </Link>
        )
    }

    return (
        <div className="text-center min-w-[52px]">
            <p className="font-primary text-3xl font-light tabular-nums leading-none text-foreground">
                {content.currentStep}<span className="text-foreground-muted">/{content.totalSteps}</span>
            </p>
            <p className="mt-1.5 text-micro font-bold uppercase tracking-label text-foreground-muted">
                {content.label}
            </p>
        </div>
    )
}

export function Header() {
    const pathname = usePathname()
    const { overline, title } = resolveBreadcrumb(pathname)
    const { setMobileOpen } = useStore()
    const stats = useHeaderStore((s) => s.stats)
    const headerRight = useHeaderStore((s) => s.headerRight)
    const hasHeaderRight = headerRight.kind !== 'none'

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
                    <MenuIcon width={20} height={20} />
                </Button>

                {/* Breadcrumbs */}
                <div key={pathname} className="flex flex-col justify-center gap-1.5 animate-fade-in">
                    <span className="font-primary text-overline text-foreground-muted whitespace-nowrap max-w-[400px] text-ellipsis overflow-hidden" title={overline}>
                        {overline}
                    </span>
                    <Heading variant="display">
                        {title}
                    </Heading>
                </div>
            </div>

            {/* Right-side: stats + optional action */}
            {(stats.length > 0 || hasHeaderRight) && (
                <div className="hidden sm:flex items-center gap-8 lg:gap-10">
                    <HeaderRightContent content={headerRight} />
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
