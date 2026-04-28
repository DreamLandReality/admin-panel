import type { SiteData, TemplateManifest } from '@/types'

export type ProductionReadinessReason =
  | 'shared_default_asset'
  | 'legacy_template_asset'
  | 'unchanged_default_asset'
  | 'unchanged_default_content'

export interface ProductionReadinessIssue {
  sectionId: string
  sectionName: string
  fieldPath: string
  fieldLabel: string
  reason: ProductionReadinessReason
  severity: 'warning'
  valuePreview: string
}

interface SchemaFieldMeta {
  label: string
  widget?: string
}

const IMPORTANT_FIELD_PATTERN =
  /(^|\.|\[\d+\]\.)(backgroundImage|heroImage|heroVideo|tourImage|tourVideo|mediaFile|image|images|photo|video|brochureFile|file|title|headline|subtitle|projectName|propertyName|price|pricing|payment|phone|email|address|seo|metaTitle|metaDescription|description)(\.|$)/i

const IMPORTANT_SECTION_PATTERN = /hero|media|gallery|tour|brochure|contact|price|seo|property|properties/i
const ASSET_EXTENSION_PATTERN = /\.(jpg|jpeg|png|webp|gif|avif|svg|mp4|webm|mov|pdf)(\?|#|$)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function humanizeToken(value: string): string {
  return value
    .replace(/\[\d+\]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function filenameFromUrl(value: string): string {
  try {
    const parsed = new URL(value)
    const name = parsed.pathname.split('/').filter(Boolean).pop()
    return name || value
  } catch {
    return value.split('/').filter(Boolean).pop() || value
  }
}

function previewValue(value: unknown): string {
  if (typeof value !== 'string') return String(value)
  if (ASSET_EXTENSION_PATTERN.test(value)) return filenameFromUrl(value)
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized
}

function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]')
}

function walkComparableLeaves(current: unknown, defaults: unknown, path = ''): Array<{ path: string; current: unknown; defaultValue: unknown }> {
  if (typeof current === 'string' || typeof current === 'number') {
    return [{ path, current, defaultValue: defaults }]
  }

  if (Array.isArray(current)) {
    return current.flatMap((item, index) =>
      walkComparableLeaves(item, Array.isArray(defaults) ? defaults[index] : undefined, `${path}[${index}]`)
    )
  }

  if (isRecord(current)) {
    return Object.entries(current).flatMap(([key, value]) =>
      walkComparableLeaves(value, isRecord(defaults) ? defaults[key] : undefined, path ? `${path}.${key}` : key)
    )
  }

  return []
}

function collectSchemaMeta(schema: unknown, prefix = ''): Map<string, SchemaFieldMeta> {
  const meta = new Map<string, SchemaFieldMeta>()
  if (!isRecord(schema)) return meta

  const properties = schema.properties
  if (isRecord(properties)) {
    for (const [key, fieldSchema] of Object.entries(properties)) {
      if (!isRecord(fieldSchema)) continue
      const fieldPath = prefix ? `${prefix}.${key}` : key
      const label = typeof fieldSchema.label === 'string'
        ? fieldSchema.label
        : typeof fieldSchema.title === 'string'
          ? fieldSchema.title
          : humanizeToken(key)
      const widget = typeof fieldSchema.uiWidget === 'string' ? fieldSchema.uiWidget : undefined
      meta.set(fieldPath, { label, widget })

      for (const [nestedPath, nestedMeta] of collectSchemaMeta(fieldSchema, fieldPath)) {
        meta.set(nestedPath, nestedMeta)
      }

      const items = fieldSchema.items
      if (isRecord(items)) {
        for (const [nestedPath, nestedMeta] of collectSchemaMeta(items, `${fieldPath}[]`)) {
          meta.set(nestedPath, nestedMeta)
        }
      }
    }
  }

  const items = schema.items
  if (isRecord(items)) {
    for (const [nestedPath, nestedMeta] of collectSchemaMeta(items, prefix)) {
      meta.set(nestedPath, nestedMeta)
    }
  }

  return meta
}

function schemaMetaForPath(meta: Map<string, SchemaFieldMeta>, path: string): SchemaFieldMeta | undefined {
  const normalized = normalizePath(path)
  return meta.get(normalized) ?? meta.get(normalized.split('.').slice(-1)[0])
}

function isSharedDefaultAsset(value: string): boolean {
  return value.includes('/shared-defaults/') && ASSET_EXTENSION_PATTERN.test(value)
}

function isLegacyTemplateAsset(value: string): boolean {
  return value.includes('/templates/') && ASSET_EXTENSION_PATTERN.test(value)
}

function isImportantField(sectionId: string, path: string, meta?: SchemaFieldMeta): boolean {
  if (meta?.widget === 'imageUpload' || meta?.widget === 'fileUpload') return true
  return IMPORTANT_FIELD_PATTERN.test(path) || IMPORTANT_SECTION_PATTERN.test(sectionId) && IMPORTANT_FIELD_PATTERN.test(path)
}

function buildIssue(
  section: TemplateManifest['sections'][number],
  fieldPath: string,
  fieldLabel: string,
  reason: ProductionReadinessReason,
  value: unknown
): ProductionReadinessIssue {
  return {
    sectionId: section.id,
    sectionName: section.name,
    fieldPath,
    fieldLabel,
    reason,
    severity: 'warning',
    valuePreview: previewValue(value),
  }
}

export function detectProductionReadinessIssues(
  siteData: SiteData,
  manifest: TemplateManifest
): ProductionReadinessIssue[] {
  const issues: ProductionReadinessIssue[] = []
  const seen = new Set<string>()
  const registry = (siteData as Record<string, unknown>)._sections

  for (const section of manifest.sections) {
    const registryEntry = isRecord(registry) ? registry[section.id] : undefined
    const enabled = isRecord(registryEntry) ? registryEntry.enabled : undefined
    if (enabled === false) continue

    const sectionData = (siteData as Record<string, unknown>)[section.id]
    if (sectionData === undefined || sectionData === null) continue

    const defaults = section.data
    const schemaMeta = collectSchemaMeta(section.schema)
    const leaves = walkComparableLeaves(sectionData, defaults)

    for (const leaf of leaves) {
      if (typeof leaf.current !== 'string') continue
      const current = leaf.current.trim()
      if (!current || current.startsWith('blob:')) continue

      const meta = schemaMetaForPath(schemaMeta, leaf.path)
      let reason: ProductionReadinessReason | null = null

      if (isSharedDefaultAsset(current)) {
        reason = 'shared_default_asset'
      } else if (isLegacyTemplateAsset(current)) {
        reason = 'legacy_template_asset'
      } else if (
        leaf.current === leaf.defaultValue &&
        typeof leaf.defaultValue === 'string' &&
        leaf.defaultValue.trim() !== '' &&
        isImportantField(section.id, leaf.path, meta)
      ) {
        reason = ASSET_EXTENSION_PATTERN.test(current)
          ? 'unchanged_default_asset'
          : 'unchanged_default_content'
      }

      if (!reason) continue

      const key = `${section.id}.${leaf.path}.${reason}`
      if (seen.has(key)) continue
      seen.add(key)

      issues.push(buildIssue(
        section,
        leaf.path,
        meta?.label ?? humanizeToken(leaf.path.split('.').pop() ?? leaf.path),
        reason,
        leaf.current
      ))
    }
  }

  return issues
}

export function summarizeProductionReadinessIssues(issues: ProductionReadinessIssue[], maxItems = 5): string | null {
  if (issues.length === 0) return null

  const visible = issues.slice(0, maxItems)
  const items = visible
    .map((issue) => `${issue.sectionName} -> ${issue.fieldLabel} (${issue.valuePreview})`)
    .join('; ')
  const remaining = issues.length > visible.length
    ? `; +${issues.length - visible.length} more`
    : ''

  return `Production readiness: ${issues.length} important default ${issues.length === 1 ? 'field is' : 'fields are'} still present. ${items}${remaining}.`
}
