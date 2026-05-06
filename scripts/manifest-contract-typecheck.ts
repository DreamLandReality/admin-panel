import type { TemplateManifest as AdminTemplateManifest } from '../src/types'
import type { TemplateManifest as SchemaTemplateManifest } from '../../templates-library/tooling/scripts/lib/manifest-schema/dist/index'

type AssertExtends<T extends U, U> = true

// templates-library is the manifest schema authority. Admin-panel may accept
// extra legacy fields, but every schema-valid manifest must be usable as the
// admin-panel TemplateManifest shape.
export type ManifestSchemaAssignableToAdmin = AssertExtends<SchemaTemplateManifest, AdminTemplateManifest>
