import type {
  Deployment,
  Draft,
  DraftCardData,
  SectionRegistry,
  SiteData,
  Template,
} from '@/types'

export type Result<T, E = ServiceError> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export interface ServiceError {
  message: string
  code?: string
  status?: number
  cause?: unknown
}

export interface ServiceRequestOptions {
  signal?: AbortSignal
}

export interface SaveDraftInput {
  deploymentId?: string | null
  projectName?: string | null
  templateSlug: string
  templateId?: string | null
  currentStep?: number
  rawText?: string
  sectionData?: Record<string, unknown>
  sectionsRegistry?: Record<string, SectionRegistry>
  collectionData?: Record<string, unknown[]>
  siteSlug?: string | null
  lastActivePage?: string | null
  screenshotUrl?: string | null
}

export interface SaveDraftResult {
  id: string
}

export interface DraftService {
  list(options?: ServiceRequestOptions): Promise<Result<DraftCardData[]>>
  get(id: string, options?: ServiceRequestOptions): Promise<Result<Draft>>
  save(input: SaveDraftInput, options?: ServiceRequestOptions): Promise<Result<SaveDraftResult>>
  generateScreenshot(draftId: string, options?: ServiceRequestOptions): Promise<Result<void>>
}

export interface DeploymentWithTemplate {
  deployment: Deployment
  template: Template | null
}

export interface UpdateDeploymentInput {
  siteData: SiteData
  action: 'save' | 'republish' | 'cancel'
}

export interface UpdateDeploymentResult {
  id: string
  status?: Deployment['status']
  has_unpublished_changes?: boolean
  updated_at?: string
  error_message?: string | null
}

export interface RestoreDeploymentResult {
  deploymentId: string
}

export interface ActiveDeployment {
  id: string
  project_name: string
  status: Deployment['status']
  updated_at: string
  github_repo: string | null
}

export interface ActiveDeploymentGateResult {
  deployment: ActiveDeployment | null
  isLikelyStuck: boolean
}

export interface DeploymentService {
  getActive(options?: ServiceRequestOptions): Promise<Result<ActiveDeploymentGateResult>>
  listActive(options?: ServiceRequestOptions): Promise<Result<ActiveDeployment[]>>
  get(id: string, options?: ServiceRequestOptions): Promise<Result<DeploymentWithTemplate>>
  update(id: string, input: UpdateDeploymentInput, options?: ServiceRequestOptions): Promise<Result<UpdateDeploymentResult>>
  delete(id: string, options?: ServiceRequestOptions): Promise<Result<{ status: 'archived' }>>
  restore(id: string, options?: ServiceRequestOptions): Promise<Result<RestoreDeploymentResult>>
}

export interface StartDeployInput {
  projectName: string
  templateId: string
  siteData: SiteData
  deploymentId?: string | null
}

export interface StartDeployResult {
  deploymentId: string
}

export interface TemplateService {
  list(options?: ServiceRequestOptions): Promise<Result<Template[]>>
  checkProjectName(name: string, options?: ServiceRequestOptions): Promise<Result<ProjectNameCheckResult>>
}

export type ProjectNameCheckResult =
  | { exists: false }
  | { exists: true; type: 'draft' | 'deployment' }

export interface UploadImageInput {
  file: File
  objectKey: string
}

export interface UploadImageResult {
  url: string
  key: string
}

export interface ImageService {
  upload(input: UploadImageInput, options?: ServiceRequestOptions): Promise<Result<UploadImageResult>>
  getSignedUrl(
    key: string,
    options?: ServiceRequestOptions & { expiresIn?: number; bucket?: string }
  ): Promise<Result<{ url: string }>>
}

export type AiProvider = 'claude' | 'gemini'

export interface ParseProjectInput {
  templateId: string
  rawText: string
  provider: AiProvider
}

export interface ParseProjectResult {
  sectionData: Record<string, unknown>
  sectionsRegistry: Record<string, SectionRegistry>
  provider: AiProvider
  parseQuality: 'ok' | 'low' | 'empty'
}

export interface AiService {
  parseProject(input: ParseProjectInput, options?: ServiceRequestOptions): Promise<Result<ParseProjectResult>>
}
