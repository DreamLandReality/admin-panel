'use client'

import { useStore } from '@/stores/sidebar-store'
import { useAiProviderStore, type AiProvider } from '@/stores/ai-provider-store'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    PlusCircle,
    Layers,
    MessageSquare,
    Building2,
    ChevronLeft,
    ChevronRight,
    Sun,
    Moon,
    LogOut,
    Archive,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { Heading } from '@/components/primitives'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Sites', href: '/', match: 'exact', group: 'workspace' },
    { icon: PlusCircle, label: 'New Commission', href: '/deployments/new', match: 'exact', group: 'workspace' },
    { icon: Layers, label: 'Templates', href: '/templates', match: 'startsWith', group: 'workspace' },
    { icon: Archive, label: 'Archived', href: '/archived', match: 'startsWith', group: 'workspace' },
    { icon: MessageSquare, label: 'Enquiry', href: '/enquiry', match: 'startsWith', group: 'system' },
]

function isActive(item: typeof NAV_ITEMS[0], pathname: string): boolean {
    if (item.match === 'exact') return pathname === item.href
    return pathname.startsWith(item.href)
}

function NavItem({ item, active, isCollapsed, badge }: { item: typeof NAV_ITEMS[0]; active: boolean; isCollapsed: boolean; badge?: number }) {
    return (
        <div className="relative group/nav px-3 my-0.5 z-10">
            <Link
                href={item.href}
                className={cn(
                    'group flex items-center gap-4 h-11 px-3 rounded-lg transition-all duration-500 ease-out border border-transparent',
                    active
                        ? 'bg-surface-active text-foreground border-border-hover'
                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                )}
            >
                {active && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-indicator bg-foreground dark:bg-white rounded-r-full shadow-nav-indicator" />
                )}
                <div className={cn(
                    "relative flex w-6 items-center justify-center shrink-0 transition-transform duration-500 ease-out",
                    active ? "scale-105" : "group-hover:scale-105 text-foreground-muted dark:text-white/40 group-hover:text-foreground/70 dark:group-hover:text-white/70"
                )}>
                    <item.icon size={17} strokeWidth={active ? 1.75 : 1.5} />
                    {/* Collapsed badge dot */}
                    {isCollapsed && !!badge && badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-foreground dark:bg-white" />
                    )}
                </div>
                <span
                    className={cn(
                        'text-body-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300 flex-1',
                        isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100',
                        active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/90"
                    )}
                >
                    {item.label}
                </span>
                {/* Expanded badge count */}
                {!isCollapsed && !!badge && badge > 0 && (
                    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-foreground dark:bg-white text-background dark:text-black text-[10px] font-bold leading-none px-1">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </Link>
            {isCollapsed && (
                <div className="invisible opacity-0 group-hover/nav:visible group-hover/nav:opacity-100 absolute left-full ml-1 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-foreground border border-border-hover text-background text-label-lg font-medium tracking-widest uppercase rounded-lg shadow-2xl whitespace-nowrap pointer-events-none transition-all duration-200 z-50">
                    {item.label}{!!badge && badge > 0 ? ` (${badge})` : ''}
                </div>
            )}
        </div>
    )
}

// Provider display config
const PROVIDER_CONFIG: Record<AiProvider, { label: string; shortLabel: string; dotClass: string }> = {
    claude: {
        label: 'Claude',
        shortLabel: 'C',
        dotClass: 'bg-foreground dark:bg-white',
    },
    gemini: {
        label: 'Gemini',
        shortLabel: 'G',
        dotClass: 'bg-blue-500 dark:bg-blue-400',
    },
}

export function Sidebar() {
    const { sidebarCollapsed, sidebarMobileOpen, toggleSidebar, closeMobile } = useStore()
    const { provider, setProvider } = useAiProviderStore()
    const pathname = usePathname()
    const { theme, setTheme } = useTheme()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [mounted, setMounted] = useState(false)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [configuredProviders, setConfiguredProviders] = useState<Set<AiProvider>>(new Set())
    const [unreadEnquiries, setUnreadEnquiries] = useState(0)

    useEffect(() => {
        setMounted(true)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) setUserEmail(user.email)
        })
        fetch('/api/config')
            .then((r) => r.json())
            .then((config) => {
                const providers = new Set<AiProvider>()
                if (config.isAiConfigured) providers.add('claude')
                if (config.isGeminiConfigured) providers.add('gemini')
                setConfiguredProviders(providers)
                // If stored provider isn't available, fall back to one that is
                if (providers.size > 0 && !providers.has(provider)) {
                    setProvider(Array.from(providers)[0])
                }
            })
            .catch(() => { })
        fetch('/api/enquiries')
            .then((r) => r.json())
            .then((json) => { if (typeof json.unreadCount === 'number') setUnreadEnquiries(json.unreadCount) })
            .catch(() => { })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault()
                toggleSidebar()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleSidebar])

    // Cycle to next configured provider; no-op if only one is available
    function cycleProvider() {
        const available = Array.from(configuredProviders)
        if (available.length < 2) return
        const next = available[(available.indexOf(provider) + 1) % available.length]
        setProvider(next)
    }

    const isAnyAiConfigured = configuredProviders.size > 0
    const canToggle = configuredProviders.size > 1
    // Display the stored provider only if its key is actually configured.
    // Falls back to the first configured provider so we never show a label
    // for a provider whose API key is missing.
    const effectiveProvider = configuredProviders.has(provider)
        ? provider
        : (Array.from(configuredProviders)[0] ?? provider)
    const pConfig = PROVIDER_CONFIG[effectiveProvider as AiProvider]

    return (
        <>
            {/* Mobile Backdrop */}
            {sidebarMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 dark:bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={closeMobile}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={cn(
                    'z-50 bg-background border-r border-border transition-all duration-500 ease-sidebar flex flex-col h-screen shrink-0',
                    'fixed inset-y-0 left-0 md:relative md:inset-auto',
                    !mounted && 'opacity-0',
                    sidebarCollapsed ? 'w-sidebar-sm' : 'w-70',
                    sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                )}
            >
                {/* Logo Area */}
                <Link href="/" className="flex items-center h-[96px] mb-4 border-b border-border px-5 group overflow-hidden" onClick={closeMobile}>
                    <div className="flex w-9 h-9 items-center justify-center shrink-0 border border-border-subtle bg-surface-hover rounded-lg transition-transform duration-500 group-hover:scale-105 group-hover:bg-surface-active group-hover:border-border-hover">
                        {sidebarCollapsed ? (
                            <div className="text-foreground font-serif text-sm font-semibold tracking-wider">DR</div>
                        ) : (
                            <Building2 size={16} strokeWidth={1.5} className="text-foreground/80" />
                        )}
                    </div>

                    <div className={cn(
                        "ml-4 flex flex-col justify-center whitespace-nowrap transition-all duration-500",
                        sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden ml-0' : 'w-auto opacity-100'
                    )}>
                        <Heading variant="logo" as="span">Dream Land Reality</Heading>
                        <div className="text-micro font-medium uppercase tracking-label-lg text-foreground-muted dark:text-white/30 mt-0.5">Architecture Suite</div>
                    </div>
                </Link>

                {/* Navigation */}
                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 subtle-scrollbar">
                    <div className={cn("px-7 mb-2 mt-4 transition-all duration-300", sidebarCollapsed ? "opacity-0 h-0 hidden" : "opacity-100 h-auto block")}>
                        <span className="text-micro font-medium uppercase tracking-label-lg text-foreground-muted dark:text-white/30">Workspace</span>
                    </div>

                    {NAV_ITEMS.filter(i => i.group === 'workspace').map((item) => (
                        <div key={item.href} onClick={closeMobile}><NavItem item={item} active={isActive(item, pathname)} isCollapsed={sidebarCollapsed} /></div>
                    ))}

                    <div className="my-6 border-t border-border dark:border-white/[0.04] mx-4" />

                    <div className={cn("px-7 mb-2 mt-2 transition-all duration-300", sidebarCollapsed ? "opacity-0 h-0 hidden" : "opacity-100 h-auto block")}>
                        <span className="text-micro font-medium uppercase tracking-label-lg text-foreground-muted dark:text-white/30">System</span>
                    </div>
                    {NAV_ITEMS.filter(i => i.group === 'system').map((item) => (
                        <div key={item.href} onClick={closeMobile}>
                            <NavItem
                                item={item}
                                active={isActive(item, pathname)}
                                isCollapsed={sidebarCollapsed}
                                badge={item.href === '/enquiry' ? unreadEnquiries : undefined}
                            />
                        </div>
                    ))}

                    <div className="flex-1" />

                    <div className="mt-8 mb-4 border-t border-border dark:border-white/[0.04] mx-4" />

                    {/* Bottom Actions */}
                    <div className={cn("px-4 mb-3 flex flex-col gap-3 transition-all", sidebarCollapsed ? "items-center" : "items-stretch")}>

                        {/* Top Utility Row */}
                        <div className={cn("flex gap-2 w-full", sidebarCollapsed ? "flex-col" : "flex-row items-center")}>

                            {/* AI Provider Pill */}
                            <div className="relative group/pill flex-1">
                                <button
                                    onClick={cycleProvider}
                                    disabled={!canToggle}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 rounded-lg border bg-surface-hover shadow-sm transition-all overflow-hidden relative",
                                        sidebarCollapsed ? "justify-center p-0 w-9 h-9 shrink-0" : "px-3 h-9",
                                        canToggle
                                            ? "border-border-subtle cursor-pointer hover:bg-surface-active hover:border-border-hover"
                                            : "border-border-subtle cursor-default"
                                    )}
                                    aria-label={canToggle ? `Switch AI provider (currently ${pConfig.label})` : `${isAnyAiConfigured ? pConfig.label : 'AI'} active`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/[0.02] dark:from-white/[0.02] to-transparent pointer-events-none" />

                                    {/* Status dot */}
                                    <div className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                                        {isAnyAiConfigured && (
                                            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-40", pConfig.dotClass)} />
                                        )}
                                        <span className={cn(
                                            "relative inline-flex h-1.5 w-1.5 rounded-full",
                                            isAnyAiConfigured ? pConfig.dotClass : "bg-foreground/20 dark:bg-white/20"
                                        )} />
                                    </div>

                                    {/* Label */}
                                    {!sidebarCollapsed && (
                                        <span className="text-label font-medium uppercase tracking-label-sm text-foreground-muted dark:text-white/60 whitespace-nowrap flex-1 text-left">
                                            {isAnyAiConfigured ? pConfig.label : 'AI'} Active
                                        </span>
                                    )}

                                    {/* Chevron arrow when toggleable */}
                                    {canToggle && !sidebarCollapsed && (
                                        <ChevronRight size={11} strokeWidth={2} className="shrink-0 text-foreground-muted/40 dark:text-white/25" />
                                    )}

                                    {/* Collapsed: provider initial overlay */}
                                    {sidebarCollapsed && isAnyAiConfigured && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground-muted dark:text-white/50 tracking-wide">
                                            {pConfig.shortLabel}
                                        </span>
                                    )}
                                </button>

                                {/* Collapsed tooltip */}
                                {sidebarCollapsed && (
                                    <div className="invisible opacity-0 group-hover/pill:visible group-hover/pill:opacity-100 absolute left-full ml-1 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-foreground dark:bg-black border border-black/10 dark:border-white/[0.08] text-white text-label-lg font-medium tracking-widest uppercase rounded-lg shadow-2xl whitespace-nowrap pointer-events-none transition-all duration-200 z-50">
                                        {isAnyAiConfigured ? `${pConfig.label} Active` : 'AI Inactive'}
                                        {canToggle && ' · click to switch'}
                                    </div>
                                )}
                            </div>

                            {/* Theme Toggle */}
                            <Button
                                variant="icon"
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={sidebarCollapsed ? '' : 'w-10'}
                                aria-label="Switch to dark/light mode"
                            >
                                {mounted && (
                                    <div className="relative w-4 h-4">
                                        <Sun className="absolute inset-0 h-4 w-4 rotate-0 scale-100 transition-all duration-500 ease-out dark:-rotate-90 dark:scale-0" strokeWidth={1.5} />
                                        <Moon className="absolute inset-0 h-4 w-4 rotate-90 scale-0 transition-all duration-500 ease-out dark:rotate-0 dark:scale-100" strokeWidth={1.5} />
                                    </div>
                                )}
                            </Button>
                        </div>

                        {/* User Profile Block */}
                        <div className={cn("flex flex-col gap-2 w-full", sidebarCollapsed && "items-center")}>

                            {/* Profile Info */}
                            <div className={cn(
                                "flex items-center transition-all duration-300",
                                sidebarCollapsed ? "justify-center p-0" : "gap-3 px-2 py-1.5 rounded-lg border border-transparent hover:bg-surface-hover"
                            )}>
                                <div className="w-9 h-9 rounded-lg bg-surface-hover text-foreground/80 font-sans text-label-lg font-medium uppercase tracking-widest flex items-center justify-center shrink-0 border border-border-subtle">
                                    {userEmail ? userEmail.split('@')[0].slice(0, 2).toUpperCase() : '??'}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-body-sm font-medium text-foreground dark:text-white tracking-wide truncate">{userEmail?.split('@')[0] ?? 'User'}</span>
                                        <span className="text-label text-foreground-muted dark:text-white/40 tracking-wider truncate mt-0.5">{userEmail ?? ''}</span>
                                    </div>
                                )}
                            </div>

                            {/* Logout */}
                            <button
                                onClick={handleSignOut}
                                className={cn(
                                    "h-9 w-full rounded-lg flex items-center text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border-hover hover:bg-surface-hover",
                                    sidebarCollapsed ? "justify-center w-9 shrink-0" : "px-3"
                                )}
                            >
                                <LogOut size={16} strokeWidth={1.5} className="shrink-0" />
                                {!sidebarCollapsed && <span className="text-label-lg font-medium uppercase tracking-label-xs ml-2.5 truncate">Log Out</span>}
                            </button>
                        </div>
                    </div>

                    <div className="my-1 border-t border-border dark:border-white/[0.04] mx-4" />

                    {/* Collapse Toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="group flex items-center justify-between h-10 px-4 mx-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-300 cursor-pointer mb-2 border border-transparent hover:border-border-subtle"
                    >
                        <div className="flex w-6 items-center justify-center shrink-0">
                            <ChevronLeft size={16} strokeWidth={1.5} className={cn("transition-transform duration-500", sidebarCollapsed ? "rotate-180 text-foreground-muted/70 dark:text-white/50" : "rotate-0 text-foreground-muted/50 dark:text-white/30 group-hover:text-foreground-muted dark:group-hover:text-white/60")} />
                        </div>
                    </button>
                </div>
            </aside>
        </>
    )
}
