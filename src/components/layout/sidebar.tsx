'use client'

import { useStore } from '@/stores/sidebar-store'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    PlusCircle,
    FileText,
    Layers,
    Settings,
    Building2,
    ChevronLeft,
    Sun,
    Moon,
    LogOut
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Portfolio', href: '/', match: 'exact', group: 'workspace' },
    { icon: PlusCircle, label: 'New Commission', href: '/deployments/new', match: 'exact', group: 'workspace' },
    { icon: FileText, label: 'Drafts', href: '/drafts', match: 'startsWith', group: 'workspace' },
    { icon: Layers, label: 'Templates', href: '/templates', match: 'startsWith', group: 'workspace' },
    { icon: Settings, label: 'Settings', href: '/settings', match: 'startsWith', group: 'system' },
]

function isActive(item: typeof NAV_ITEMS[0], pathname: string): boolean {
    if (item.match === 'exact') return pathname === item.href
    return pathname.startsWith(item.href)
}

function NavItem({ item, active, isCollapsed }: { item: typeof NAV_ITEMS[0]; active: boolean; isCollapsed: boolean }) {
    return (
        <div className="relative group/nav px-3 my-[2px] z-10">
            <Link
                href={item.href}
                className={cn(
                    'group flex items-center gap-4 h-11 px-3 rounded-lg transition-all duration-500 ease-out border border-transparent',
                    active
                        ? 'bg-black/[0.04] dark:bg-white/[0.03] text-foreground dark:text-white border-black/[0.08] dark:border-white/[0.05]'
                        : 'text-foreground-muted dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                )}
            >
                {active && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-[1.5px] bg-foreground dark:bg-white rounded-r-full shadow-[0_0_8px_rgba(0,0,0,0.1)] dark:shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                )}
                <div className={cn(
                    "flex w-6 items-center justify-center shrink-0 transition-transform duration-500 ease-out",
                    active ? "scale-105" : "group-hover:scale-105 text-foreground-muted dark:text-white/40 group-hover:text-foreground/70 dark:group-hover:text-white/70"
                )}>
                    <item.icon size={17} strokeWidth={active ? 1.75 : 1.5} />
                </div>
                <span
                    className={cn(
                        'text-[13px] font-medium tracking-wide whitespace-nowrap transition-all duration-300',
                        isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100',
                        active ? "text-foreground dark:text-white" : "text-foreground-muted dark:text-white/50 group-hover:text-foreground/90 dark:group-hover:text-white/90"
                    )}
                >
                    {item.label}
                </span>
            </Link>
            {isCollapsed && (
                <div className="invisible opacity-0 group-hover/nav:visible group-hover/nav:opacity-100 absolute left-full ml-1 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-foreground dark:bg-black border border-black/10 dark:border-white/[0.08] text-white text-[11px] font-medium tracking-widest uppercase rounded-lg shadow-2xl whitespace-nowrap pointer-events-none transition-all duration-200 z-50">
                    {item.label}
                </div>
            )}
        </div>
    )
}

export function Sidebar() {
    const { sidebarCollapsed, sidebarMobileOpen, toggleSidebar, closeMobile } = useStore()
    const pathname = usePathname()
    const { theme, setTheme } = useTheme()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    // To avoid hydration mismatch for persisted store:
    const [mounted, setMounted] = useState(false)
    const [userEmail, setUserEmail] = useState<string | null>(null)

    useEffect(() => {
        setMounted(true)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) setUserEmail(user.email)
        })
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
                    'z-50 bg-background dark:bg-background border-r border-border dark:border-white/[0.04] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex flex-col h-screen shrink-0',
                    'fixed inset-y-0 left-0 md:relative md:inset-auto', // Mobile: fixed overlay; Desktop: in-flow
                    !mounted && 'opacity-0', // Prevent hydration pop
                    sidebarCollapsed ? 'w-[76px]' : 'w-[280px]',
                    sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                )}
            >
                {/* Logo Area */}
                <Link href="/" className="flex items-center h-[96px] mb-4 border-b border-border dark:border-white/[0.04] px-5 group overflow-hidden" onClick={closeMobile}>
                    <div className="flex w-9 h-9 items-center justify-center shrink-0 border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg transition-transform duration-500 group-hover:scale-105 group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.04] group-hover:border-black/20 dark:group-hover:border-white/20">
                        {sidebarCollapsed ? (
                            <div className="text-foreground dark:text-white font-serif text-sm font-semibold tracking-wider">DR</div>
                        ) : (
                            <Building2 size={16} strokeWidth={1.5} className="text-foreground/80 dark:text-white/80" />
                        )}
                    </div>

                    <div className={cn(
                        "ml-4 flex flex-col justify-center whitespace-nowrap transition-all duration-500",
                        sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden ml-0' : 'w-auto opacity-100'
                    )}>
                        <div className="font-serif text-[17px] text-foreground dark:text-white leading-tight tracking-wide">Dream Reality</div>
                        <div className="text-[9px] font-medium uppercase tracking-[0.25em] text-foreground-muted dark:text-white/30 mt-0.5">Architecture Suite</div>
                    </div>
                </Link>

                {/* Navigation */}
                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4 subtle-scrollbar">
                    <div className={cn("px-7 mb-2 mt-4 transition-all duration-300", sidebarCollapsed ? "opacity-0 h-0 hidden" : "opacity-100 h-auto block")}>
                        <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-foreground-muted dark:text-white/30">Workspace</span>
                    </div>

                    {NAV_ITEMS.filter(i => i.group === 'workspace').map((item) => (
                        <div key={item.href} onClick={closeMobile}><NavItem item={item} active={isActive(item, pathname)} isCollapsed={sidebarCollapsed} /></div>
                    ))}

                    <div className="my-6 border-t border-border dark:border-white/[0.04] mx-4" />

                    <div className={cn("px-7 mb-2 mt-2 transition-all duration-300", sidebarCollapsed ? "opacity-0 h-0 hidden" : "opacity-100 h-auto block")}>
                        <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-foreground-muted dark:text-white/30">System</span>
                    </div>
                    {NAV_ITEMS.filter(i => i.group === 'system').map((item) => (
                        <div key={item.href} onClick={closeMobile}><NavItem item={item} active={isActive(item, pathname)} isCollapsed={sidebarCollapsed} /></div>
                    ))}

                    <div className="flex-1" />

                    <div className="mt-8 mb-4 border-t border-border dark:border-white/[0.04] mx-4" />

                    {/* Bottom Actions Formatted */}
                    <div className={cn("px-4 mb-3 flex flex-col gap-3 transition-all", sidebarCollapsed ? "items-center" : "items-stretch")}>

                        {/* Top Utility Row */}
                        <div className={cn("flex gap-2 w-full", sidebarCollapsed ? "flex-col" : "flex-row items-center")}>
                            {/* AI Status Pill */}
                            <div className={cn(
                                "flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/[0.04] bg-black/[0.02] dark:bg-white/[0.015] shadow-sm transition-all overflow-hidden relative cursor-default flex-1",
                                sidebarCollapsed ? "justify-center p-0 w-9 h-9 shrink-0" : "px-3.5 h-9"
                            )}>
                                <div className="absolute inset-0 bg-gradient-to-r from-black/[0.02] dark:from-white/[0.02] to-transparent pointer-events-none" />
                                <div className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground dark:bg-white opacity-40 shadow-[0_0_8px_rgba(0,0,0,0.1)] dark:shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground dark:bg-white shadow-[0_0_4px_rgba(0,0,0,0.2)] dark:shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                                </div>
                                {!sidebarCollapsed && <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-foreground-muted dark:text-white/60 whitespace-nowrap">Claude Active</span>}
                            </div>

                            {/* Theme Toggle */}
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={cn(
                                    "h-9 rounded-lg flex items-center justify-center text-foreground-muted dark:text-white/40 hover:text-foreground dark:hover:text-white/80 transition-all border border-transparent hover:border-black/[0.08] dark:hover:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] shrink-0",
                                    sidebarCollapsed ? "w-9" : "w-10"
                                )}
                                aria-label="Switch to dark/light mode"
                            >
                                {mounted && (
                                    <div className="relative w-4 h-4">
                                        <Sun className="absolute inset-0 h-4 w-4 rotate-0 scale-100 transition-all duration-500 ease-out dark:-rotate-90 dark:scale-0" strokeWidth={1.5} />
                                        <Moon className="absolute inset-0 h-4 w-4 rotate-90 scale-0 transition-all duration-500 ease-out dark:rotate-0 dark:scale-100" strokeWidth={1.5} />
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* User Profile Block */}
                        <div className={cn("flex flex-col gap-2 w-full", sidebarCollapsed && "items-center")}>

                            {/* Profile Info */}
                            <div className={cn(
                                "flex items-center transition-all duration-300",
                                sidebarCollapsed ? "justify-center p-0" : "gap-3 px-2 py-1.5 rounded-lg border border-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                            )}>
                                <div className="w-9 h-9 rounded-lg bg-black/5 dark:bg-white/5 text-foreground/80 dark:text-white/80 font-sans text-[11px] font-medium uppercase tracking-widest flex items-center justify-center shrink-0 border border-black/[0.04] dark:border-white/[0.04]">
                                    {userEmail ? userEmail.split('@')[0].slice(0, 2).toUpperCase() : '??'}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[13px] font-medium text-foreground dark:text-white tracking-wide truncate">{userEmail?.split('@')[0] ?? 'User'}</span>
                                        <span className="text-[10px] text-foreground-muted dark:text-white/40 tracking-wider truncate mt-0.5">{userEmail ?? ''}</span>
                                    </div>
                                )}
                            </div>

                            {/* Logout */}
                            <button
                                onClick={handleSignOut}
                                className={cn(
                                    "h-9 w-full rounded-lg flex items-center text-foreground-muted dark:text-white/40 hover:text-foreground dark:hover:text-white/80 transition-all border border-transparent hover:border-black/[0.08] dark:hover:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
                                    sidebarCollapsed ? "justify-center w-9 shrink-0" : "px-3"
                                )}
                            >
                                <LogOut size={16} strokeWidth={1.5} className="shrink-0" />
                                {!sidebarCollapsed && <span className="text-[11px] font-medium uppercase tracking-[0.1em] ml-2.5 truncate">Log Out</span>}
                            </button>
                        </div>
                    </div>

                    <div className="my-1 border-t border-border dark:border-white/[0.04] mx-4" />

                    {/* Collapse Toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="group flex items-center justify-between h-10 px-4 mx-3 rounded-lg text-foreground-muted dark:text-white/30 hover:text-foreground dark:hover:text-white/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-300 cursor-pointer mb-2 border border-transparent hover:border-black/[0.04] dark:hover:border-white/[0.04]"
                    >
                        <div className="flex w-6 items-center justify-center shrink-0">
                            <ChevronLeft size={16} strokeWidth={1.5} className={cn("transition-transform duration-500", sidebarCollapsed ? "rotate-180 text-foreground-muted/70 dark:text-white/50" : "rotate-0 text-foreground-muted/50 dark:text-white/30 group-hover:text-foreground-muted dark:group-hover:text-white/60")} />
                        </div>
                        <div className={cn("flex justify-between items-center w-full whitespace-nowrap transition-all duration-300", sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 ml-3')}>
                            <span className="text-[11px] font-medium uppercase tracking-[0.1em]">Collapse</span>
                            <span className="font-mono text-[9px] tracking-widest text-foreground-muted/50 dark:text-white/20">v0.1.0</span>
                        </div>
                    </button>
                </div>
            </aside>
        </>
    )
}
