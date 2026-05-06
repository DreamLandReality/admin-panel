import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'sales'

export type Capability =
  | 'canViewSites'
  | 'canManageSites'
  | 'canCreateSites'
  | 'canEditSites'
  | 'canManageTemplates'
  | 'canViewEnquiries'
  | 'canManageFollowUps'

type UserWithMetadata = Pick<User, 'app_metadata'>

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'sales'
}

export function getUserRole(user: UserWithMetadata | null | undefined): UserRole | null {
  const role = user?.app_metadata?.user_role
  return isUserRole(role) ? role : null
}

// UI visibility and API enforcement must share these capability names.
const ROLE_CAPABILITIES: Record<UserRole, Record<Capability, boolean>> = {
  admin: {
    canViewSites: true,
    canManageSites: true,
    canCreateSites: true,
    canEditSites: true,
    canManageTemplates: true,
    canViewEnquiries: true,
    canManageFollowUps: true,
  },
  sales: {
    canViewSites: true,
    canManageSites: false,
    canCreateSites: false,
    canEditSites: false,
    canManageTemplates: false,
    canViewEnquiries: true,
    canManageFollowUps: true,
  },
}

export function hasCapability(role: UserRole | null, capability: Capability): boolean {
  return role ? ROLE_CAPABILITIES[role][capability] : false
}

export function canViewSites(role: UserRole | null): boolean {
  return hasCapability(role, 'canViewSites')
}

export function canManageSites(role: UserRole | null): boolean {
  return hasCapability(role, 'canManageSites')
}

export function canCreateSites(role: UserRole | null): boolean {
  return hasCapability(role, 'canCreateSites')
}

export function canEditSites(role: UserRole | null): boolean {
  return hasCapability(role, 'canEditSites')
}

export function canManageTemplates(role: UserRole | null): boolean {
  return hasCapability(role, 'canManageTemplates')
}

export function canViewEnquiries(role: UserRole | null): boolean {
  return hasCapability(role, 'canViewEnquiries')
}

export function canManageFollowUps(role: UserRole | null): boolean {
  return hasCapability(role, 'canManageFollowUps')
}
