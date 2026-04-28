// ─── Status & Category Enums ─────────────────────────────────────────────────

export type DeploymentStatus =
  | 'draft'
  | 'deploying'
  | 'building'
  | 'live'
  | 'failed'
  | 'archived'

export type TemplateCategory =
  | 'luxury'
  | 'modern'
  | 'investment'
  | 'villa'
  | 'affordable'

// ─── Template Manifest Types ─────────────────────────────────────────────────

export interface AssetStorage {
  type: 'r2'
  bucket: string
  prefix: string
}

export interface TemplateManifest {
  templateId: string
  version: string
  assetStorage?: AssetStorage
  gates?: SharedGateConfig[]
  gateActionOwnership?: Record<string, Record<string, string[]>>
  leadSources?: Record<string, ManifestLeadSource>
  stateTypes?: Record<string, ManifestStateType>
  pages?: ManifestPage[]
  globalSections?: string[]
  sections: ManifestSection[]
  collections?: Collection[]
  styleOverrides?: Record<string, Record<string, Record<string, unknown>>>
}

export interface ManifestLeadSource {
  label: string
  kind: 'contact' | 'gate' | 'custom' | string
  sectionId: string
  gateId?: string
}

export type ManifestStateType =
  | {
      type: 'enum'
      values: string[]
      default: string
      persist: boolean
      description?: string
    }
  | {
      type: 'boolean'
      default: boolean
      persist: boolean
      description?: string
    }
  | {
      type: 'number'
      default: number
      persist: boolean
      description?: string
      validation?: { min?: number; max?: number }
    }
  | {
      type: 'string'
      default: string
      persist: boolean
      description?: string
      validation?: { pattern?: string }
    }
  | {
      type: 'object'
      default: Record<string, unknown>
      persist: boolean
      description?: string
    }

export interface SharedGateAction {
  id: string
  mode?: 'reveal' | 'download' | 'link' | string
  sectionId?: string
  sectionIds?: string[]
  virtual?: boolean
  [key: string]: unknown
}

export interface SharedGateConfig {
  id: string
  statePath?: string
  storageKey?: string
  defaultState?: string
  formState?: string
  successState?: string
  failureState?: string
  expiredState?: string
  persistStates?: string[]
  persist?: boolean
  formSectionId?: string
  siteToken?: string | null
  submissionEndpoint?: string | null
  supabaseAnonKey?: string | null
  actions?: SharedGateAction[]
  [key: string]: unknown
}

export interface FieldGroup {
  id: string
  label: string
  icon: string
  fields: string[]
}

export interface ManifestPage {
  id: string
  name: string
  path: string
  required?: boolean
  sections?: string[]
  dynamic?: boolean
  sourceSection?: string        // section ID whose array items generate pages (e.g. "properties")
  sourceCollection?: string     // collection ID for CMS-based dynamic pages (Phase 2)
  slugField?: string            // field name used as URL param (default: "slug")
  itemsPath?: string            // key within object-type section data holding the items array (e.g. "items")
  detailSectionId?: string      // data-dr-section value in the detail page HTML
  sharedSectionId?: string      // id of a dedicated section holding labels shared across all detail pages
  sharedFieldGroups?: FieldGroup[]  // component groups for the shared labels section (sidebar nav when editing dynamic-parent)
  fieldGroups?: FieldGroup[]    // how to organize fields in editor sidebar for individual dynamic items
}

// Responsive style value — stored when a StyleControl has responsive: true
// Only valid for fontSize sliders. All other properties use a flat string.
export type ResponsiveStyleValue = {
  desktop?: string
  tablet?: string
  mobile?: string
}

export interface StyleControl {
  type: 'buttonGroup' | 'slider' | 'colorGrid'
  property: string
  label: string
  default?: string
  responsive?: boolean             // Only valid on fontSize sliders. Enables Desktop/Tablet/Mobile tabs in the admin panel.
  options?: { value: string; label: string; icon?: string }[]
  presets?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  unit?: string
  linked?: string
}

export interface SectionStyleControls {
  fields?: Record<string, StyleControl[]>
  section?: StyleControl[]
}

export interface ManifestSection {
  id: string
  name: string
  description: string
  dataFile?: string
  dataType?: 'object' | 'array'
  data?: any
  required: boolean
  enabled?: boolean
  showInNav?: boolean
  /** When true, section cannot be toggled off by editor users. */
  locked?: boolean
  page?: string
  imageSlots?: string[]
  listingFields?: string[]      // subset of fields for compact card view (array sections only)
  schema: SectionSchema
  styleControls?: SectionStyleControls
}

export interface FieldConstraints {
  maxLength?: number
  minLength?: number
  pattern?: string
  min?: number
  max?: number
  /** For array/repeater fields: whether new items can be added. Default true. */
  canAdd?: boolean
  /** For array/repeater fields: whether items can be removed. Default true. */
  canRemove?: boolean
  maxItems?: number
  minItems?: number
}

export interface FieldSchema {
  type: string
  description?: string
  uiLabel?: string
  uiWidget?: string
  /** For array fields: the schema of each item (mirrors JSON Schema `items`). */
  items?: SectionSchema
  properties?: Record<string, FieldSchema>
  enum?: string[]
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  step?: number
  aiIgnore?: boolean
  aiHint?: string
  example?: any
  /** For collectionPicker widget: ID of the referenced collection */
  collectionId?: string
  /** Whether this field can be edited by admin users. Defaults to true if omitted. */
  editable?: boolean
  /** Value and array constraints enforced by the editor. */
  constraints?: FieldConstraints
}

export interface SectionSchema {
  type: string
  required?: string[]
  properties?: Record<string, FieldSchema>
  items?: SectionSchema
  description?: string
  uiLabel?: string
}

// ─── Collection Types (CMS/Phase 2) ────────────────────────────────────────

export interface CollectionItem {
  id: string
  [field: string]: any
}

export interface Collection {
  id: string
  name: string
  slug: string
  schema: SectionSchema
  data: CollectionItem[]
}

// ─── Template Config Types ───────────────────────────────────────────────────

export interface TemplateConfig {
  id: string
  name: string
  description: string
  category: TemplateCategory
  buildCommand: string
  outputDirectory: string
  previewUrl: string | null
  previewImage?: string
  version: string
  sectionCount: number
  previewRuntimeVersion: string
}

// ─── Database Row Types ──────────────────────────────────────────────────────

export interface Template {
  id: string
  slug: string
  name: string
  description: string | null
  category: TemplateCategory
  framework: string
  github_repo: string
  manifest: TemplateManifest
  config: TemplateConfig
  default_data: Record<string, unknown> | null
  preview_url: string | null
  preview_image: string | null
  version: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Deployment {
  id: string
  project_name: string
  slug: string
  template_id: string
  template_version: string
  template_manifest: TemplateManifest
  site_data: SiteData
  status: DeploymentStatus
  github_repo: string | null
  github_repo_url: string | null
  cloudflare_project_id: string | null
  cloudflare_project_name: string | null
  live_url: string | null
  stable_url: string | null
  custom_domain: string | null
  site_token: string | null
  screenshot_url: string | null
  error_message: string | null
  build_logs: string | null
  status_log: StatusLogEntry[]
  has_unpublished_changes: boolean
  deployed_by: string | null
  deployed_at: string | null
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  deployment_id: string
  deployment_slug: string
  name: string
  email: string
  phone: string | null
  message: string | null
  source_url: string
  form_type: 'contact' | 'price-unlock' | string
  source_metadata: ResolvedSubmissionSource | null
  ip_address: string | null
  is_read: boolean
  created_at: string
}

export interface ResolvedSubmissionSource {
  id: string
  label: string
  kind: string
  sectionId?: string
  gateId?: string
  known: boolean
}

// ─── Draft Types ────────────────────────────────────────────────────────────

export interface Draft {
  id: string
  user_id: string
  deployment_id: string | null
  template_id: string | null
  template_slug: string
  current_step: number
  raw_text: string
  section_data: Record<string, any>
  sections_registry: Record<string, { enabled: boolean; showInNav?: boolean }>
  collection_data: Record<string, any[]>
  project_name: string | null
  site_slug: string | null
  last_active_page: string | null
  screenshot_url: string | null
  created_at: string
  updated_at: string
}

export interface DraftCardData {
  id: string
  project_name: string | null
  template_slug: string
  template_id: string | null
  current_step: number
  updated_at: string
  deployment_id: string | null
  screenshot_url: string | null
  // Joined from deployments when deployment_id is set
  deployments?: { project_name: string; screenshot_url: string | null; status: DeploymentStatus } | null
  // Joined from templates for thumbnail fallback
  templates?: { preview_url: string | null } | null
}

export interface PendingImage {
  blobUrl: string
  file: File
  r2Key: string
}

// ─── JSONB Sub-Types ─────────────────────────────────────────────────────────

export interface SiteData {
  /**
   * Per-section enabled state persisted in the DB.
   * `enabled` controls whether the section renders on the live site (visitor-facing).
   */
  _sections?: Record<string, { enabled: boolean; showInNav?: boolean }>
  [sectionId: string]: unknown
}

export interface SectionRegistry {
  id?: string
  /** Controls whether the section renders on the live site (visitor-facing). */
  enabled: boolean
  /** Controls whether the section appears in the template-owned navbar. */
  showInNav?: boolean
}

export interface StatusLogEntry {
  status: DeploymentStatus
  step: string | null
  message: string
  at: string
  metadata?: Record<string, unknown>
}

// ─── Dashboard-Specific Types ────────────────────────────────────────────────

export interface DeploymentCardData {
  id: string
  project_name: string
  slug: string
  status: DeploymentStatus
  screenshot_url: string | null
  template_id: string
  has_unpublished_changes: boolean
  site_data: SiteData | null
  live_url: string | null
  stable_url?: string | null
  updated_at: string
  templates?: { slug: string } | null
}

export interface StatItemData {
  label: string
  value: number
  colorClass?: string
}

// ─── API Types ───────────────────────────────────────────────────────────────

export interface APIResponse<T> {
  data?: T
  error?: string
  code?: string
}

export type ViewMode = 'desktop' | 'tablet' | 'mobile'

// ─── Deploy Streaming Types ─────────────────────────────────────────────────

export type DeployStepId =
  | 'upload_images'
  | 'create_repo'
  | 'inject_manifest'
  | 'cloudflare_setup'
  | 'save_record'
  | 'cf_build'

export interface DeployEvent {
  step: DeployStepId
  status: 'running' | 'done' | 'error'
  message: string
  data?: { siteUrl?: string; repoUrl?: string; siteSlug?: string }
}

export interface DeployStepState {
  id: DeployStepId
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  message?: string
}

export interface ValidationError {
  field: string
  message: string
  type: 'missing_data' | 'blob_url' | 'default_image' | 'missing_required' | 'invalid_gate'
}

export const DEPLOY_STEP_LABELS: Record<DeployStepId, string> = {
  upload_images: 'Upload Images',
  create_repo: 'Create Repository',
  inject_manifest: 'Inject Site Data',
  cloudflare_setup: 'Configure Hosting',
  save_record: 'Save Deployment',
  cf_build: 'Build & Deploy',
}
