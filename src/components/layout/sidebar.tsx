'use client'

import { useStore } from '@/stores/sidebar-store'
import { useAiProviderStore, type AiProvider } from '@/stores/ai-provider-store'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    ChevronLeftIcon,
    LogOutIcon,
    MoonIcon,
    SunIcon,
    ChevronRightIcon,
} from '@/components/icons'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useConfigQuery } from '@/hooks/queries/use-config-query'
import { useEnquirySummaryQuery } from '@/hooks/queries/use-enquiry-summary-query'
import type { UserRole } from '@/lib/auth/roles'
import { getNavItemsForRole, NavItem, isActive } from './nav-item'
import { PROVIDER_CONFIG } from './provider-config'

export function Sidebar({ role }: { role: UserRole | null }) {
    const { sidebarCollapsed, sidebarMobileOpen, toggleSidebar, closeMobile } = useStore()
    const { provider, setProvider } = useAiProviderStore()
    const pathname = usePathname()
    const { theme, setTheme } = useTheme()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [mounted, setMounted] = useState(false)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const appConfigQuery = useConfigQuery()
    const enquirySummaryQuery = useEnquirySummaryQuery()
    const navItems = useMemo(() => getNavItemsForRole(role), [role])
    const configuredProviders = useMemo(() => {
        const providers = new Set<AiProvider>()
        const config = appConfigQuery.data
        if (config?.isAiConfigured) providers.add('claude')
        if (config?.isGeminiConfigured) providers.add('gemini')
        return providers
    }, [appConfigQuery.data])
    const newEnquiries = enquirySummaryQuery.data?.newLeadCount ?? 0

    useEffect(() => {
        setMounted(true)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) setUserEmail(user.email)
        })
    }, [supabase])

    useEffect(() => {
        if (configuredProviders.size === 0 || configuredProviders.has(provider)) return
        setProvider(Array.from(configuredProviders)[0])
    }, [configuredProviders, provider, setProvider])

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
                <Link href="/" className="flex items-center h-20 border-b border-border/80 px-4 group overflow-hidden" onClick={closeMobile}>
                    <div className="flex w-10 h-10 items-center justify-center shrink-0 border border-border bg-surface-hover rounded-lg transition-colors duration-150 group-hover:bg-surface-active group-hover:border-border-hover">
                        <span className="text-foreground font-primary text-sm font-semibold tracking-wider">DR</span>
                    </div>

                    <div className={cn(
                        "ml-3 flex items-center whitespace-nowrap transition-all duration-200",
                        sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden ml-0' : 'w-auto opacity-100'
                    )}>
                        <span className="font-primary text-[18px] leading-none text-foreground tracking-tight">
                            Dream Land Reality
                        </span>
                    </div>
                </Link>

                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-5 pb-3 subtle-scrollbar">
                    {navItems.map((item) => (
                        <div key={item.href} onClick={closeMobile}>
                            <NavItem
                                item={item}
                                active={isActive(item, pathname)}
                                isCollapsed={sidebarCollapsed}
                                badge={item.href === '/enquiry' ? newEnquiries : undefined}
                            />
                        </div>
                    ))}

                    <div className="flex-1" />

                    <div className={cn("px-3 mt-8 mb-3 transition-all", sidebarCollapsed ? "space-y-2" : "space-y-3")}>
                        {sidebarCollapsed ? (
                            <>
                                <button
                                    onClick={cycleProvider}
                                    disabled={!canToggle}
                                    className="relative h-10 w-10 rounded-lg border border-border bg-surface-hover text-foreground-muted hover:text-foreground hover:bg-surface-active transition-colors flex items-center justify-center"
                                    aria-label={canToggle ? `Switch AI provider (currently ${pConfig.label})` : `${isAnyAiConfigured ? pConfig.label : 'AI'} active`}
                                >
                                    <span className={cn("h-2 w-2 rounded-full", isAnyAiConfigured ? pConfig.dotClass : "bg-foreground/20")} />
                                    {isAnyAiConfigured && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                                            {pConfig.shortLabel}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                    className="h-10 w-10 rounded-lg border border-border bg-surface-hover text-foreground-muted hover:text-foreground hover:bg-surface-active transition-colors flex items-center justify-center"
                                    aria-label="Switch color theme"
                                >
                                    {mounted && (theme === 'dark'
                                        ? <SunIcon width={15} height={15} strokeWidth={1.6} />
                                        : <MoonIcon width={15} height={15} strokeWidth={1.6} />
                                    )}
                                </button>
                                <button
                                    onClick={handleSignOut}
                                    className="h-10 w-10 rounded-lg border border-border bg-surface-hover text-foreground-muted hover:text-foreground hover:bg-surface-active transition-colors flex items-center justify-center"
                                    aria-label="Log out"
                                >
                                    <LogOutIcon width={15} height={15} strokeWidth={1.6} />
                                </button>
                            </>
                        ) : (
                            <div className="rounded-lg border border-border bg-surface/55 p-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-lg bg-background text-foreground/80 font-primary text-[11px] font-semibold uppercase tracking-widest flex items-center justify-center shrink-0 border border-border">
                                        {userEmail ? userEmail.split('@')[0].slice(0, 2).toUpperCase() : '??'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-medium text-foreground truncate">{userEmail?.split('@')[0] ?? 'User'}</p>
                                        <p className="text-[10px] text-foreground-muted truncate mt-0.5">{userEmail ?? ''}</p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="h-8 w-8 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors flex items-center justify-center shrink-0"
                                        aria-label="Log out"
                                    >
                                        <LogOutIcon width={14} height={14} strokeWidth={1.6} />
                                    </button>
                                </div>

                                <div className="mt-3 grid grid-cols-[1fr_36px] gap-2">
                                    <button
                                        onClick={cycleProvider}
                                        disabled={!canToggle}
                                        className={cn(
                                            "h-9 rounded-lg border border-border bg-background px-3 flex items-center gap-2 text-left transition-colors",
                                            canToggle ? "hover:bg-surface-hover hover:border-border-hover" : "cursor-default"
                                        )}
                                        aria-label={canToggle ? `Switch AI provider (currently ${pConfig.label})` : `${isAnyAiConfigured ? pConfig.label : 'AI'} active`}
                                    >
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isAnyAiConfigured ? pConfig.dotClass : "bg-foreground/20")} />
                                        <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-label text-foreground-muted truncate">
                                            {isAnyAiConfigured ? `${pConfig.label} Active` : 'AI Inactive'}
                                        </span>
                                        {canToggle && (
                                            <ChevronRightIcon width={11} height={11} strokeWidth={2} className="shrink-0 text-foreground-muted/40" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                        className="h-9 w-9 rounded-lg border border-border bg-background text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:border-border-hover transition-colors flex items-center justify-center"
                                        aria-label="Switch color theme"
                                    >
                                        {mounted && (theme === 'dark'
                                            ? <SunIcon width={15} height={15} strokeWidth={1.6} />
                                            : <MoonIcon width={15} height={15} strokeWidth={1.6} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={toggleSidebar}
                            className={cn(
                                "h-9 rounded-lg border border-transparent text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors flex items-center",
                                sidebarCollapsed ? "w-10 justify-center" : "w-full justify-center"
                            )}
                            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <ChevronLeftIcon width={15} height={15} strokeWidth={1.6} className={cn("transition-transform duration-200", sidebarCollapsed && "rotate-180")} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
