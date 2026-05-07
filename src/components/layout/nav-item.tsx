'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'

import {
    ArchiveIcon,
    LayersIcon,
    LayoutDashboardIcon,
    MessageSquareIcon,
    PlusCircleIcon,
} from '@/components/icons'
import { hasCapability, type Capability, type UserRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

type NavIcon = ComponentType<{
    width?: number
    height?: number
    strokeWidth?: number
    className?: string
}>

export interface NavItemConfig {
    icon: NavIcon
    label: string
    href: string
    match: 'exact' | 'startsWith'
    capability: Capability
}

export const NAV_ITEMS: NavItemConfig[] = [
    { icon: LayoutDashboardIcon, label: 'Sites', href: '/', match: 'exact', capability: 'canViewSites' },
    { icon: PlusCircleIcon, label: 'New Commission', href: '/deployments/new', match: 'exact', capability: 'canCreateSites' },
    { icon: LayersIcon, label: 'Templates', href: '/templates', match: 'startsWith', capability: 'canManageTemplates' },
    { icon: ArchiveIcon, label: 'Archived', href: '/archived', match: 'startsWith', capability: 'canManageSites' },
    { icon: MessageSquareIcon, label: 'Enquiries', href: '/enquiry', match: 'startsWith', capability: 'canViewEnquiries' },
]

export function getNavItemsForRole(role: UserRole | null): NavItemConfig[] {
    return NAV_ITEMS.filter((item) => hasCapability(role, item.capability))
}

export function isActive(item: NavItemConfig, pathname: string): boolean {
    if (item.match === 'exact') return pathname === item.href
    return pathname.startsWith(item.href)
}

export function NavItem({
    item,
    active,
    isCollapsed,
    badge,
}: {
    item: NavItemConfig
    active: boolean
    isCollapsed: boolean
    badge?: number
}) {
    return (
        <div className="relative group/nav px-3 my-1.5 z-10">
            <Link
                href={item.href}
                className={cn(
                    'group flex items-center gap-3 h-11 px-3.5 rounded-lg transition-colors duration-150 border border-transparent',
                    active
                        ? 'bg-surface-hover text-foreground border-border shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover/80'
                )}
            >
                {active && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-indicator bg-foreground/70 dark:bg-white/80 rounded-r-full" />
                )}
                <div className={cn(
                    "relative flex h-6 w-6 items-center justify-center shrink-0 transition-colors duration-150",
                    active ? "text-foreground" : "text-foreground-muted dark:text-white/40 group-hover:text-foreground/70 dark:group-hover:text-white/70"
                )}>
                    <item.icon width={17} height={17} strokeWidth={active ? 1.9 : 1.55} />
                    {isCollapsed && !!badge && badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-foreground dark:bg-white" />
                    )}
                </div>
                <span
                    className={cn(
                        'text-[13px] font-medium tracking-wide whitespace-nowrap transition-all duration-200 flex-1',
                        isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100',
                        active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/90"
                    )}
                >
                    {item.label}
                </span>
                {!isCollapsed && !!badge && badge > 0 && (
                    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold leading-none px-1">
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
