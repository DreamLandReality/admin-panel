import type { DeploymentStatus } from '@/types'

// ─── Status Configuration ────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  DeploymentStatus,
  {
    label: string
    variant: 'success' | 'warning' | 'danger' | 'info' | 'default'
    isActive?: boolean
  }
> = {
  live: { label: 'Live', variant: 'success' },
  draft: { label: 'Draft', variant: 'default' },
  deploying: { label: 'Deploying', variant: 'warning', isActive: true },
  building: { label: 'Building', variant: 'warning', isActive: true },
  failed: { label: 'Failed', variant: 'danger' },
  archived: { label: 'Archived', variant: 'default' },
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const ROUTES = {
  home: '/',
  login: '/login',
  newDeployment: '/deployments/new',
  templates: '/templates',
  newTemplate: '/templates/new',
  drafts: '/drafts',
  resumeDraft: (id: string) => `/deployments/new?draft=${id}` as const,
  settings: '/settings',
  deployment: (id: string) => `/deployments/${id}` as const,
  editDeployment: (id: string) => `/deployments/${id}/edit` as const,
  template: (slug: string) => `/templates/${slug}` as const,
} as const

// ─── Template Categories ─────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  'luxury',
  'modern',
  'investment',
  'villa',
  'affordable',
] as const

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const DASHBOARD_CARD_STAGGER_MS = 80
export const DASHBOARD_MAX_STAGGER_CARDS = 8
